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
  topBarSearchPlaceholder: { he: 'חיפוש פקודה בסביבת העבודה...', en: 'Search workspace commands...' },
  topBarViewCanvas: { he: 'קנבס עמודים', en: 'Pages Canvas' },
  topBarViewSplit: { he: 'תצוגה מפוצלת', en: 'Split View' },
  topBarViewStory: { he: 'עורך סיפור רציף', en: 'Story Editor' },
  topBarExportPdf: { he: 'ייצוא קדם-דפוס (PDF/X)', en: 'Export Pre-Press (PDF/X)' },
  topBarSaved: { he: 'נשמר', en: 'Saved' },

  // Sidebar Tabs
  sidebarPages: { he: 'עמודים', en: 'Pages' },
  sidebarFlows: { he: 'תזרימים', en: 'Flows' },
  sidebarStyles: { he: 'סגנונות', en: 'Styles' },
  sidebarLayers: { he: 'שכבות', en: 'Layers' },
  sidebarSettings: { he: 'הגדרות', en: 'Settings' },
  sidebarAbout: { he: 'אודות', en: 'About' },
  sidebarAddPage: { he: 'הוספת עמוד', en: 'Add Page' },

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
  updatesStatusLatest: { he: 'הגרסה המותקנת היא העדכנית ביותר (v0.8.0)', en: 'You are using the latest version (v0.8.0)' },
  updatesStatusAvailable: { he: 'גרסה חדשה זמינה להורדה והתקנה', en: 'A newer version is available for download' },
  updatesCheckNow: { he: 'בדיקת עדכונים כעת', en: 'Check for Updates Now' },
  updatesAutoCheck: { he: 'בדיקת עדכונים אוטומטית בעת פתיחת התוכנה', en: 'Automatically check for updates on startup' },
  updatesDownload: { he: 'הורדת חבילת העדכון', en: 'Download Update Package' },

  // Plugins Settings
  pluginsInstalled: { he: 'הרחבות ותוספים מותקנים (JavaScript / TypeScript):', en: 'Installed Extensions (JavaScript / TypeScript):' },
  pluginsOpenFolder: { he: 'פתיחת תיקיית התוספים', en: 'Open Plugins Directory' },
  pluginsReload: { he: 'טעינה מחודשת של כל התוספים', en: 'Reload All Plugins' },
  pluginsEnabled: { he: 'פעיל', en: 'Enabled' },
  pluginsDisabled: { he: 'מושבת', en: 'Disabled' },
  pluginsNoPlugins: { he: 'לא נמצאו תוספים בתיקיית ההרחבות', en: 'No plugin extensions found' },

  // About Modal
  aboutTitle: { he: 'אודות TypesetOK', en: 'About TypesetOK' },
  aboutVersionLabel: { he: 'גרסת תוכנה:', en: 'Application Version:' },
  aboutCoreLabel: { he: 'מנוע עימוד מרחבי:', en: 'Typesetting Engine:' },
  aboutRustVersion: { he: 'Rust Native (אלגוריתם Knuth-Plass ויישור אהלתר״ם)', en: 'Rust Native (Knuth-Plass & Ahalterm Justifier)' },
  aboutShellLabel: { he: 'סביבת שולחן עבודה:', en: 'Desktop Shell:' },
  aboutShellValue: { he: 'Electron + Chromium Pre-Press Platform', en: 'Electron + Chromium Pre-Press Platform' },
  aboutGithubBtn: { he: 'מאגר הפרויקט ב-GitHub (קוד פתוח)', en: 'Project Repository on GitHub' },
  aboutClose: { he: 'סגירה', en: 'Close' },
};

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
  }

  public getLanguage(): Language {
    return this.currentLang;
  }

  public setLanguage(lang: Language): void {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    try {
      localStorage.setItem('tok_lang', lang);
    } catch {}

    // Update document HTML direction & lang
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

    for (const listener of this.listeners) {
      listener(lang);
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
