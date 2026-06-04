import { app, BrowserWindow, shell, Menu, safeStorage, ipcMain, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { registerIpc } from './ipc.js';
import { runCli } from './cli/index.js';
import { IPC } from '../shared/types.js';
import { storage } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Shown in the macOS Dock, menu bar, and window title (dev + prod). */
const APP_NAME = 'MailVault';

// During `npm run dev` the binary is still Electron.app — setName overrides the
// Dock tooltip and menu bar label on macOS before the app finishes launching.
if (process.platform === 'darwin') {
  app.setName(APP_NAME);
}
process.title = APP_NAME;

// Best-effort .env loader for `npm run electron:dev` (Vite handles dev-server env, but the
// main process spawns separately and needs its own pass).
loadDotenv(path.resolve(__dirname, '..', '.env'));

process.env.VITE_GOOGLE_CLIENT_ID ??= process.env.GOOGLE_CLIENT_ID ?? '';
process.env.VITE_GOOGLE_CLIENT_SECRET ??= process.env.GOOGLE_CLIENT_SECRET ?? '';
process.env.VITE_MICROSOFT_CLIENT_ID ??= process.env.MICROSOFT_CLIENT_ID ?? '';

function loadDotenv(envPath: string) {
  try {
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch (e) {
    console.warn('[main] could not load .env:', (e as Error).message);
  }
}

let mainWindow: BrowserWindow | null = null;

/**
 * Resolve the BrowserWindow icon path. In production electron-builder bundles
 * the .icns and the OS uses it for the dock automatically; we only need an
 * explicit `icon:` for dev (where the binary is "Electron Helper") and for
 * non-mac platforms. We try the 1024 PNG first, then fall back to the .icns.
 */
function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.resolve(__dirname, '..', 'assets', 'brand', 'app-icon-1024.png'),
    path.resolve(__dirname, '..', 'assets', 'icon.icns'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return undefined;
}

function createWindow() {
  const iconPath = resolveWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0e0e10',
    title: APP_NAME,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform !== 'darwin',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // On macOS, set the Dock icon in dev (packaged builds embed icon.icns in the .app).
  if (process.platform === 'darwin' && iconPath) {
    try {
      app.dock?.setIcon(iconPath);
    } catch {
      // dock may not be ready yet — best-effort.
    }
  }

  // Block external navigation; open in system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const allow =
      url.startsWith('file://') ||
      (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL ?? ''));
    if (!allow) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Forward renderer console output to the main process terminal so dev errors
  // are visible without having to find the detached DevTools window.
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    const tag =
      level === 0 ? '[r:debug]' : level === 1 ? '[r:info]' : level === 2 ? '[r:warn]' : '[r:err]';
    console.log(`${tag} ${source}:${line} ${message}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] renderer crashed:', details);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[main] did-fail-load (${code}) ${desc} url=${url}`);
  });

  mainWindow.on('focus', () => {
    void import('./services/liveSyncEngine.js').then(({ onWindowFocus }) => onWindowFocus(true));
  });
  mainWindow.on('blur', () => {
    void import('./services/liveSyncEngine.js').then(({ onWindowFocus }) => onWindowFocus(false));
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// CLI mode (no GUI) — invoked by `npm run cli -- --test=...`.
const isCli = process.argv.includes('--cli');

if (isCli) {
  // Don't create a Dock icon or app menu for the CLI mode.
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  app.commandLine.appendSwitch('disable-gpu');
  app.whenReady().then(async () => {
    let code = 0;
    try {
      code = await runCli(process.argv);
    } catch (e) {
      console.error('CLI error:', (e as Error).stack ?? (e as Error).message);
      code = 1;
    } finally {
      // Give chalk's stdout a tick to flush before exit.
      await new Promise((r) => setTimeout(r, 50));
      app.exit(code);
    }
  });
} else {
  app.whenReady().then(() => {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn(
        '[main] safeStorage is unavailable on this system — token storage will fall back to keytar or, ultimately, plaintext on disk. Configure libsecret/Keychain to fix.'
      );
    }
    if (process.platform === 'darwin') {
      app.setName(APP_NAME);
      const icon = resolveWindowIcon();
      if (icon) {
        try {
          app.dock?.setIcon(icon);
        } catch {
          // best-effort
        }
      }
    }
    registerIpc();
    // Sync IPC for the preload's no-flash boot. Preload calls this with
    // `ipcRenderer.sendSync` BEFORE any renderer JS runs, so the inline
    // <head> script in index.html can read `window.__MAILVAULT_PREFS__` on
    // first paint and apply `data-theme` / `--accent` without flicker.
    ipcMain.on('prefs:get-sync', (e) => {
      try {
        e.returnValue = storage.getPreferences();
      } catch {
        e.returnValue = null;
      }
    });
    createWindow();

    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenu()));
    } else {
      Menu.setApplicationMenu(null);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isCli) app.quit();
});

function sendToAllWindows(channel: string, payload?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function buildMenu(): MenuItemConstructorOptions[] {
  return [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          // Accelerator deliberately omitted — the renderer's keyboard shortcut
          // handler claims CmdOrCtrl+,. Adding it here would let the menu
          // swallow the keystroke before the renderer sees it.
          label: 'Personalization…',
          click: () => sendToAllWindows('prefs:open-panel'),
        },
        { type: 'separator' },
        {
          label: 'Show Me Around',
          accelerator: 'CmdOrCtrl+Shift+?',
          click: () => sendToAllWindows(IPC.OnboardingTriggerRestart),
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: '?',
          click: () => sendToAllWindows(IPC.HelpShowShortcuts),
        },
        { type: 'separator' },
        {
          label: "What's New",
          click: () => sendToAllWindows(IPC.HelpShowWhatsNew),
        },
        {
          label: 'Report a Problem',
          click: () => {
            const subject = encodeURIComponent('MailVault feedback');
            const body = encodeURIComponent(
              `\n\n— —\nMailVault ${app.getVersion()} on ${process.platform} ${process.arch}`
            );
            void shell.openExternal(`mailto:hi@mailvault.app?subject=${subject}&body=${body}`);
          },
        },
        { type: 'separator' },
        {
          label: 'MailVault on the Web',
          click: () => void shell.openExternal('https://github.com/'),
        },
      ],
    },
  ];
}
