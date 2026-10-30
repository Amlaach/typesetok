import { ChangelogEntry } from './types';

/**
 * Built-in changelog registry for TypesetOK.
 * Entries are ordered descending by semantic version (newest first).
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '0.30.4',
    releaseDate: '2026-10-30',
    importance: 'minor',
    title: {
      he: 'עדכון שיפורים, טיפוגרפיה ותאימות מקלדת',
      en: 'Enhancements, Hebrew Typography & Keyboard Usability'
    },
    summary: {
      he: 'עדכון זה מביא תמיכה מלאה במשקלי גופן (Regular/Bold) בסרגל המבנה ובקנבס, שיפור במקשי קיצור במקלדת עברית ותיקוני יציבות.',
      en: 'This update brings font weight support (Regular/Bold) across inspector and canvas, Hebrew keyboard shortcut compatibility, and stability fixes.'
    },
    badge: {
      he: 'גרסה נוכחית',
      en: 'Current Version'
    },
    changes: [
      {
        category: 'typography',
        text: {
          he: 'תמיכה מובנית במשקלי גופן (Bold 700 / Regular 400) בגופנים עבריים ושימורם בייצוא',
          en: 'Native font weight support (Bold 700 / Regular 400) for Hebrew fonts with faithful export retention'
        },
        tag: { he: 'טיפוגרפיה', en: 'Typography' }
      },
      {
        category: 'improvements',
        text: {
          he: 'תאימות פלטת הפקודות (Ctrl+K) למקלדת עברית עם המקש "ל" ללא צורך בהחלפת שפה',
          en: 'Hebrew keyboard layout compatibility for Command Palette (Ctrl+K / Ctrl+ל)'
        },
        tag: { he: 'ממשק', en: 'UI' }
      },
      {
        category: 'fixes',
        text: {
          he: 'מניעת השתלטות של מקש הסלאש ("/") בזמן הקלדה חופשית בעורך הטקסט',
          en: 'Prevented slash key ("/") from hijacking story editor typing'
        },
        tag: { he: 'תיקון', en: 'Fix' }
      },
      {
        category: 'performance',
        text: {
          he: 'ייעול מנגנון הרינדור של מסגרות הטקסט בקנבס בצפיפויות מסך גבוהות',
          en: 'Optimized canvas text frame rendering on high DPI displays'
        },
        tag: { he: 'ביצועים', en: 'Performance' }
      }
    ]
  },
  {
    version: '0.30.0',
    releaseDate: '2026-10-15',
    importance: 'major',
    title: {
      he: 'שחרור גרסה ראשית: מנוע עימוד רב-תזרימי ותקני דפוס מקצועיים',
      en: 'Major Release: Multi-Flow Layout Engine & Professional Pre-Press'
    },
    summary: {
      he: 'קפיצת מדרגה משמעותית לתוכנת TypesetOK עם מנוע Rust Native מהיר, יישור עברי תלת-שכבתי, ייצוא ISO PDF/X-1a ומגן שמות קדושים.',
      en: 'A massive milestone for TypesetOK featuring a Rust Native engine, 3-tier Hebrew justification, ISO PDF/X-1a pre-press export, and holy name protection.'
    },
    badge: {
      he: 'עדכון גדול',
      en: 'Major Release'
    },
    highlights: [
      {
        id: 'rust-engine',
        title: {
          he: 'מנוע עימוד Rust מקורי',
          en: 'Native Rust Layout Engine'
        },
        description: {
          he: 'ליבת עימוד דטרמיניסטית וסופר-מהירה המבצעת שבירת שורות אופטימלית בשיטת Knuth-Plass על פני פסקאות עבריות שלמות.',
          en: 'Blazing fast deterministic layout engine running Knuth-Plass paragraph breaking across full Hebrew texts.'
        },
        icon: 'sparkle',
        badge: { he: 'מהיר פי 10', en: '10x Faster' }
      },
      {
        id: 'hebrew-justifier',
        title: {
          he: 'יישור עברי מסורתי תלת-שכבתי',
          en: '3-Tier Traditional Hebrew Justifier'
        },
        description: {
          he: 'שילוב עדין של רווחי מילים גמישים, מתיחת אותיות רפויות (אהלתר"ם) וריווח בין-אותי מיקרומטרי ללא צורך במקפים מכוערים.',
          en: 'Harmonious blending of word spacing, wide Hebrew letter dilation, and micro letter-spacing.'
        },
        icon: 'typography',
        badge: { he: 'דיוק טיפוגרפי', en: 'Typographic Precision' }
      },
      {
        id: 'pdf-x-export',
        title: {
          he: 'ייצוא תקני ISO PDF/X-1a ו-PDF/X-4',
          en: 'ISO PDF/X-1a & PDF/X-4 Pre-Press'
        },
        description: {
          he: 'הפקת קבצים מוכנים ישירות להדפסת אופסט ודפוס דיגיטלי מסחרי, עם הפרדת צבעים מלאה של 100% K לטקסט חד ונקי.',
          en: 'Production-ready PDF export for offset & digital printing, strict 100% pure black channel separation.'
        },
        icon: 'export',
        badge: { he: 'תקן דפוס', en: 'Print Standard' }
      },
      {
        id: 'sacred-text-shield',
        title: {
          he: 'קדושת הטקסט ונרמול קנוני',
          en: 'Sacred Text Shield & Canonical Normalization'
        },
        description: {
          he: 'מניעת שבירת שמות קדושים בכללי No-Break קפדניים, סנכרון גימטריה עברית לעמודים ונרמול סדר ניקוד וטעמים.',
          en: 'Strict no-break protection for divine names, Hebrew gematria page numbering, and canonical niqqud normalization.'
        },
        icon: 'check',
        badge: { he: 'מסורת ישראל', en: 'Traditional Rules' }
      }
    ],
    changes: [
      {
        category: 'features',
        text: {
          he: 'מבנה עמוד רב-תזרימי מלא עבור דפי גמרא (מרכז, רש"י, תוספות, הערות) ומקראות גדולות',
          en: 'Full multi-flow page architecture for Talmud pages and rabbinic commentaries'
        },
        tag: { he: 'תכונה חדשה', en: 'New Feature' }
      },
      {
        category: 'features',
        text: {
          he: 'ייצוא PDF/X-1a תקני עם פרופילי צבע Fogra 39 ו-ISO Coated v2',
          en: 'Compliant ISO PDF/X-1a export with Fogra 39 and ISO Coated v2 profiles'
        },
        tag: { he: 'דפוס', en: 'Pre-Press' }
      },
      {
        category: 'typography',
        text: {
          he: 'אלגוריתם מתיחת אותיות עבריות רפויות וריווח מילים גמיש',
          en: 'Hebrew dilated letter expansion and elastic word space distribution'
        },
        tag: { he: 'טיפוגרפיה', en: 'Typography' }
      },
      {
        category: 'improvements',
        text: {
          he: 'ניהול פרויקטים ומסך פתיחה חדש עם תבניות מהירות לספרים, עלונים וקונטרסים',
          en: 'Project manager and fresh welcome dashboard with quick templates for books and booklets'
        },
        tag: { he: 'ממשק', en: 'UI' }
      },
      {
        category: 'fixes',
        text: {
          he: 'תיקון חישוב גבולות עמודים בצמדי עמודים (Spreads) בספרים מימין לשמאל',
          en: 'Fixed page spread layout calculation for right-to-left Hebrew books'
        },
        tag: { he: 'תיקון', en: 'Fix' }
      }
    ]
  },
  {
    version: '0.29.0',
    releaseDate: '2026-09-20',
    importance: 'minor',
    title: {
      he: 'מערכת תוספים מודולרית ועורך טקסט משולב',
      en: 'Modular Plugin System & Integrated Story Editor'
    },
    summary: {
      he: 'הוספת סביבת הרחבות מבודדת ומאובטחת לתוספים ב-TypeScript/JavaScript, לצד עורך טקסט רציף (Story Editor) עם חיפוש והחלפה.',
      en: 'Introduced an isolated plugin architecture for TypeScript/JavaScript extensions alongside a split Story Editor.'
    },
    badge: {
      he: 'תוספים ועריכה',
      en: 'Plugins & Editing'
    },
    changes: [
      {
        category: 'features',
        text: {
          he: 'מנוע פלאגינים מאובטח (PluginEngine) עם הרשאות מוגדרות והידור בזמן ריצה',
          en: 'Hardened plugin sandbox engine with strict permission boundaries and runtime compilation'
        },
        tag: { he: 'תוספים', en: 'Plugins' }
      },
      {
        category: 'features',
        text: {
          he: 'עורך טקסט משולב בתצוגת Split View עם ספירת מילים חיה לכל תזרים',
          en: 'Integrated Story Editor with split view and live word counts per flow'
        },
        tag: { he: 'עריכה', en: 'Editor' }
      },
      {
        category: 'improvements',
        text: {
          he: 'ייבוא ישיר של קובצי Word (.docx), Markdown (.md) וטקסט רציף',
          en: 'Direct import pipeline for Word (.docx), Markdown (.md), and plain text'
        },
        tag: { he: 'ייבוא', en: 'Import' }
      },
      {
        category: 'fixes',
        text: {
          he: 'שיפור מנגנון שמירה אוטומטית ומניעת איבוד שינויים בעת יציאה',
          en: 'Enhanced auto-save safety checks and unsaved change prevention on quit'
        },
        tag: { he: 'יציבות', en: 'Stability' }
      }
    ]
  }
];
