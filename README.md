<div align="center">

<img src="assets/logo.jpg" alt="TypesetOK Logo" width="140" style="border-radius: 16px; margin-bottom: 12px;" />

# TypesetOK (TOK)
### תוכנת עימוד שולחנית לספרים, טקסטים עבריים וספרי קודש
**A Modern Desktop Publishing (DTP) System for Hebrew Books & Sacred Texts**

[![Version](https://img.shields.io/badge/Version-0.3.30-2563eb.svg)](package.json)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-0078d4.svg?logo=windows&logoColor=white)]()
[![Engine](https://img.shields.io/badge/Engine-Rust%201.85%2B-dea584.svg?logo=rust&logoColor=white)](crates/tok-typeset)
[![Desktop](https://img.shields.io/badge/Desktop-Electron%20%7C%20TypeScript-3178c6.svg?logo=typescript&logoColor=white)](packages/tok-ui)
[![License](https://img.shields.io/badge/License-TOK--NCCL%20v1.1-f59e0b.svg)](LICENSE.md)

<p align="center">
  <img src="assets/icons/globe.svg" width="16" height="16" alt="Languages" valign="middle" />
  <b>[ <a href="#עברית">עברית</a> | <a href="#english">English</a> ]</b>
</p>

</div>

---

## 🇮🇱 עברית

### 📖 מה זה TypesetOK?
**TypesetOK (TOK)** היא תוכנת עימוד שולחנית מודרנית שנבנתה מתוך מטרה אחת ברורה: לאפשר עימוד מדויק, נקי ואיכותי של ספרים, טקסטים עבריים וספרי קודש, בחוויית משתמש פשוטה ונוחה.

במשך שנים רבות, עימוד מקצועי בעברית נשען על תוכנות מיושנות או על כלים יקרים ומסורבלים שלא תמיד מותאמים לצורכי הטיפוגרפיה העברית. TypesetOK מספקת סביבת עבודה עצמאית ונעימה – מהקלדת ועריכת הטקסט ועד הפקת קובץ PDF מוכן לקריאה ולהדפסה.

---

### ✨ מה אפשר לעשות עם TypesetOK?

#### 1. עימוד וטיפוגרפיה עברית
- **יישור שורות עברי טבעי:** שילוב של חלוקת רווחי מילים מאוזנת ומתיחת אותיות מתרחבות (אהלתר"ם: א, ה, ל, ת, ר, ם) לקבלת עמודי טקסט יפים ומיושרים.
- **שליטה מלאה בפסקאות:** הגדרת מרווחים מדויקים לפני ואחרי פסקה, כניסות שורה (אינדנטציה), ומניעת שורות יתומות.
- **כיווניות מימין לשמאל (RTL):** תמיכה מלאה וטבעית בטקסט עברי בכל חלקי התוכנה.

#### 2. טיפול מדויק בניקוד, טעמים וטקסט תורני
- **טקסט מנוקד וטעמי מקרא:** תמיכה מלאה בטקסט עם ניקוד מלא וטעמים ללא שיבושים גרפיים.
- **סדר יוניקוד תקני:** סידור ונרמול אוטומטי של תווי יוניקוד (אות בסיס, נקודות ש/שׂ, דגש, ניקוד וטעמים) למניעת קפיצות של סימני הניקוד.
- **מגן שמות קודש:** מניעת שבירת שורות בשמות קודש (איסור שבירה בשמות הויה ואדנות).
- **מספור עמודים עברי (גימטריה):** מספור עמודים אוטומטי באותיות עבריות לפי הכללים המסורתיים (כולל ט״ו, ט״ז, וסימון גרש/גרשיים תקני).

#### 3. סביבת עבודה חזותית ונוחה
- **תצוגת כפולות עמודים:** צפייה במסמך בפריסת ספר פתוח (עמוד ימני ועמוד שמאלי זה לצד זה).
- **עורך טקסט מובנה ותצוגה מפוצלת:** עריכת טקסט מהירה בחלון ייעודי, לצד תצוגה מקדימה של הדפים המתעדכנת תוך כדי הקלדה.
- **שליטה נוחה בתקריב (זום):** כפתורי תקריב, התאמה מהירה לגודל החלון, ותמיכה במחוות משטח מגע במחשבים ניידים (Pinch to Zoom והחלקה בשתי אצבעות).

#### 4. תבניות עימוד מוכנות מראש
- **ספר רציף:** פריסה קלאסית ונקייה לספרי קריאה, עיון והגות.
- **ספר עם הערות שוליים:** טקסט ראשי עם אזור הערות תחתון המתעדכן לפי הצורך.
- **עלון וקונטרס:** מבנה דו-טורי אלגנטי לעלוני שבת, חוברות ודפי מידע.
- **דף גמרא ומקראות גדולות:** פריסות תורניות רב-טוריות לטקסט ראשי ומפרשים מקבילים.

#### 5. שמירת פרויקטים וייצוא מהיר ל-PDF
- **ייצוא ישיר ל-PDF:** הפקת קובצי PDF וקטוריים וחדים ישירות מהתוכנה, מוכנים לצפייה, הדפסה ביתית או מסירה לדפוס.
- **פורמט קובץ פרויקט (`.tok`):** שמירה וטעינה פשוטה של כל הגדרות העימוד והטקסטים בקובץ אחד.

---

### 💻 איך מורידים ומתחילים לעבוד?

התוכנה מיועדת ל-Windows ומגיעה כגרסה שולחנית מוכנה להפעלה, ללא צורך בהתקנת כלי פיתוח:

1. **הורדה:** היכנסו לדף ה-[Releases ב-GitHub](https://github.com/TypesetOK/typesetok/releases) והורידו את הגרסה האחרונה:
   - קובץ התקנה: `TypesetOK-Setup.exe`
   - או חבילה ניידת: קובץ `.zip` לחילוץ ללא התקנה.
2. **הפעלה:**
   - בקובץ התקנה: הפעילו את האשף ועקבו אחר ההוראות.
   - בקובץ ZIP: חלצו את התיקייה ולחצו לחיצה כפולה על `TypesetOK.exe`.
3. **תחילת עבודה במסמך:**
   - במסך הפתיחה בחרו תבנית מוכנה (למשל "ספר רציף") או צרו מסמך חדש.
   - הדביקו או הקלידו את הטקסט שלכם.
   - כווננו שוליים, מרווחים וגופנים באמצעות סרגלי הכלים.
   - שמרו את הפרויקט (`Ctrl+S`) וייצאו ל-PDF בלחיצת כפתור (`Ctrl+E`).

---

### ⌨️ קיצורי מקשים נפוצים

| פעולה | קיצור מקשים (עברית / אנגלית) |
| :--- | :--- |
| **שמירת מסמך** | `Ctrl + S` / `Ctrl + ד` |
| **שמירה בשם** | `Ctrl + Shift + S` |
| **ייצוא ל-PDF** | `Ctrl + E` / `Ctrl + ק` |
| **תצוגת עמודים** | `Ctrl + 1` |
| **תצוגה מפוצלת (עורך + עמודים)** | `Ctrl + 2` |
| **עורך טקסט בלבד** | `Ctrl + 3` |
| **הגדלת זום** | `Ctrl + +` |
| **הקטנת זום** | `Ctrl + -` |
| **התאמת עמוד לחלון** | `Ctrl + 0` |
| **הוספת עמוד חדש** | `Ctrl + Enter` |
| **לוח פקודות ופעולות מהיר** | `Ctrl + K` |

---

### ❓ שאלות נפוצות (FAQ)

- **האם התוכנה חינמית?**  
  כן, לשימוש אישי, לימודי ולא-מסחרי (בהתאם לרישיון `TOK-NCCL v1.1`). שימוש מסחרי מוסדר בנפרד מול בעלי הזכויות.
- **האם צריך חיבור לאינטרנט?**  
  לא. TypesetOK היא תוכנה שולחנית מקומית (Offline). כל העבודה והמסמכים שלכם נשמרים אצלכם במחשב בלבד.
- **אילו גופנים כלולים בתוכנה?**  
  התוכנה כוללת גופנים עבריים איכותיים ברישיון חופשי (כגון Frank Ruhl Libre, Noto Rashi, David Libre ועוד), ומאפשרת שימוש בגופנים המותקנים במחשבכם.
- **באיזה שלב נמצא הפרויקט?**  
  התוכנה נמצאת בפיתוח פעיל (גרסה 0.10). נשמח מאוד לשמוע הערות, דיווחי תקלות ובקשות בדף ה-[Issues](https://github.com/TypesetOK/typesetok/issues).

---

### 🛠️ למפתחים: הרצה מקוד מקור

למעוניינים לתרום לקוד, לבנות עצמאית או להריץ סביבת פיתוח:

**דרישות:**
- [Node.js 20+](https://nodejs.org)
- [Rust 1.85+](https://www.rust-lang.org) עם Cargo

**הוראות הרצה:**
```bash
# שכפול המאגר
git clone https://github.com/TypesetOK/typesetok.git
cd typesetok

# התקנת תלויות צד-לקוח ובנייה
npm install
npm run build

# הרצת בדיקות
npm test
cargo test --workspace

# הפעלת האפליקציה השולחנית
npm start
```

---

### 📄 תנאי שימוש ורישיון

התוכנה מופצת תחת רישיון **[TOK-NCCL v1.1](LICENSE.md)** (TypesetOK Source-Available Non-Commercial Copyleft License):
- **שימוש אישי, לימודי ותורני לא-מסחרי:** מותר וחופשי.
- **נגזרות והרחבות:** כל גרסה נגזרת חייבת להישאר תחת אותו רישיון ובקוד מקור גלוי.
- **שימוש מסחרי:** מחייב רישיון מסחרי נפרד מיוצרי התוכנה.

---

## 🇺🇸 English

### 📖 What is TypesetOK?
**TypesetOK (TOK)** is a modern desktop publishing (DTP) application designed for typesetting Hebrew books, literature, and traditional sacred texts.

Instead of relying on legacy monolithic software or overly complex design suites, TypesetOK offers a clean, visual, and approachable desktop workspace tailored specifically to the unique needs of Hebrew typography and book publishing.

---

### ✨ Key Features

- **Hebrew Typography & Layout:** Natural right-to-left (RTL) text flow, balanced justification with traditional expanding letters (Ahalterm: א, ה, ל, ת, ר, ם), paragraph margins, and orphan control.
- **Niqqud & Cantillation Support:** High-fidelity rendering of vocalized Hebrew text, automated Unicode ordering for letters and diacritics to avoid displacement, divine names protection, and Hebrew page numbering (gematria).
- **Visual Workspace & Split View:** Two-page book spread canvas, integrated continuous text editor, real-time live preview, and smooth trackpad pinch-to-zoom gestures.
- **Ready-to-Use Templates:** Pre-configured layouts for continuous books, books with footnotes, two-column booklets and bulletins, and traditional study pages.
- **Direct PDF Export:** Generate crisp vector PDF files directly from the application ready for printing or digital reading.
- **Local & Offline:** Operates entirely offline on your computer. Your files and manuscripts remain private and stored on your disk.

---

### 💻 Getting Started (Windows)

1. **Download:** Head to the [Releases page](https://github.com/TypesetOK/typesetok/releases) and grab either the standalone ZIP or the setup installer (`TypesetOK-Setup.exe`).
2. **Launch:** Run `TypesetOK.exe` directly (no developer setup required).
3. **Start Layout:** Choose a template or create a blank document, write or paste your text, adjust margins and styles, save (`Ctrl+S`), and export to PDF (`Ctrl+E`).

---

### 🛠️ Developer Quickstart

```bash
# Clone repository
git clone https://github.com/TypesetOK/typesetok.git
cd typesetok

# Install dependencies and build
npm install
npm run build

# Run test suites
npm test
cargo test --workspace

# Launch desktop app
npm start
```

---

### 📄 License

TypesetOK is licensed under the **[TOK-NCCL v1.1](LICENSE.md)** (Source-Available Non-Commercial Copyleft License):
- **Free for Personal & Non-Commercial Use:** Personal study, community, and non-commercial publishing.
- **Share-Alike:** Modifications and derivative works must remain under the same license.
- **Commercial Use:** Requires a separate commercial license.
