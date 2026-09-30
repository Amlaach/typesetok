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
    const handler = (_: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('tok:event', handler);
    return () => ipcRenderer.removeListener('tok:event', handler);
  },
  renderPdf: async (inputPath: string, outputPath: string) => {
    return await ipcRenderer.invoke('tok:render-pdf', { inputPath, outputPath });
  },
  renderHtml: async (inputPath: string, outputPath: string) => {
    return await ipcRenderer.invoke('tok:render-html', { inputPath, outputPath });
  },
};

contextBridge.exposeInMainWorld('tokIpc', tokIpc);
