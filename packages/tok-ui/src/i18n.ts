export type Language = 'he' | 'en';

export interface Translations {
  [key: string]: {
    he: string;
    en: string;
  };
}

export const strings: Translations = {
  // Brand & Welcome
  appName: { he: 'TypesetOK', en: 'TypesetOK' },
  appTagline: { he: 'מערכת עימוד והוצאה לאור מקצועית לטקסט עברי', en: 'Professional Hebrew Desktop Publishing System' },
  welcomeTitle: { he: 'מרכז הפרויקטים — TypesetOK', en: 'Project Hub — TypesetOK' },
  welcomeSubtitle: { he: 'בחר תבנית עימוד להקמת מסמך חדש, או המשך עבודה על פרויקט קיים', en: 'Create a new document from a template, or continue with an existing project' },
  newProject: { he: 'הקמת מסמך חדש', en: 'Create New Document' },
  openProject: { he: 'פתיחת קובץ קיים (.tok)', en: 'Open Existing Document (.tok)' },
  demoProject: { he: 'פרויקט לדוגמה: מסכת ברכות עם מפרשים', en: 'Demo Project: Tractate Berakhot' },
  recentProjects: { he: 'פרויקטים אחרונים', en: 'Recent Projects' },
  showOnStartup: { he: 'הצג את מרכז הפרויקטים עם הפעלת התוכנה', en: 'Show Project Hub when application starts' },
  noRecentProjects: { he: 'טרם נפתחו פרויקטים במערכת', en: 'No recent projects found' },
  continueToWorkspace: { he: 'המשך לסביבת העבודה', en: 'Continue to Workspace' },
  welcomePagesCount: { he: '{n} עמודים', en: '{n} pages' },

  // Templates
  templateGemara: { he: 'מסכת תלמודית (צורת הדף המסורתית)', en: 'Talmudic Layout (Traditional Folio)' },
  templateGemaraDesc: { he: 'גמרא במרכז, פירוש פנימי וחיצוני (רש״י ותוספות), ומדורי הערות בתחתית', en: 'Central Talmud text flanked by commentaries and bottom footnotes' },
  templateProse: { he: 'ספר קריאה ומחקר (פרוזה רציפה)', en: 'Prose & Academic Publication' },
  templateProseDesc: { he: 'סדר שורות רציף, שוליים קלאסיים מאוזנים, ויישור פסקאות אופטימלי', en: 'Continuous single or spread layout with balanced classical margins' },
  templateBulletin: { he: 'קונטרס, חוברת או עלון רב-טורי', en: 'Multi-Column Periodical / Bulletin' },
  templateBulletinDesc: { he: 'פריסה רב-טורית דינמית עם כותרות משנה ותיבות צפות', en: 'Dynamic multi-column layout with section headers and floating frames' },
  templateBlank: { he: 'מסמך חלק', en: 'Blank Document' },
  templateBlankDesc: { he: 'שולחן עבודה ריק עם אפשרות להגדרת מידות וגליונות מותאמים', en: 'Clean canvas with customizable geometry and page dimensions' },

  // Top Bar & Navigation
  topBarProjects: { he: 'פרויקטים', en: 'Projects' },
  topBarMenu: { he: 'תפריט', en: 'Menu' },
  topBarFileAndMenu: { he: 'קובץ ותפריט', en: 'File & Menu' },
  topBarSearchPlaceholder: { he: 'חיפוש פקודה בסביבת העבודה...', en: 'Search workspace commands...' },
  topBarViewCanvas: { he: 'קנבס עמודים', en: 'Pages Canvas' },
  topBarViewSplit: { he: 'תצוגה מפוצלת', en: 'Split View' },
  topBarViewStory: { he: 'עורך סיפור רציף', en: 'Story Editor' },
  topBarExportPdf: { he: 'ייצוא קדם-דפוס (PDF/X)', en: 'Export Pre-Press (PDF/X)' },
  topBarSaved: { he: 'נשמר', en: 'Saved' },
  topBarSwitchLanguage: { he: 'החלף שפה (Switch Language)', en: 'Switch language (החלף שפה)' },
  topBarViewMode: { he: 'מצב תצוגה', en: 'View mode' },

  // Quick Menu
  menuNewDocument: { he: 'הקמת מסמך חדש...', en: 'New Document...' },
  menuOpenDocument: { he: 'פתיחת מסמך (.tok)...', en: 'Open Document (.tok)...' },
  menuSave: { he: 'שמירת מסמך', en: 'Save Document' },
  menuSaveAs: { he: 'שמירה בשם...', en: 'Save As...' },
  menuNormalizeNiqqud: { he: 'נרמול ניקוד וטעמים (ת"י 6100)', en: 'Normalize Niqqud & Cantillation (SI 6100)' },
  menuShieldDivineNames: { he: 'מגן שמות קדושים (איסור שבירה)', en: 'Divine Names Shield (No Break)' },
  menuRecalcGematria: { he: 'סנכרון מספור עמודים עברי', en: 'Sync Hebrew Page Numbering' },
  menuExportPdf: { he: 'ייצוא קדם-דפוס (ISO PDF/X-1a)...', en: 'Export Pre-Press (ISO PDF/X-1a)...' },

  // Command Palette
  paletteSearchPlaceholder: { he: 'הקלד לחיפוש פקודות, תזרימים, עמודים או פעולות עימוד...', en: 'Type to search commands, flows, pages or layout actions...' },
  paletteHintNavigate: { he: 'ניווט עם ↑ ↓', en: '↑ ↓ to navigate' },
  paletteHintRun: { he: '↵ להפעלה', en: '↵ to run' },
  paletteHintClose: { he: 'Esc ליציאה', en: 'Esc to close' },
  paletteNoResults: { he: 'לא נמצאו פקודות תואמות', en: 'No matching commands' },

  // Status Bar
  statusTextLength: { he: 'אורך טקסט', en: 'Text length' },
  statusWords: { he: 'מילים', en: 'words' },
  statusActiveFlow: { he: 'תזרים פעיל', en: 'Active flow' },
  statusJustificationRules: { he: 'חוקי יישור: Knuth-Plass + אהלתר"ם', en: 'Justification: Knuth-Plass + Ahalterm' },
  statusPreflightClean: { he: 'Preflight: תקין (100% K)', en: 'Preflight: OK (100% K)' },
  statusPreflightWarnings: { he: 'Preflight: אזהרות', en: 'Preflight: warnings' },
  statusPreflightErrors: { he: 'Preflight: שגיאות', en: 'Preflight: errors' },
  statusZoom: { he: 'זום', en: 'Zoom' },
  statusGoToPage: { he: 'מעבר לעמוד או פקודה (Ctrl+K)', en: 'Go to page or command (Ctrl+K)' },

  // Sidebar Tabs
  sidebarPages: { he: 'עמודים', en: 'Pages' },
  sidebarFlows: { he: 'תזרימים', en: 'Flows' },
  sidebarStyles: { he: 'סגנונות', en: 'Styles' },
  sidebarLayers: { he: 'שכבות', en: 'Layers' },
  sidebarSettings: { he: 'הגדרות', en: 'Settings' },
  sidebarAbout: { he: 'אודות', en: 'About' },
  sidebarAddPage: { he: 'הוספת עמוד', en: 'Add Page' },
  structurePagesCount: { he: 'עמודי הספר ({n})', en: 'Book pages ({n})' },
  structurePageLabel: { he: 'דף {g}', en: 'Page {g}' },
  structurePageNumber: { he: "עמ' {n}", en: 'p. {n}' },
  structureSpreadRight: { he: 'כפולה ימנית', en: 'right of spread' },
  structureSpreadLeft: { he: 'כפולה שמאלית', en: 'left of spread' },
  structureFlowsTitle: { he: 'תזרימים מקבילים (Multi-Flow)', en: 'Parallel Flows (Multi-Flow)' },
  structureFlowsDesc: { he: 'מנוע סנכרון רב-תזרימי תורני: כל תזרים מוזרם באזור מוגדר בעמוד.', en: 'Multi-flow sync engine: each flow is poured into its own region of the page.' },
  structureFlowPosition: { he: 'מיקום', en: 'Position' },
  structureStylesTitle: { he: 'סגנונות מסמך (Style Tokens)', en: 'Document Styles (Style Tokens)' },
  structureLayersTitle: { he: 'שכבות עבודה', en: 'Layers' },
  structureHideLayer: { he: 'הסתר שכבה', en: 'Hide layer' },
  structureShowLayer: { he: 'הצג שכבה', en: 'Show layer' },
  structureLockLayer: { he: 'נעל שכבה', en: 'Lock layer' },
  structureUnlockLayer: { he: 'שחרר נעילת שכבה', en: 'Unlock layer' },

  // Settings Tabs
  settingsTitle: { he: 'הגדרות המערכת', en: 'System Settings' },
  settingsTabAppearance: { he: 'מראה וערכת נושא', en: 'Appearance & Theme' },
  settingsTabAccessibility: { he: 'נגישות והתאמה אישית', en: 'Accessibility & Display' },
  settingsTabLanguage: { he: 'שפה וכיווניות', en: 'Language & Direction' },
  settingsTabLogs: { he: 'יומן רישום ותחזוקה', en: 'Activity Logs & Maintenance' },
  settingsTabUpdates: { he: 'עדכוני תוכנה', en: 'Software Updates' },
  settingsTabPlugins: { he: 'מנהל התוספים', en: 'Plugin Extensions' },

  // Appearance Settings
  appearanceAccentColor: { he: 'צבע הדגשה מוביל', en: 'Primary Accent Color' },
  appearanceCanvasTone: { he: 'גוון רקע שולחן העבודה', en: 'Workspace Canvas Tone' },
  appearanceDensity: { he: 'צפיפות רכיבי הממשק', en: 'Interface Density' },
  densityComfortable: { he: 'מרווח (סטנדרטי)', en: 'Comfortable (Standard)' },
  densityCompact: { he: 'קומפקטי וממוקד', en: 'Compact (Focused)' },

  // Accessibility Settings
  accessHighContrast: { he: 'מצב ניגודיות גבוהה (High Contrast)', en: 'High Contrast Mode' },
  accessHighContrastDesc: { he: 'שיפור חדות הקריאה באמצעות רקע כהה מוחלט והבלטת גבולות וטקסטים', en: 'Enhance readability with pure black backgrounds and high-contrast borders' },
  accessFontScale: { he: 'קנה מידה של טקסט הממשק', en: 'UI Text Scaling' },
  accessFontScaleDesc: { he: 'הגדלת הגופנים בכל רחבי המערכת להתאמה אופטימלית', en: 'Adjust overall interface font scale for comfortable viewing' },
  accessReducedMotion: { he: 'הפחתת אנימציות ותנועה', en: 'Reduce Motion & Animations' },
  accessReducedMotionDesc: { he: 'ביטול מעברים והנפשות לטובת יציבות חזותית מוחלטת', en: 'Disable interface transitions and pulses for visual stability' },
  accessEnhancedFocus: { he: 'הדגשת פוקוס בניווט מקלדת', en: 'Enhanced Keyboard Focus Ring' },
  accessEnhancedFocusDesc: { he: 'מסגרת בולטת במיוחד סביב רכיב נבחר בעת מעבר עם מקש Tab', en: 'Prominent focus indicators when navigating the interface via keyboard' },
  accessDyslexicFont: { he: 'גופן מערכת נגיש ומרווח (Assistant)', en: 'Accessible Sans-Serif UI Font' },
  accessDyslexicFontDesc: { he: 'החלת גופן קריא בעל הבחנה גבוהה בין אותיות דומות', en: 'Use high-legibility sans-serif font across all interface panels' },

  // Language Settings
  languageSelect: { he: 'שפת הממשק וכיוון פריסה:', en: 'Interface Language & Layout Direction:' },
  languageHebrew: { he: 'עברית — יישור מימין לשמאל (RTL)', en: 'Hebrew — Right-to-Left (RTL)' },
  languageEnglish: { he: 'English — Left-to-Right (LTR)', en: 'English — Left-to-Right (LTR)' },
  languageActiveBadge: { he: 'פעיל', en: 'Active' },

  // Logs Settings
  logsRetentionLabel: { he: 'תקופת שמירת יומני רישום (מחיקה אוטומטית):', en: 'Log Retention Period (Auto-cleanup):' },
  logsRetentionDays: { he: 'ימים', en: 'days' },
  logsOpenFolder: { he: 'פתיחת תיקיית היומנים בסייר הקבצים', en: 'Open Logs Folder in File Explorer' },
  logsCleanNow: { he: 'מחיקת קובצי יומן ישנים כעת', en: 'Clean Expired Log Files Now' },
  logsRecentTitle: { he: 'רשומות אחרונות מיומן המערכת:', en: 'Recent System Log Entries:' },

  // Updates Settings
  updatesStatusChecking: { he: 'בודק זמינות עדכונים מול השרת...', en: 'Checking for updates on GitHub...' },
  updatesStatusLatest: { he: 'הגרסה המותקנת היא העדכנית ביותר', en: 'You are using the latest version' },
  updatesStatusAvailable: { he: 'גרסה חדשה זמינה להורדה והתקנה', en: 'A newer version is available for download' },
  updatesCheckNow: { he: 'בדיקת עדכונים כעת', en: 'Check for Updates Now' },
  updatesAutoCheck: { he: 'בדיקת עדכונים אוטומטית בעת פתיחת התוכנה', en: 'Automatically check for updates on startup' },
  updatesDownload: { he: 'הורדת חבילת העדכון', en: 'Download Update Package' },
  updatesCheckFailed: { he: 'בדיקת העדכונים נכשלה', en: 'Update check failed' },
  actionFailed: { he: 'הפעולה נכשלה', en: 'Action failed' },
  stateOn: { he: 'הופעל', en: 'enabled' },
  stateOff: { he: 'הושבת', en: 'disabled' },
  desktopOnlyFeature: { he: 'פעולה זו זמינה רק בגרסת שולחן העבודה', en: 'This action is only available in the desktop app' },
  logsRetentionUpdated: { he: 'מדיניות מחיקת יומנים עודכנה ל-{n} ימים', en: 'Log retention set to {n} days' },
  logsCleanedCount: { he: 'ניקוי הושלם: נמחקו {n} קובצי יומן ישנים', en: 'Cleanup done: {n} old log files deleted' },
  logsCleaned: { he: 'ניקוי יומנים הושלם בהצלחה', en: 'Log cleanup completed' },
  logsLoading: { he: 'טוען רשומות מיומן המערכת...', en: 'Loading log entries...' },
  logsEmpty: { he: '[אין רשומות יומן להצגה]', en: '[No log entries]' },
  logsLoadFailed: { he: 'שגיאה בטעינת יומן', en: 'Failed to load logs' },
  pluginsReloaded: { he: 'התוספים נטענו מחדש בהצלחה', en: 'Plugins reloaded' },
  pluginsLoadError: { he: 'שגיאת טעינה', en: 'Load error' },
  updatesCurrentChannel: { he: 'ערוץ שחרור רשמי יציב', en: 'Official stable channel' },
  updatesHint: { he: 'לחץ על "בדיקת עדכונים כעת" כדי לבדוק שחרורים מול מאגר GitHub.', en: 'Click "Check for Updates Now" to look for new releases on GitHub.' },

  // Plugins Settings
  pluginsInstalled: { he: 'הרחבות ותוספים מותקנים (JavaScript / TypeScript):', en: 'Installed Extensions (JavaScript / TypeScript):' },
  pluginsOpenFolder: { he: 'פתיחת תיקיית התוספים', en: 'Open Plugins Directory' },
  pluginsReload: { he: 'טעינה מחודשת של כל התוספים', en: 'Reload All Plugins' },
  pluginsEnabled: { he: 'פעיל', en: 'Enabled' },
  pluginsDisabled: { he: 'מושבת', en: 'Disabled' },
  pluginsNoPlugins: { he: 'לא נמצאו תוספים בתיקיית ההרחבות', en: 'No plugin extensions found' },

  // Action HUD
  hudFont: { he: 'גופן', en: 'Font' },
  hudSmaller: { he: 'הקטן גופן', en: 'Decrease size' },
  hudLarger: { he: 'הגדל גופן', en: 'Increase size' },
  hudBold: { he: 'מודגש', en: 'Bold' },
  hudAlignRight: { he: 'ימין', en: 'Right' },
  hudAlignCenter: { he: 'מרכז', en: 'Center' },
  hudAlignJustify: { he: 'בלוק', en: 'Justify' },
  hudAlignTitle: { he: 'שנה יישור (ימין / מרכז / בלוק)', en: 'Change alignment (right / center / justify)' },
  hudQuickStyle: { he: 'בורר סגנון מהיר', en: 'Quick style' },

  // Contextual Inspector
  inspAriaLabel: { he: 'מפקח מאפיינים', en: 'Properties inspector' },
  inspDocTitle: { he: 'הגדרות מסמך ועמוד', en: 'Document & Page Setup' },
  inspDocSubtitle: { he: 'מסמך תורני', en: 'Torah document' },
  inspPageSize: { he: 'ממדי עמוד ופורמט', en: 'Page Size & Format' },
  inspPresetSefer: { he: 'ספר קודש סטנדרטי (17×24 ס"מ)', en: 'Standard sefer (17×24 cm)' },
  inspPresetCrown: { he: 'פורמט קראון (16.5×23.5 ס"מ)', en: 'Crown (16.5×23.5 cm)' },
  inspPresetA4: { he: 'פורמט A4 (21×29.7 ס"מ)', en: 'A4 (21×29.7 cm)' },
  inspPresetB5: { he: 'פורמט B5 (17.6×25 ס"מ)', en: 'B5 (17.6×25 cm)' },
  inspWidth: { he: 'רוחב', en: 'Width' },
  inspHeight: { he: 'גובה', en: 'Height' },
  unitMm: { he: 'מ"מ', en: 'mm' },
  inspGradedMargins: { he: 'שוליים מדורגים (Graded Margins)', en: 'Graded Margins' },
  inspTop: { he: 'עליון', en: 'Top' },
  inspBottom: { he: 'תחתון', en: 'Bottom' },
  inspInside: { he: 'פנימי/שדרה', en: 'Inside/Spine' },
  inspOutside: { he: 'חיצוני', en: 'Outside' },
  inspBaselineGrid: { he: 'רשת שורות בסיס (Baseline Grid)', en: 'Baseline Grid' },
  inspLineStep: { he: 'צעד שורה', en: 'Line step' },
  inspTopOffset: { he: 'היסט עליון', en: 'Top offset' },
  inspPreflight: { he: 'קדם-דפוס רציף (Continuous Preflight)', en: 'Continuous Preflight' },
  inspProdStatus: { he: 'סטטוס ייצור', en: 'Production status' },
  inspReadyForPrint: { he: 'תקין (Ready for Print)', en: 'Ready for print' },
  inspColorProfile: { he: 'פרופיל צבע', en: 'Color profile' },
  inspOverset: { he: 'טקסט גולש (Overset)', en: 'Overset text' },
  inspNoIssues: { he: '0 חריגות', en: '0 issues' },
  inspImageRes: { he: 'רזולוציית תמונות', en: 'Image resolution' },
  inspImageResOk: { he: '300+ DPI (תקין)', en: '300+ DPI (OK)' },
  inspTextFrame: { he: 'תיבת טקסט', en: 'Text Frame' },
  inspGeometry: { he: 'מיקום וממדים (Geometry)', en: 'Position & Size' },
  inspPosX: { he: 'מיקום X', en: 'X' },
  inspPosY: { he: 'מיקום Y', en: 'Y' },
  inspWidthW: { he: 'רוחב W', en: 'Width W' },
  inspHeightH: { he: 'גובה H', en: 'Height H' },
  inspFlowThreading: { he: 'שיוך תזרים ושרשור', en: 'Flow & Threading' },
  inspFlowGemara: { he: 'גמרא (טקסט מרכזי)', en: 'Gemara (main text)' },
  inspFlowRashi: { he: 'רש"י (פירוש פנימי)', en: 'Rashi (inner commentary)' },
  inspFlowTosafot: { he: 'תוספות (פירוש חיצוני)', en: 'Tosafot (outer commentary)' },
  inspFlowNotes: { he: 'הערות שוליים וציונים', en: 'Footnotes & references' },
  inspNone: { he: 'ללא', en: 'none' },
  inspInsets: { he: 'שוליים פנימיים ויישור אנכי', en: 'Insets & Vertical Alignment' },
  inspRight: { he: 'ימין', en: 'Right' },
  inspLeft: { he: 'שמאל', en: 'Left' },
  inspVAlign: { he: 'יישור אנכי בתיבה:', en: 'Vertical alignment:' },
  inspCenter: { he: 'מרכז', en: 'Center' },
  inspJustify: { he: 'מלא', en: 'Justify' },
  inspTypography: { he: 'טיפוגרפיה ועריכה', en: 'Typography & Editing' },
  inspStyleToken: { he: 'טוקן סגנון פסקה', en: 'Paragraph Style Token' },
  inspLocalOverride: { he: 'שינוי מקומי (+)', en: 'Local override (+)' },
  inspFontSpacing: { he: 'גופן ומרווחים', en: 'Font & Spacing' },
  inspFontSize: { he: 'גודל גופן', en: 'Font size' },
  inspLeading: { he: 'רווח שורות', en: 'Leading' },
  inspJustify3: { he: 'יישור עברי תלת-שלבי (3-Tier)', en: '3-Tier Hebrew Justification' },
  inspTier1: { he: 'שכבה 1: רווחי מילים (80%–130%)', en: 'Tier 1: word spacing (80%–130%)' },
  inspMin: { he: 'מינימום', en: 'Minimum' },
  inspMax: { he: 'מקסימום', en: 'Maximum' },
  inspTier2: { he: 'שכבה 2: מתיחת אותיות אהלתר"ם', en: 'Tier 2: Ahalterm letter stretching' },
  inspEnableStretch: { he: 'הפעל מתיחת אותיות:', en: 'Enable letter stretching:' },
  inspMaxStretch: { he: 'מקסימום מתיחה', en: 'Max stretch' },
  inspTier3: { he: 'שכבה 3: מיקרו-טרקינג (±2%)', en: 'Tier 3: micro-tracking (±2%)' },
  inspTrackingRange: { he: 'טווח מיקרו-טרקינג', en: 'Micro-tracking range' },
  inspSacred: { he: 'ניקוד, טעמים ושמות קדושים', en: 'Niqqud, Cantillation & Divine Names' },
  inspDivineShield: { he: 'מגן שמות קדושים (איסור שבירה):', en: 'Divine names shield (no break):' },
  inspImageFrame: { he: 'מסגרת תמונה ועיטור', en: 'Image & Ornament Frame' },
  inspImage: { he: 'תמונה', en: 'Image' },
  inspFitting: { he: 'התאמת תמונה (Fitting)', en: 'Image Fitting' },
  inspFitProportional: { he: 'התאם פרופורציונלית', en: 'Fit proportionally' },
  inspFitFill: { he: 'מלא מסגרת לחלוטין', en: 'Fill frame' },
  inspFitFrame: { he: 'התאם מסגרת לתוכן', en: 'Fit frame to content' },
  inspEffRes: { he: 'רזולוציה אפקטיבית', en: 'Effective resolution' },
  inspEffResOk: { he: '300 DPI (תקין)', en: '300 DPI (OK)' },
  inspColorSpace: { he: 'מרחב צבע', en: 'Color space' },
  inspWrap: { he: 'דחיפת טקסט (Wrap)', en: 'Text wrap' },
  inspWrapAround: { he: 'סביב מסגרת (4mm)', en: 'Around frame (4mm)' },
  inspMulti: { he: 'בחירה מרובה', en: 'Multiple Selection' },
  inspMultiCount: { he: '3 אובייקטים', en: '3 objects' },
  inspAlignDist: { he: 'יישור ופיזור מהיר (Align & Distribute)', en: 'Align & Distribute' },
  inspAlignRight: { he: 'ימין ⇥', en: 'Right ⇥' },
  inspAlignCenter: { he: 'מרכז ⇋', en: 'Center ⇋' },
  inspAlignLeft: { he: 'שמאל ⇤', en: 'Left ⇤' },
  inspAlignTop: { he: 'מעלה ⇪', en: 'Top ⇪' },
  inspAlignMiddle: { he: 'אמצע ⇕', en: 'Middle ⇕' },
  inspAlignBottom: { he: 'מטה ⇩', en: 'Bottom ⇩' },
  inspDistribute: { he: 'פיזור מרווחים שווה אנכית', en: 'Distribute vertical spacing' },
  inspScrubHint: { he: 'גרור ימינה/שמאלה לכוונון רציף', en: 'Drag left/right to adjust (↑/↓ in the field)' },
  inspThreading: { he: 'שרשור תזרים:', en: 'Threaded to:' },
  inspSyncStyle: { he: 'עדכן סגנון גלובלי מהשינוי הנוכחי', en: 'Update global style from this override' },
  inspNormalize: { he: 'נרמל רצף תווי ניקוד (ת"י 6100)', en: 'Normalize niqqud order (SI 6100)' },

  // About Modal
  aboutTitle: { he: 'אודות TypesetOK', en: 'About TypesetOK' },
  aboutVersionLabel: { he: 'גרסת תוכנה:', en: 'Application Version:' },
  aboutCoreLabel: { he: 'מנוע עימוד מרחבי:', en: 'Typesetting Engine:' },
  aboutRustVersion: { he: 'Rust Native (אלגוריתם Knuth-Plass ויישור אהלתר״ם)', en: 'Rust Native (Knuth-Plass & Ahalterm Justifier)' },
  aboutShellLabel: { he: 'סביבת שולחן עבודה:', en: 'Desktop Shell:' },
  aboutShellValue: { he: 'Electron + Chromium Pre-Press Platform', en: 'Electron + Chromium Pre-Press Platform' },
  aboutGithubBtn: { he: 'מאגר הפרויקט ב-GitHub (קוד פתוח)', en: 'Project Repository on GitHub' },
  aboutClose: { he: 'סגירה', en: 'Close' },

  // App shell (app.ts / renderer.ts): command palette
  cmdCatProjects: { he: 'פרויקטים ומסמכים', en: 'Projects & Documents' },
  cmdCatSystem: { he: 'מערכת והעדפות', en: 'System & Preferences' },
  cmdCatTypography: { he: 'פעולות טיפוגרפיה', en: 'Typography' },
  cmdCatPrint: { he: 'מערכת ודפוס', en: 'Output & Print' },
  cmdCatPages: { he: 'עמודים וניווט', en: 'Pages & Navigation' },
  cmdCatView: { he: 'תצוגה ורשת', en: 'View & Grid' },
  cmdWelcomeTitle: { he: 'מסך בחירת פרויקטים (Welcome Screen)', en: 'Project Picker (Welcome Screen)' },
  cmdWelcomeSub: { he: 'בחירת תבנית או פרויקט קיים', en: 'Choose a template or an existing project' },
  cmdSettingsTitle: { he: 'הגדרות המערכת (Settings)', en: 'Settings' },
  cmdSettingsSub: { he: 'ערכות עיצוב, שפה, לוגים ותוספים', en: 'Themes, language, logs and plugins' },
  cmdAboutTitle: { he: 'אודות TypesetOK (About)', en: 'About TypesetOK' },
  cmdAboutSub: { he: 'גרסה, רישיון ומאגר GitHub', en: 'Version, license and GitHub repository' },
  cmdToggleLangTitle: { he: 'החלף שפה וכיוון (עברית RTL / English LTR)', en: 'Switch language & direction (Hebrew RTL / English LTR)' },
  cmdJustifyTitle: { he: 'יישור עברי מלא (אהלתר"ם + רווחי מילים)', en: 'Full Hebrew justification (Ahalterm + word spacing)' },
  cmdJustifySub: { he: 'שילוב 3 שכבות יישור', en: 'Combines all 3 justification tiers' },
  cmdNormalizeTitle: { he: 'נרמל ניקוד וטעמים (ת"י 6100)', en: 'Normalize niqqud & cantillation (SI 6100)' },
  cmdNormalizeSub: { he: 'תיקון סדר תווי יוניקוד', en: 'Fixes the order of Unicode marks' },
  cmdShieldTitle: { he: 'מגן שמות קדושים (איסור שבירה)', en: 'Divine names shield (no break)' },
  cmdShieldSub: { he: 'הגנה על שמות הוי"ה ואדנות', en: 'Protects the Tetragrammaton and Adonai' },
  cmdGematriaTitle: { he: 'סנכרן מספור עמודים עברי (גימטריה)', en: 'Sync Hebrew page numbering (gematria)' },
  cmdGematriaSub: { he: 'החלת גרשיים וכללי טו/טז', en: 'Applies geresh/gershayim and the 15/16 rule' },
  cmdExportTitle: { he: 'ייצוא קובץ לדפוס (ISO PDF/X-1a)', en: 'Export for print (ISO PDF/X-1a)' },
  cmdExportSub: { he: 'קדם-דפוס רציף 100% K', en: 'Continuous preflight, 100% K' },
  cmdNewPageTitle: { he: 'הוסף עמוד חדש לספר', en: 'Add a new page' },
  cmdMarginsTitle: { he: 'הצג/הסתר קווי שוליים (Margins Guide)', en: 'Show/hide margin guides' },
  cmdBaselineTitle: { he: 'הצג/הסתר רשת שורות בסיס (Baseline Grid)', en: 'Show/hide baseline grid' },
  cmdZoom100Title: { he: 'זום 100% (גודל טבעי)', en: 'Zoom 100% (actual size)' },

  // App shell: pages, panels and notifications
  appStoryEditorTitle: { he: 'עורך סיפור רציף (Story Editor)', en: 'Story Editor' },
  appPageThumb: { he: 'דף {page}', en: 'Page {page}' },
  appPageStatus: { he: 'דף {page} ({index} מתוך {total})', en: 'Page {page} ({index} of {total})' },
  appLangHebrewRtl: { he: 'עברית (RTL)', en: 'Hebrew (RTL)' },
  appLangEnglishLtr: { he: 'English (LTR)', en: 'English (LTR)' },
  appLangHebrew: { he: 'עברית', en: 'Hebrew' },
  appLangEnglish: { he: 'English', en: 'English' },
  appLayerShown: { he: 'מוצגת', en: 'shown' },
  appLayerHidden: { he: 'מוסתרת', en: 'hidden' },
  toastShellConnected: { he: 'מעטפת TypesetOK פעילה ומחוברת לליבת Rust', en: 'TypesetOK shell is active and connected to the Rust core' },
  toastLangSwitched: { he: 'שפת הממשק הוחלפה ל-{lang}', en: 'Interface language switched to {lang}' },
  toastLangUpdated: { he: 'שפת הממשק עודכנה: {lang}', en: 'Interface language updated: {lang}' },
  toastFlowSelected: { he: 'תזרים נבחר: {name}', en: 'Flow selected: {name}' },
  toastStyleApplied: { he: 'החלת סגנון: {name}', en: 'Style applied: {name}' },
  toastQuickStyle: { he: 'הוחל סגנון מהיר: {name}', en: 'Quick style applied: {name}' },
  toastLayerToggled: { he: 'שכבה {name}: {state}', en: 'Layer {name}: {state}' },
  toastGlobalStyleSynced: { he: 'הסגנון הגלובלי עודכן בהצלחה מכל השינויים המקומיים!', en: 'Global style updated from all local overrides!' },
  toastAlignApplied: { he: 'יישור אובייקטים הוחל: {type}', en: 'Alignment applied: {type}' },
  toastPreflightOk: { he: 'דוח קדם-דפוס (Continuous Preflight): תקין ללא חריגות', en: 'Continuous Preflight report: OK, no issues' },
  toastMarginsToggled: { he: 'מתג קווי שוליים הופעל', en: 'Margin guides toggled' },
  toastBaselineToggled: { he: 'מתג רשת שורות בסיס הופעל', en: 'Baseline grid toggled' },
  toastPageAdded: { he: 'נוסף עמוד חדש: דף {page} (עמ\' {index})', en: 'New page added: {page} (p. {index})' },
  toastProjectCreated: { he: 'נוצר פרויקט חדש מתבנית: {name}', en: 'New project created from template: {name}' },
  toastDemoLoaded: { he: 'פרויקט לדוגמה נטען בהצלחה', en: 'Sample project loaded' },
  toastOpenFile: { he: 'פתיחת קובץ: {path}', en: 'Opening file: {path}' },
  toastSaved: { he: 'המסמך נשמר בהצלחה בפורמט .tok', en: 'Document saved in .tok format' },
  toastExporting: { he: 'מייצא לקובץ לדפוס ISO PDF/X-1a...', en: 'Exporting print-ready ISO PDF/X-1a...' },
  toastExportDone: { he: 'הייצוא לדפוס הושלם בהצלחה!', en: 'Print export completed!' },
  toastExportError: { he: 'שגיאת ייצוא: {error}', en: 'Export error: {error}' },
  toastExportSimulated: { he: 'הדמיית ייצוא: קובץ ISO PDF/X-1a הופק בהצלחה!', en: 'Export simulation: ISO PDF/X-1a file produced!' },
  toastNormalized: { he: 'נרמול ניקוד וטעמים ת"י 6100 הוחל בהצלחה על כל הפסקאות', en: 'SI 6100 niqqud & cantillation normalization applied to all paragraphs' },
  toastShieldOn: { he: 'מגן שמות קדושים הופעל (איסור שבירה בשמות הויה ואדנות)', en: 'Divine names shield enabled (no line breaks inside the Divine Names)' },
  toastGematriaSynced: { he: 'סנכרון מספור עמודים עברי בגימטריה הושלם', en: 'Hebrew gematria page numbering synced' },
  toastJustified: { he: 'יישור עברי מלא הוחל: רווחי מילים 85%-125% + מתיחת אהלתר"ם 120%', en: 'Full Hebrew justification applied: word spacing 85%–125% + Ahalterm stretch 120%' },
};

