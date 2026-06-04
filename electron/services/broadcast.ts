// Safely broadcast an IPC message to every open renderer.
//
// Workers can keep posting messages while a renderer reloads (dev HMR), the
// user closes the window mid-sync, or the GPU/network sub-process crashes.
// Calling `webContents.send` after the WebFrame is disposed throws
// `Render frame was disposed before WebFrameMain could be accessed` and
// floods the main-process log. This helper guards every send.

import { BrowserWindow, type WebContents } from 'electron';

function isAlive(wc: WebContents | null | undefined): wc is WebContents {
  return !!wc && !wc.isDestroyed() && !wc.isCrashed();
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const wc = win.webContents;
    if (!isAlive(wc)) continue;
    try {
      wc.send(channel, payload);
    } catch {
      // Renderer is in the middle of reloading or crashing — drop silently.
    }
  }
}
