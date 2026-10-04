import { Menu, MenuItemConstructorOptions, BrowserWindow, dialog } from 'electron';

export function buildApplicationMenu(mainWindow: BrowserWindow): Menu {
  // Accelerators can fire while the window is closing; never send to a destroyed renderer.
  const send = (action: string, data?: unknown) => {
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action, data);
    }
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'קובץ',
      submenu: [
        {
          label: 'מסך פרויקטים...',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('open-welcome'),
        },
        {
          label: 'מסמך חדש...',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('new-document'),
        },
        {
          label: 'פתח מסמך (.tok)...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const res = await dialog.showOpenDialog(mainWindow, {
              title: 'פתח חבילת מסמך TypesetOK',
              filters: [{ name: 'TypesetOK Document', extensions: ['tok'] }],
            });
            if (!res.canceled && res.filePaths.length > 0) {
              send('open-document', res.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'שמור',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('save-document'),
        },
        {
          label: 'שמור בשם...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('save-as'),
        },
        { type: 'separator' },
        {
          label: 'הגדרות המערכת...',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('open-settings'),
        },
        {
          label: 'החלף שפה וכיווניות (עברית/EN)...',
          accelerator: 'Alt+Shift+L',
          click: () => send('toggle-lang'),
        },
        { type: 'separator' },
        {
          label: 'ייצא לדפוס (ISO PDF/X-1a)...',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('export-pdf'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'יציאה' },
      ],
    },
    {
      label: 'עריכה',
      submenu: [
        { role: 'undo', label: 'בטל' },
        { role: 'redo', label: 'בצע שוב' },
        { type: 'separator' },
        { role: 'cut', label: 'גזור' },
        { role: 'copy', label: 'העתק' },
        { role: 'paste', label: 'הדבק' },
        { role: 'selectAll', label: 'בחר הכל' },
      ],
    },
    {
      label: 'טיפוגרפיה',
      submenu: [
        {
          label: 'נרמל ניקוד וטעמים (ת"י 6100)',
          click: () => send('normalize-hebrew'),
        },
        {
          label: 'מגן שמות קדושים (No-Break)',
          click: () => send('shield-divine-names'),
        },
        {
          label: 'סנכרן מספור עמודים עברי (גימטריה)',
          click: () => send('recalculate-gematria'),
        },
      ],
    },
    {
      label: 'תצוגה',
      submenu: [
        { role: 'reload', label: 'רענן' },
        { role: 'toggleDevTools', label: 'כלי מפתחים' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'זום 100%' },
        { role: 'zoomIn', label: 'הגדל זום' },
        { role: 'zoomOut', label: 'הקטן זום' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'מסך מלא' },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
