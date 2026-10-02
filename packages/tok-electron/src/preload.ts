import { contextBridge, ipcRenderer } from 'electron';

export interface TokIpcBridge {
  sendCommand: (cmd: unknown) => Promise<unknown>;
  onEvent: (callback: (event: unknown) => void) => () => void;
  renderPdf: (inputPath: string, outputPath: string) => Promise<string>;
  renderHtml: (inputPath: string, outputPath: string) => Promise<string>;
}

const tokIpc: TokIpcBridge = {
  sendCommand: async (cmd: unknown) => {
    return await ipcRenderer.invoke('tok:send-command', cmd);
  },
  onEvent: (callback: (event: unknown) => void) => {
    const eventHandler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    const menuHandler = (_: Electron.IpcRendererEvent, action: string, data?: unknown) => {
      callback({ action, data });
    };

    ipcRenderer.on('tok:event', eventHandler);
    ipcRenderer.on('menu:action', menuHandler);

    return () => {
      ipcRenderer.removeListener('tok:event', eventHandler);
      ipcRenderer.removeListener('menu:action', menuHandler);
    };
  },
  renderPdf: async (inputPath: string, outputPath: string) => {
    return await ipcRenderer.invoke('tok:render-pdf', { inputPath, outputPath });
  },
  renderHtml: async (inputPath: string, outputPath: string) => {
    return await ipcRenderer.invoke('tok:render-html', { inputPath, outputPath });
  },
};

contextBridge.exposeInMainWorld('tokIpc', tokIpc);