export function directionOf(lang: Language): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr';
}

class I18nManager {
  private currentLang: Language = 'he';
  private listeners: ((lang: Language) => void)[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('tok_lang');
      if (saved === 'en' || saved === 'he') {
        this.currentLang = saved;
      }
    } catch {}
    // index.html ships as <html dir="rtl" lang="he">. Sync it with the saved language
    // at startup too, not only on change; otherwise an English session keeps an RTL
    // document (toasts, scrollbars and anything outside #app laid out right-to-left).
    this.applyToDocument();
  }

  public getLanguage(): Language {
    return this.currentLang;
  }

  public getDirection(): 'rtl' | 'ltr' {
    return directionOf(this.currentLang);
  }

  private applyToDocument(): void {
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = this.getDirection();
  }

  public setLanguage(lang: Language): void {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    try {
      localStorage.setItem('tok_lang', lang);
    } catch {}

    // Update document HTML direction & lang
    this.applyToDocument();

    for (const listener of [...this.listeners]) {
      try {
        listener(lang);
      } catch (err) {
        console.error('[i18n] language listener failed:', err);
      }
    }
  }

  public toggleLanguage(): void {
    this.setLanguage(this.currentLang === 'he' ? 'en' : 'he');
  }

  public t(key: string): string {
    const entry = strings[key];
    if (!entry) return key;
    return entry[this.currentLang] || entry['he'] || key;
  }

  public onChange(listener: (lang: Language) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const i18n = new I18nManager();
export const t = (key: string) => i18n.t(key);

/** Translates `key` and substitutes `{name}` placeholders. */
export const tf = (key: string, vars: Record<string, string | number>) =>
  i18n.t(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));

/** Localized "enabled"/"disabled" state word. */
export const onOff = (on: boolean) => t(on ? 'stateOn' : 'stateOff');
