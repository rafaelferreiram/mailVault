import crypto from 'node:crypto';
import http from 'node:http';
import { shell, BrowserWindow } from 'electron';
import type { AddressInfo } from 'node:net';

export function base64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function generatePkce() {
  // 43–128 chars; 48 random bytes → 64 base64url chars (well within spec).
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' as const };
}

export function generateState() {
  return base64url(crypto.randomBytes(24));
}

export interface LoopbackServer {
  /** Fully-qualified loopback URL the auth provider will redirect to (no trailing slash). */
  redirectUri: string;
  /** Port the server is bound to (assigned by the OS when port=0). */
  port: number;
  /** Resolves with the auth code, or rejects on timeout/state-mismatch/provider-error. */
  waitForCode: () => Promise<string>;
  /** Tear the server down (no-op once `waitForCode` resolves/rejects). */
  close: () => void;
}

/**
 * Spin up a one-shot loopback HTTP server bound to an OS-assigned port.
 * Both Google (Desktop OAuth client) and Microsoft (with `http://localhost` registered as a
 * Mobile/Desktop redirect) accept *any* loopback port — so we pick one dynamically to avoid
 * collisions with whatever else is running on the user's machine.
 */
export function startLoopbackServer(opts: {
  expectedState: string;
  /** Optional — if provided we try this port first, fall back to OS-assigned on failure. */
  preferredPort?: number;
  timeoutMs?: number;
}): Promise<LoopbackServer> {
  return new Promise((resolveOuter, rejectOuter) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (e: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    const server = http.createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end('bad request');
          return;
        }
        const url = new URL(req.url, `http://127.0.0.1`);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDesc = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Authorization failed', errorDesc || error, false));
          rejectCode(new Error(`OAuth error: ${error}${errorDesc ? ` — ${errorDesc}` : ''}`));
          return;
        }

        if (!code || state !== opts.expectedState) {
          res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
          res.end(htmlPage('Invalid state', 'State mismatch — possible CSRF.', false));
          rejectCode(new Error('OAuth state mismatch'));
          return;
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(
          htmlPage('MailVault connected', 'You can close this window and return to the app.', true)
        );
        resolveCode(code);
      } catch (e) {
        try {
          res.writeHead(500);
          res.end('internal error');
        } catch {
          // socket already closed
        }
        rejectCode(e as Error);
      }
    });

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      try {
        server.close();
      } catch {
        // ignore
      }
    };

    const timeout = setTimeout(
      () => {
        cleanup();
        rejectCode(new Error('OAuth flow timed out'));
      },
      opts.timeoutMs ?? 5 * 60_000
    );

    codePromise.finally(() => {
      clearTimeout(timeout);
      cleanup();
    });

    server.on('error', (err) => {
      // If preferredPort is in use, retry with port 0.
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' && opts.preferredPort) {
        server.removeAllListeners('error');
        server.listen(0, '127.0.0.1', () => bound());
        return;
      }
      cleanup();
      rejectOuter(err);
    });

    const bound = () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      // Use the hostname `localhost` (not the IP literal 127.0.0.1) because
      // OAuth providers do strict-string matching against the registered URI.
      // Most users register `http://localhost` in Azure / Google Cloud — both
      // providers accept any port at runtime when localhost is registered.
      // The server still binds to 127.0.0.1 for security (loopback only).
      const redirectUri = `http://localhost:${port}`;
      resolveOuter({
        redirectUri,
        port,
        waitForCode: () => codePromise,
        close: cleanup,
      });
    };

    server.listen(opts.preferredPort ?? 0, '127.0.0.1', bound);
  });
}

function htmlPage(title: string, body: string, ok: boolean) {
  const accent = ok ? '#00d4ff' : '#ff3d57';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    html,body{margin:0;height:100%;background:#080b0f;color:#e8edf3;font-family:'IBM Plex Sans',Inter,system-ui,sans-serif}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
    .card{padding:32px 40px;border:1px solid #1e2530;background:#0f1318;text-align:center;min-width:360px}
    h1{margin:0 0 8px;font-size:18px;color:${accent};letter-spacing:0.04em}
    p{margin:0;color:#7d8694;font-size:13px;line-height:1.5}
    .badge{display:inline-block;margin-bottom:14px;padding:4px 10px;border:1px solid ${accent};color:${accent};
      font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase}
  </style></head><body>
  <div class="wrap"><div class="card">
  <div class="badge">MAILVAULT</div>
  <h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>
  </div></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}

/**
 * Open the authorization URL. By default we use the system browser — it gives the user the
 * familiar provider sign-in (with autofill / passkeys) and avoids embedded-webview policy
 * violations. If `useEmbedded: true` we open a child BrowserWindow as a fallback.
 */
export function openAuthUrl(
  url: string,
  parent?: BrowserWindow,
  useEmbedded = false
): BrowserWindow | null {
  if (!useEmbedded) {
    void shell.openExternal(url);
    return null;
  }
  try {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      parent,
      modal: false,
      title: 'MailVault — Sign In',
      backgroundColor: '#080b0f',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    void win.loadURL(url);
    return win;
  } catch {
    void shell.openExternal(url);
    return null;
  }
}
