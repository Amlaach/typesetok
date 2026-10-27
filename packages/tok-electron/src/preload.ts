import { contextBridge, ipcRenderer } from 'electron';

export interface TokIpcBridge {
  sendCommand: (cmd: unknown) => Promise<unknown>;
  onEvent: (callback: (event: unknown) => void) => () => void;
  renderPdf: (input: string | { inputPath?: string; document?: unknown; outputPath?: string }, outputPath?: string) => Promise<string>;
  renderHtml: (input: string | { inputPath?: string; document?: unknown; outputPath?: string }, outputPath?: string) => Promise<string>;

  // Logger
  getRecentLogs: () => Promise<string[]>;
  openLogsFolder: () => Promise<boolean>;
  cleanOldLogs: (days?: number) => Promise<number>;
  setLogRetention: (days: number) => Promise<void>;

  // Updater
  checkForUpdates: () => Promise<unknown>;
  openReleaseUrl: (url?: string) => Promise<void>;

  // Plugins
  getPlugins: () => Promise<unknown[]>;
  togglePlugin: (pluginId: string, enabled: boolean) => Promise<boolean>;
  openPluginsFolder: () => Promise<void>;
  reloadPlugins: () => Promise<unknown[]>;
  getPluginSystemStatus: () => Promise<{ isSafeMode: boolean; isSaferActive: boolean; userPluginsDir: string; builtinPluginsDir: string }>;
  setPluginSafeMode: (enabled: boolean) => Promise<boolean>;

  // Document Storage & Typesetting
  saveDocument: (payload: { document: unknown; filePath: string }) => Promise<{ success: boolean; filePath: string }>;
  openDocument: (filePath: string) => Promise<unknown>;
  typesetDocument: (payload: { document?: unknown; inputPath?: string } | unknown) => Promise<{ success: boolean; pages: any[] }>;

  // System & Utilities
  openExternal: (url: string) => Promise<void>;
  getAppInfo: () => Promise<{ version: string; name: string }>;
  showSaveDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  showOpenDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  showImportDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  readImportFile: (filePath: string) => Promise<{
    fileName: string;
    filePath: string;
    size: number;
    isBinary: boolean;
    dataBase64: string;
    text?: string;
  }>;
  closeWindow: () => Promise<void>;
  quitApp: () => Promise<void>;
  getStartupFile: () => Promise<string | null>;
  onOpenFile: (callback: (filePath: string) => void) => () => void;
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
  renderPdf: async (input: string | { inputPath?: string; document?: unknown; outputPath?: string }, outputPath?: string) => {
    const payload = typeof input === 'string'
      ? { inputPath: input, outputPath }
      : { ...input, outputPath: outputPath || input?.outputPath };
    return await ipcRenderer.invoke('tok:render-pdf', payload);
  },
  renderHtml: async (input: string | { inputPath?: string; document?: unknown; outputPath?: string }, outputPath?: string) => {
    const payload = typeof input === 'string'
      ? { inputPath: input, outputPath }
      : { ...input, outputPath: outputPath || input?.outputPath };
    return await ipcRenderer.invoke('tok:render-html', payload);
  },

  // Logger APIs
  getRecentLogs: async () => {
    return await ipcRenderer.invoke('tok:get-recent-logs');
  },
  openLogsFolder: async () => {
    return await ipcRenderer.invoke('tok:open-logs-folder');
  },
  cleanOldLogs: async (days?: number) => {
    return await ipcRenderer.invoke('tok:clean-old-logs', days);
  },
  setLogRetention: async (days: number) => {
    return await ipcRenderer.invoke('tok:set-log-retention', days);
  },

  // Updater APIs
  checkForUpdates: async () => {
    return await ipcRenderer.invoke('tok:check-for-updates');
  },
  openReleaseUrl: async (url?: string) => {
    return await ipcRenderer.invoke('tok:open-release-url', url);
  },

  // Plugin APIs
  getPlugins: async () => {
    return await ipcRenderer.invoke('tok:get-plugins');
  },
  togglePlugin: async (pluginId: string, enabled: boolean) => {
    return await ipcRenderer.invoke('tok:toggle-plugin', { pluginId, enabled });
  },
  openPluginsFolder: async () => {
    return await ipcRenderer.invoke('tok:open-plugins-folder');
  },
  reloadPlugins: async () => {
    return await ipcRenderer.invoke('tok:reload-plugins');
  },
  getPluginSystemStatus: async () => {
    return await ipcRenderer.invoke('tok:get-plugin-system-status');
  },
  setPluginSafeMode: async (enabled: boolean) => {
    return await ipcRenderer.invoke('tok:set-plugin-safe-mode', enabled);
  },

  // Document Storage & Typesetting
  saveDocument: async (payload: { document: unknown; filePath: string }) => {
    return await ipcRenderer.invoke('tok:save-document', payload);
  },
  openDocument: async (filePath: string) => {
    return await ipcRenderer.invoke('tok:open-document', filePath);
  },
  typesetDocument: async (payload: { document?: unknown; inputPath?: string } | unknown) => {
    const normPayload = (payload && typeof payload === 'object' && ('document' in payload || 'inputPath' in payload))
      ? payload
      : { document: payload };
    return await ipcRenderer.invoke('tok:typeset-document', normPayload);
  },

  // System
  openExternal: async (url: string) => {
    return await ipcRenderer.invoke('tok:open-external', url);
  },
  getAppInfo: async () => {
    return await ipcRenderer.invoke('tok:get-app-info');
  },
  showSaveDialog: async (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    return await ipcRenderer.invoke('tok:show-save-dialog', options);
  },
  showOpenDialog: async (options?: { filters?: { name: string; extensions: string[] }[] }) => {
    return await ipcRenderer.invoke('tok:show-open-dialog', options);
  },
  showImportDialog: async (options?: { filters?: { name: string; extensions: string[] }[] }) => {
    return await ipcRenderer.invoke('tok:show-import-dialog', options);
  },
  readImportFile: async (filePath: string) => {
    return await ipcRenderer.invoke('tok:read-import-file', filePath);
  },
  closeWindow: async () => {
    return await ipcRenderer.invoke('tok:close-window');
  },
  quitApp: async () => {
    return await ipcRenderer.invoke('tok:quit-app');
  },
  getStartupFile: async () => {
    return await ipcRenderer.invoke('tok:get-startup-file');
  },
  onOpenFile: (callback: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('tok:open-file', handler);
    return () => ipcRenderer.removeListener('tok:open-file', handler);
  }
};

contextBridge.exposeInMainWorld('tokIpc', tokIpc);
