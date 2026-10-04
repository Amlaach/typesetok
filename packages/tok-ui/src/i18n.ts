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
  appTagline: { he: 'תוכנת עימוד מקצועית לטקסט עברי', en: 'Professional Hebrew Desktop Publishing System' },
  welcomeTitle: { he: 'ברוכים הבאים ל-TypesetOK', en: 'Welcome to TypesetOK' },
  welcomeSubtitle: { he: 'בחר פרויקט להתחלת עבודה או פתח מסמך קיים', en: 'Choose a project to start or open an existing document' },
  newProject: { he: 'פרויקט חדש', en: 'New Project' },
  openProject: { he: 'פתח מסמך קיים', en: 'Open Existing Document' },
  demoProject: { he: 'פרויקט לדוגמה (ש״ס ומפרשים)', en: 'Demo Project (Talmud & Commentaries)' },
  recentProjects: { he: 'פרויקטים אחרונים', en: 'Recent Projects' },
  showOnStartup: { he: 'הצג מסך זה בכל הפעלה של התוכנה', en: 'Show this screen every time the app starts' },
  noRecentProjects: { he: 'אין פרויקטים אחרונים עדיין', en: 'No recent projects yet' },

  // Templates
  templateGemara: { he: 'מסכת / צורת הדף', en: 'Talmud / Traditional Gemara' },
  templateGemaraDesc: { he: 'גמרא במרכז, רש״י ור״ן בפנים, תוספות בחוץ והערות למטה', en: 'Central Talmud text with surrounding commentaries and footnotes' },
  templateProse: { he: 'ספר קריאה / פרוזה', en: 'Reading Book / Prose' },
  templateProseDesc: { he: 'עימוד עמוד יחיד או כפול עם שוליים מאוזנים ויישור מלא', en: 'Single or spread layout with balanced margins and full justification' },
  templateBulletin: { he: 'חוברת / עלון שבת', en: 'Bulletin / Multi-Column' },
  templateBulletinDesc: { he: 'פריסה רב-טורית עם כותרות ביניים ותיבות צפות', en: 'Multi-column layout with section headers and floating callouts' },
  templateBlank: { he: 'מסמך ריק', en: 'Blank Document' },
  templateBlankDesc: { he: 'התחל מדף נקי בהתאמה אישית מלאה', en: 'Start from a clean canvas with custom dimensions' },

  // Top Bar & Navigation
  topBarProjects: { he: 'פרויקטים', en: 'Projects' },
  topBarSearchPlaceholder: { he: 'חיפוש פקודה מהירה...', en: 'Quick command search...' },
  topBarViewCanvas: { he: 'קנבס', en: 'Canvas' },
  topBarViewSplit: { he: 'מפוצל', en: 'Split' },
  topBarViewStory: { he: 'עורך סיפור', en: 'Story' },
  topBarExportPdf: { he: 'ייצוא PDF/X', en: 'Export PDF/X' },
  topBarSaved: { he: 'נשמר', en: 'Saved' },

  // Sidebar Tabs
  sidebarPages: { he: 'עמודים', en: 'Pages' },
  sidebarFlows: { he: 'תזרימים', en: 'Flows' },
  sidebarStyles: { he: 'סגנונות', en: 'Styles' },
  sidebarLayers: { he: 'שכבות', en: 'Layers' },
  sidebarSettings: { he: 'הגדרות', en: 'Settings' },
  sidebarAbout: { he: 'אודות', en: 'About' },
  sidebarAddPage: { he: 'עמוד חדש', en: 'Add Page' },

  // Settings
  settingsTitle: { he: 'הגדרות המערכת', en: 'System Settings' },
  settingsTabAppearance: { he: 'עיצוב ומראה', en: 'Appearance' },
  settingsTabLanguage: { he: 'שפה וכיוון', en: 'Language & RTL' },
  settingsTabLogs: { he: 'לוגים ותחזוקה', en: 'Logs & Maintenance' },
  settingsTabUpdates: { he: 'עדכוני תוכנה', en: 'Software Updates' },
  settingsTabPlugins: { he: 'מנהל תוספים', en: 'Plugin Manager' },

  // Appearance Settings
  appearanceAccentColor: { he: 'צבע הדגשה ראשי', en: 'Primary Accent Color' },
  appearanceCanvasTone: { he: 'גוון שולחן העבודה (Canvas)', en: 'Canvas Background Tone' },
  appearanceDensity: { he: 'צפיפות ממשק משתמש', en: 'UI Density' },
  densityComfortable: { he: 'מרווח ונוח', en: 'Comfortable' },
  densityCompact: { he: 'קומפקטי וממוקד', en: 'Compact' },

  // Language Settings
  languageSelect: { he: 'בחר שפת ממשק:', en: 'Select UI Language:' },
  languageHebrew: { he: 'עברית (RTL ימין לשמאל)', en: 'Hebrew (RTL Right-to-Left)' },
  languageEnglish: { he: 'English (LTR שמאל לימין)', en: 'English (LTR Left-to-Right)' },

  // Logs Settings
  logsRetentionLabel: { he: 'מחק אוטומטית קובצי לוגים ישנים יותר מ:', en: 'Automatically delete log files older than:' },
  logsRetentionDays: { he: 'ימים', en: 'days' },
  logsOpenFolder: { he: 'פתח תיקיית לוגים', en: 'Open Logs Folder' },
  logsCleanNow: { he: 'נקה לוגים ישנים כעת', en: 'Clean Old Logs Now' },
  logsRecentTitle: { he: 'לוגים אחרונים מהמערכת:', en: 'Recent System Logs:' },

  // Updates Settings
  updatesStatusChecking: { he: 'בודק מול השרת...', en: 'Checking with server...' },
  updatesStatusLatest: { he: 'אתה משתמש בגרסה העדכנית ביותר! (v0.8.0)', en: 'You are using the latest version! (v0.8.0)' },
  updatesStatusAvailable: { he: 'גרסה חדשה זמינה להורדה!', en: 'A new version is available for download!' },
  updatesCheckNow: { he: 'בדוק עדכונים כעת', en: 'Check for Updates Now' },
  updatesAutoCheck: { he: 'בדוק עדכונים אוטומטית בהפעלת התוכנה', en: 'Automatically check for updates on startup' },
  updatesDownload: { he: 'הורד עדכון', en: 'Download Update' },

  // Plugins Settings
  pluginsInstalled: { he: 'תוספים מותקנים (JS ו-TS):', en: 'Installed Plugins (JS & TS):' },
  pluginsOpenFolder: { he: 'פתח תיקיית תוספים', en: 'Open Plugins Folder' },
  pluginsReload: { he: 'טען תוספים מחדש', en: 'Reload Plugins' },
  pluginsEnabled: { he: 'פעיל', en: 'Enabled' },
  pluginsDisabled: { he: 'מושבת', en: 'Disabled' },
  pluginsNoPlugins: { he: 'לא נמצאו תוספים בתיקייה', en: 'No plugins found in directory' },

  // About Modal
  aboutTitle: { he: 'אודות TypesetOK', en: 'About TypesetOK' },
  aboutVersionLabel: { he: 'גרסה:', en: 'Version:' },
  aboutCoreLabel: { he: 'ליבת עימוד:', en: 'Typesetting Core:' },
  aboutRustVersion: { he: 'Rust Native (Knuth-Plass + Ahalterm)', en: 'Rust Native (Knuth-Plass + Ahalterm)' },
  aboutShellLabel: { he: 'סביבת ריצה:', en: 'Runtime Environment:' },
  aboutShellValue: { he: 'Electron + Chromium DTP Engine', en: 'Electron + Chromium DTP Engine' },
  aboutGithubBtn: { he: 'עבור למאגר הקוד ב-GitHub', en: 'Visit GitHub Repository' },
  aboutClose: { he: 'סגור', en: 'Close' },
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
