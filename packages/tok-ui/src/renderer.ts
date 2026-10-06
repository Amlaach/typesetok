import { TypesetOkApp } from './app';
import { t } from './i18n';

// Bootstrap TypesetOK Workbench
window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('Missing #app container');
    return;
  }

  const app = new TypesetOkApp(appContainer);
  (window as any).tokApp = app;

  // Startup milestone (read by the opt-in startup trace in tok-electron/main.ts)
  performance.mark('tok-ui-built');

  const runAction = (action: unknown, data?: unknown) => {
    if (typeof action === 'string' && action) app.handleSystemAction(action, data);
  };

  // Hook into IPC bridge if running inside Electron
  const tokIpc = (window as any).tokIpc;
  if (tokIpc) {
    app.showToast(t('toastShellConnected'));
    // Native menu actions from the main process
    tokIpc.onEvent?.((payload: any) => {
      if (payload && typeof payload === 'object') runAction(payload.action, payload.data);
    });
  } else {
    console.log('[TOK] Running in standalone web preview mode');
  }

  // Global window listener for custom dispatch
  window.addEventListener('tok-action', ((e: CustomEvent) => {
    runAction(e.detail?.action, e.detail?.data);
  }) as EventListener);
});