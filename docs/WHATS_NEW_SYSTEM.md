# מערכת "מה חדש" ויומן עדכונים (What's New & Changelog System)

מערכת מודרנית, דו-לשונית (עברית ואנגלית) לניהול וחשיפת חידושים ועדכונים למשתמשי TypesetOK.

---

## 🎯 עקרונות חוויית המשתמש (UX Principles)

1. **עדכונים גדולים (Major Releases):**
   - קופץ חלון פופ-אפ ייעודי (`MajorUpdateModal`) באופן אוטומטי בעליית התוכנה בפעם הראשונה לאחר העדכון.
   - החלון מעוצב כ-Hero Showcase חגיגי, עם כרטיסיות גריד המדגישות את גולת הכותרת של התכונות החדשות.
   - כולל תיבת סימון "אל תציג חלון זה שוב עבור גרסה זו", כפתור "לכל העדכונים והשינויים" (שפותח ישירות את החלונית המלאה), וכפתור סגירה ("הבנתי, תודה!").

2. **עדכונים קטנים (Minor & Patch Releases):**
   - **אינם מטרידים את המשתמש בפופ-אפ חודרני!**
   - מוצגים בחלונית צד ייעודית (`UpdatesDrawer`) הנפתחת בצורה אלגנטית ומאפשרת שיטוט נוח, סינון וחיפוש.
   - בסרגל המערכת העליון (`TopSystemBar`) מופיע כפתור פעמון/sparkle עם נקודת התראה כתומה פועמת (`tok-updates-unread-dot`) כשיש עדכון חדש שטרם נקרא. פתיחת החלונית מסמנת את העדכון כנצפה ומעלימה את האינדיקטור.

3. **דו-לשוניות מלאה (Full Bilingual RTL/LTR Support):**
   - כל הממשק, הכרטיסיות, התגיות, הסינונים והטקסטים מוגדרים במלואם הן בעברית והן באנגלית.
   - מעבר שפה באפליקציה (עברית ↔ אנגלית) מעדכן באופן מיידי את החלונית והפופ-אפ ואת כיווניות הגלישה והאנימציות (RTL מימין, LTR משמאל).

---

## 🏛️ מבנה הקוד והארכיטקטורה

המערכת בנויה ממודולים מופרדים ונקיים תחת `packages/tok-ui/src/`:

```
packages/tok-ui/src/
├── updates/
│   ├── types.ts              # טיפוסי נתונים, סכמות ChangelogEntry, UpdateImportance, ChangeCategory
│   ├── changelogData.ts      # מאגר נתוני הגרסאות ההיסטוריות והנוכחיות בעברית ובאנגלית
│   ├── updatesManager.ts     # שירות סטייט מרכזי: semver comparison, localStorage, unread tracking
│   ├── updatePills.ts        # רכיבי UI קטנים: תגיות קטגוריה ובאדג'י גרסה
│   ├── ChangelogEntryCard.ts # כרטיס גרסה מפורט עבור רשימת העדכונים
│   └── UpdatesBellButton.ts  # כפתור פעמון סרגל עליון עם אינדיקטור unread חי
├── components/
│   ├── UpdatesDrawer.ts      # חלונית צד (Side Drawer) לעיון מלא, סינון צ'יפים וחיפוש
│   └── MajorUpdateModal.ts   # פופ-אפ מודאלי להכרזה על שחרור גרסה ראשית
```

---

## 🚀 מחזור חיים בעליית התוכנה (Startup Lifecycle)

בעת פתיחת התוכנה (`TypesetOkApp.init`):
1. נקראת גרסת התוכנה הנוכחית (`getAppVersion`).
2. `UpdatesStateManager` משווה את הגרסה הנוכחית מול `lastSeenMajorVersion` ו-`lastSeenVersion` השמורים ב-`localStorage`:
   - **אם הגרסה היא `major`** וטרם הוצגה ולא נדחתה: נקראת `openMajorUpdate(version)` ומוצג הפופ-אפ.
   - **אם הגרסה היא `minor` / `patch`**: הפופ-אפ **לא** קופץ; כפתור הפעמון בסרגל העליון מדליק אינדיקטור עדכון ומזמין את המשתמש לעיין בחלונית בשעות הפנאי.

---

## 📝 כיצד להוסיף גרסה חדשה (Adding a New Release)

כדי לתעד גרסה חדשה, עורכים את `packages/tok-ui/src/updates/changelogData.ts` ומוסיפים רשומה בראש המערך `CHANGELOG_ENTRIES`:

```typescript
{
  version: '0.31.0',
  releaseDate: '2026-11-15',
  importance: 'major', // או 'minor' / 'patch'
  title: {
    he: 'כותרת העדכון בעברית',
    en: 'Update Title in English'
  },
  summary: {
    he: 'תקציר השינויים בעברית...',
    en: 'English summary of the changes...'
  },
  badge: {
    he: 'עדכון גדול',
    en: 'Major Release'
  },
  // שדה highlights חובה בגרסאות major:
  highlights: [
    {
      id: 'feature-id',
      title: { he: 'שם היכולת', en: 'Feature Name' },
      description: { he: 'תיאור מפורט', en: 'Detailed description' },
      icon: 'sparkle', // שם אייקון מתוך IconName
      badge: { he: 'חדש', en: 'New' }
    }
  ],
  changes: [
    {
      category: 'features', // 'features' | 'improvements' | 'fixes' | 'typography' | 'performance'
      text: { he: 'פירוט השינוי בעברית', en: 'English change description' },
      tag: { he: 'תכונה חדשה', en: 'New Feature' }
    }
  ]
}
```

---

## 🔍 פקודות בדיקה (Automated Tests)

המערכת מגובה ב-13 בדיקות יחידה ואינטגרציה ב-`test/whats_new_system.test.mjs`, הפועלות כחלק מסוויטת הבדיקות הרשמית של הפרויקט (`npm test`):
- שלמות מאגר הגרסאות ושדות חובה דו-לשוניים.
- דטרמיניסטיות השוואת Semver.
- לוגיקת החלטה בין פופ-אפ (Major) לחלונית (Minor).
- תקינות סינונים וחיפוש.
- כיסוי מפתחות i18n בעברית ובאנגלית.
- אינטגרציית רכיבי ה-UI (סרגל עליון, תפריטים, Command Palette).
