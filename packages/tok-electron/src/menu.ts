import { Menu, MenuItemConstructorOptions, app, BrowserWindow, dialog } from 'electron';

export function buildApplicationMenu(mainWindow: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'קובץ',
      submenu: [
        {
          label: 'מסך פרויקטים...',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => mainWindow.webContents.send('menu:action', 'open-welcome'),
        },
        {
          label: 'מסמך חדש...',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:action', 'new-document'),
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
              mainWindow.webContents.send('menu:action', 'open-document', res.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'שמור',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:action', 'save-document'),
        },
        {
          label: 'שמור בשם...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu:action', 'save-as'),
        },
        { type: 'separator' },
        {
          label: 'הגדרות המערכת...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu:action', 'open-settings'),
        },
        {
          label: 'החלף שפה וכיווניות (עברית/EN)...',
          accelerator: 'Alt+Shift+L',
          click: () => mainWindow.webContents.send('menu:action', 'toggle-lang'),
        },
        { type: 'separator' },
        {
          label: 'ייצא לדפוס (ISO PDF/X-1a)...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu:action', 'export-pdf'),
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
          click: () => mainWindow.webContents.send('menu:action', 'normalize-hebrew'),
        },
        {
          label: 'מגן שמות קדושים (No-Break)',
          click: () => mainWindow.webContents.send('menu:action', 'shield-divine-names'),
        },
        {
          label: 'סנכרן מספור עמודים עברי (גימטריה)',
          click: () => mainWindow.webContents.send('menu:action', 'recalculate-gematria'),
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
