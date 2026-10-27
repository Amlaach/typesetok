<div align="center">

<img src="assets/logo.jpg" alt="TypesetOK Logo" width="140" style="border-radius: 16px; margin-bottom: 12px;" />

# TypesetOK (TOK)
### תוכנת עימוד שולחנית לספרים, טקסטים עבריים וספרי קודש
**A Modern Desktop Publishing (DTP) System for Hebrew Books & Sacred Texts**

[![Version](https://img.shields.io/badge/Version-0.30.4-2563eb.svg)](package.json)
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

## <img src="assets/icons/globe.svg" width="22" height="22" alt="" valign="middle" /> עברית

### <img src="assets/icons/book.svg" width="20" height="20" alt="" valign="middle" /> מה זה TypesetOK?
**TypesetOK (TOK)** היא תוכנת עימוד שולחנית מודרנית שנבנתה מתוך מטרה אחת ברורה: לאפשר עימוד מדויק, נקי ואיכותי של ספרים, טקסטים עבריים וספרי קודש, בחוויית משתמש פשוטה ונוחה.

במשך שנים רבות, עימוד מקצועי בעברית נשען על תוכנות מיושנות או על כלים יקרים ומסורבלים שלא תמיד מותאמים לצורכי הטיפוגרפיה העברית. TypesetOK מספקת סביבת עבודה עצמאית ונעימה – מהקלדת ועריכת הטקסט ועד הפקת קובץ PDF מוכן לקריאה ולהדפסה.

---

### <img src="assets/icons/sparkle.svg" width="20" height="20" alt="" valign="middle" /> מה אפשר לעשות עם TypesetOK?

#### 1. עימוד וטיפוגרפיה עברית
- **יישור שורות עברי טבעי:** שילוב של חלוקת רווחי מילים מאוזנת, מתיחת אותיות מתרחבות (אהלתר״ם: א, ה, ל, ת, ר, ם) ואלגוריתם Knuth-Plass לשבירת שורות אופטימלית לקבלת עמודי טקסט יפים ומיושרים.
- **שליטה מלאה בפסקאות:** הגדרת מרווחים מדויקים לפני ואחרי פסקה, כניסות שורה (אינדנטציה), ומניעת שורות יתומות.
- **כיווניות מימין לשמאל (RTL):** תמיכה מלאה וטבעית בטקסט עברי בכל חלקי התוכנה, כולל שילוב ביטויים בלועזית (BiDi).

#### 2. טיפול מדויק בניקוד, טעמים וטקסט תורני
- **טקסט מנוקד וטעמי מקרא:** תמיכה מלאה בטקסט עם ניקוד מלא וטעמים ללא שיבושים גרפיים, עם עיצוב גופנים מתקדם (Font Shaping).
- **סדר יוניקוד תקני:** סידור ונרמול אוטומטי של תווי יוניקוד (אות בסיס, נקודות שׁ/שׂ, דגש, ניקוד וטעמים) למניעת קפיצות של סימני הניקוד.
- **מגן שמות קודש:** מניעת שבירת שורות ופיצול מילים בשמות קודש (איסור שבירה בשמות הוי״ה ואדנות).
- **מספור עמודים עברי (גימטריה):** מספור עמודים אוטומטי באותיות עבריות לפי הכללים המסורתיים (כולל ט״ו, ט״ז, וסימון גרש/גרשיים תקני).

#### 3. סביבת עבודה חזותית ונוחה
- **תצוגת כפולות עמודים:** צפייה במסמך בפריסת ספר פתוח (עמוד ימני ועמוד שמאלי זה לצד זה) המשקפת במדויק את גאומטריית העמודים.
- **עורך טקסט מובנה ותצוגה מפוצלת:** עריכת טקסט רציפה (Story Editor) בחלון ייעודי, לצד תצוגה מקדימה של הדפים המתעדכנת תוך כדי הקלדה.
- **שליטה נוחה בתקריב (זום):** כפתורי תקריב, התאמה מהירה לגודל החלון, ותמיכה במחוות משטח מגע במחשבים ניידים (Pinch to Zoom והחלקה בשתי אצבעות).

#### 4. יבוא מסמכים ותבניות עימוד מוכנות
- **יבוא טקסטים קל:** פתיחת מסמכי טקסט פשוטים (`.txt`), קובצי Markdown, או פרויקטי עבר.
- **ספר רציף:** פריסה קלאסית ונקייה לספרי קריאה, עיון והגות.
- **ספר עם הערות שוליים:** טקסט ראשי עם אזור הערות תחתון המתעדכן לפי הצורך.
- **עלון וקונטרס:** מבנה דו-טורי אלגנטי לעלוני שבת, חוברות ודפי מידע.
- **דף גמרא ומקראות גדולות:** פריסות תורניות רב-טוריות לטקסט ראשי ומפרשים מקבילים.

#### 5. שמירת פרויקטים וייצוא מהיר ל-PDF
- **ייצוא ישיר ל-PDF:** הפקת קובצי PDF וקטוריים וחדים ישירות ממנוע העימוד, הכוללים הטמעת גופנים (Font Subsetting), מוכנים לצפייה, הדפסה ביתית או מסירה לדפוס.
- **פורמט קובץ פרויקט (`.tok`):** שמירה וטעינה מהירה של כל הגדרות העימוד, הטיפוגרפיה והטקסטים בקובץ ארכיב אחד.

---

### <img src="assets/icons/download.svg" width="20" height="20" alt="" valign="middle" /> איך מורידים ומתחילים לעבוד?

התוכנה מיועדת ל-Windows ומגיעה כגרסה שולחנית מוכנה להפעלה, ללא צורך בהתקנת כלי פיתוח:

1. **הורדה:** היכנסו לדף ה-[Releases ב-GitHub](https://github.com/TypesetOK/typesetok/releases) והורידו את הגרסה האחרונה:
   - קובץ התקנה: `TypesetOK-Setup.exe`
   - או חבילה ניידת: קובץ `.zip` לחילוץ ללא התקנה.
2. **הפעלה:**
   - בקובץ התקנה: הפעילו את האשף ועקבו אחר ההוראות.
   - בקובץ ZIP: חלצו את התיקייה ולחצו לחיצה כפולה על `TypesetOK.exe`.
3. **תחילת עבודה במסמך:**
   - במסך הפתיחה בחרו תבנית מוכנה (למשל "ספר רציף") או צרו מסמך חדש.
   - הדביקו, הקלידו או יבאו (`Ctrl+I`) את הטקסט שלכם.
   - כווננו שוליים, מרווחים וגופנים באמצעות סרגלי הכלים.
   - שמרו את הפרויקט (`Ctrl+S`) וייצאו ל-PDF בלחיצת כפתור (`Ctrl+E`).

---

### <img src="assets/icons/keyboard.svg" width="20" height="20" alt="" valign="middle" /> קיצורי מקשים נפוצים

| פעולה | קיצור מקשים (עברית / אנגלית) |
| :--- | :--- |
| **מסמך חדש** | `Ctrl + N` |
| **פתיחת מסמך** | `Ctrl + O` |
| **יבוא מסמך (טקסט / Markdown)** | `Ctrl + I` |
| **שמירת מסמך** | `Ctrl + S` / `Ctrl + ד` |
| **שמירה בשם** | `Ctrl + Shift + S` |
| **ייצוא ל-PDF לדפוס** | `Ctrl + E` / `Ctrl + ק` |
| **ביטול פעולה (Undo)** | `Ctrl + Z` / `Ctrl + ז` |
| **ביצוע חוזר (Redo)** | `Ctrl + Y` |
| **תצוגת עמודים** | `Ctrl + 1` |
| **תצוגה מפוצלת (עורך + עמודים)** | `Ctrl + 2` |
| **עורך טקסט בלבד** | `Ctrl + 3` |
| **הגדלת זום** | `Ctrl + +` / `Ctrl + =` |
| **הקטנת זום** | `Ctrl + -` |
| **התאמת עמוד לחלון** | `Ctrl + 0` |
| **הוספת עמוד חדש** | `Ctrl + Enter` |
| **לוח פקודות ופעולות מהיר** | `Ctrl + K` |

---

### <img src="assets/icons/help.svg" width="20" height="20" alt="" valign="middle" /> שאלות נפוצות (FAQ)

- **האם התוכנה חינמית?**  
  כן, לשימוש אישי, לימודי ולא-מסחרי (בהתאם לרישיון `TOK-NCCL v1.1`). שימוש מסחרי מוסדר בנפרד מול בעלי הזכויות.
- **האם צריך חיבור לאינטרנט?**  
  לא. TypesetOK היא תוכנה שולחנית מקומית (Offline). כל העבודה והמסמכים שלכם נשמרים אצלכם במחשב בלבד.
- **אילו גופנים כלולים בתוכנה?**  
  התוכנה כוללת גופנים עבריים איכותיים ברישיון חופשי (כגון Frank Ruhl Libre, Noto Rashi, David Libre ועוד), ומאפשרת שימוש בגופנים המותקנים במחשבכם.
- **באיזה שלב נמצא הפרויקט?**  
  התוכנה נמצאת בפיתוח פעיל (גרסה 0.30.4). נשמח מאוד לשמוע הערות, דיווחי תקלות ובקשות בדף ה-[Issues](https://github.com/TypesetOK/typesetok/issues).

---

### <img src="assets/icons/layers.svg" width="20" height="20" alt="" valign="middle" /> מבנה המערכת והארכיטקטורה

TypesetOK בנויה בארכיטקטורה מודולרית המפרידה באופן קשיח בין חישובי הטיפוגרפיה לבין שכבת התצוגה השולחנית:

- **ליבת עימוד וטיפוגרפיה ב-Rust (`crates/`):**
  - `tok-core`: מודל המסמך (TDM), עץ היררכי דטרמיניסטי, היסטוריית שינויים וטרנזקציות ביטול/ביצוע חוזר (Undo/Redo).
  - `tok-typeset`: מנוע הפריסה הראשי, עיצוב גופנים מתקדם (HarfBuzz / rustybuzz), אלגוריתם Knuth-Plass לשבירת פסקאות, ויישור עברי מסורתי.
  - `tok-pdf`: הפקת קובצי PDF וקטוריים ישירים, הטמעת גופנים (Subsetting) ותמיכה בפורמטי קדם-דפוס.
  - `tok-storage`: ניהול ארכיב הפרויקט (`.tok`), דחיסה, ושמירה דטרמיניסטית.
  - `tok-cli` / `tok-ipc`: ממשק שורת פקודה ותקשורת בין-תהליכית (IPC) יעילה.
- **מעטפת שולחן עבודה ב-TypeScript & Electron (`packages/`):**
  - `tok-canvas`: קנבס תצוגה מהיר המציג כפולות עמודים על בסיס חישובי הפריסה המדויקים של הליבה.
  - `tok-story-editor`: עורך טקסט רציף מודרני המאפשר עבודה שוטפת על תוכן המסמך.
  - `tok-ui`: סביבת העבודה הראשית, סרגלי כלים, לוח פקודות (`Ctrl+K`), פאנלים וסגנונות.
  - `tok-electron`: מעטפת האפליקציה השולחנית המקומית ל-Windows.

---

### <img src="assets/icons/terminal.svg" width="20" height="20" alt="" valign="middle" /> למפתחים: הרצה מקוד מקור

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

### <img src="assets/icons/license.svg" width="20" height="20" alt="" valign="middle" /> תנאי שימוש ורישיון

התוכנה מופצת תחת רישיון **[TOK-NCCL v1.1](LICENSE.md)** (TypesetOK Source-Available Non-Commercial Copyleft License):
- **שימוש אישי, לימודי ותורני לא-מסחרי:** מותר וחופשי.
- **נגזרות והרחבות:** כל גרסה נגזרת חייבת להישאר תחת אותו רישיון ובקוד מקור גלוי.
- **שימוש מסחרי:** מחייב רישיון מסחרי נפרד מיוצרי התוכנה.

---

## <img src="assets/icons/globe.svg" width="22" height="22" alt="" valign="middle" /> English

### <img src="assets/icons/book.svg" width="20" height="20" alt="" valign="middle" /> What is TypesetOK?
**TypesetOK (TOK)** is a modern desktop publishing (DTP) application designed for typesetting Hebrew books, literature, and traditional sacred texts.

Instead of relying on legacy monolithic software or overly complex design suites, TypesetOK offers a clean, visual, and approachable desktop workspace tailored specifically to the unique needs of Hebrew typography and book publishing.

---

### <img src="assets/icons/sparkle.svg" width="20" height="20" alt="" valign="middle" /> Key Features

#### 1. Hebrew Typography & Advanced Typesetting
- **Natural Hebrew Justification:** Balanced word spacing combined with traditional expanding letters (Ahalterm: א, ה, ל, ת, ר, ם) and the Knuth-Plass optimal line-breaking algorithm to deliver harmonious, readable columns.
- **Paragraph & Flow Control:** Precise space before/after, first-line indentation, margin collapsing, and orphan/widow suppression.
- **Native RTL & Bidirectional Text:** Natural right-to-left layout across the entire environment, with seamless handling of embedded numbers and Latin phrases (Unicode BiDi).

#### 2. High-Fidelity Niqqud, Cantillation & Sacred Texts
- **Vocalization & Cantillation Marks:** Comprehensive rendering support for vocalized Hebrew (niqqud) and biblical cantillation accents (ta'amei ha-mikra) powered by advanced font shaping (rustybuzz / HarfBuzz).
- **Canonical Unicode Normalization:** Automated normalization and ordering (base character, shin/sin dot, dagesh, vowel, accent) preventing glyph collisions and floating diacritics.
- **Sacred Names Protection:** Guard against improper word splitting and line breaks across holy names (Tetragrammaton and divine names).
- **Hebrew Page Numbering (Gematria):** Automatic traditional Hebrew numeral conversion following standard liturgical conventions (including ט״ו, ט״ז, and formal gershayim punctuation).

#### 3. Visual Two-Page Spread & Live Workspace
- **Facing Pages (Spread Canvas):** Realistic two-page book spread reflecting the layout engine's exact geometry and margins.
- **Integrated Story Editor & Split View:** Distraction-free continuous text editing alongside a synchronized real-time typesetting canvas preview.
- **Fluid Zoom & Navigation:** Canvas zoom controls, fit-to-window preset, and multi-touch trackpad pinch-to-zoom and two-finger panning.

#### 4. Document Import & Ready-to-Use Templates
- **Effortless Document Import:** Seamlessly import plain text (`.txt`), Markdown files, or existing TypesetOK project documents (`.tok`).
- **Continuous Book:** Clean single-column layout for novels, essays, and continuous prose.
- **Book with Footnotes:** Main narrative with dynamic footnote frames anchored to citations.
- **Two-Column Booklet:** Elegant dual-column format for bulletins, pamphlets, and communal newsletters.
- **Talmud & Rabbinic Commentary:** Multi-flow page layouts designed for central text accompanied by surrounding commentaries (Tzurat HaDaf).

#### 5. Project Storage & Direct Vector PDF Export
- **Direct PDF Generation:** Output crisp vector PDF files directly from the layout engine, complete with font subsetting, ready for digital distribution or professional printing.
- **Unified Project Archive (`.tok`):** Comprehensive project container preserving document tree, typography settings, styles, and geometry.

---

### <img src="assets/icons/download.svg" width="20" height="20" alt="" valign="middle" /> Getting Started (Windows)

1. **Download:** Head to the [Releases page](https://github.com/TypesetOK/typesetok/releases) and grab either the standalone ZIP or the setup installer (`TypesetOK-Setup.exe`).
2. **Launch:** Run `TypesetOK.exe` directly (no developer setup required).
3. **Start Layout:** Choose a template or create a blank document, paste, type, or import (`Ctrl+I`) your text, adjust margins and styles, save (`Ctrl+S`), and export to PDF (`Ctrl+E`).

---

### <img src="assets/icons/keyboard.svg" width="20" height="20" alt="" valign="middle" /> Keyboard Shortcuts

| Action | Shortcut (English / Hebrew Layout) |
| :--- | :--- |
| **New Document** | `Ctrl + N` |
| **Open Document** | `Ctrl + O` |
| **Import Document (Text / Markdown)** | `Ctrl + I` |
| **Save Document** | `Ctrl + S` / `Ctrl + ד` |
| **Save As** | `Ctrl + Shift + S` |
| **Export to Print PDF** | `Ctrl + E` / `Ctrl + ק` |
| **Undo** | `Ctrl + Z` / `Ctrl + ז` |
| **Redo** | `Ctrl + Y` |
| **Pages View** | `Ctrl + 1` |
| **Split View (Editor + Pages)** | `Ctrl + 2` |
| **Text Editor View** | `Ctrl + 3` |
| **Zoom In** | `Ctrl + +` / `Ctrl + =` |
| **Zoom Out** | `Ctrl + -` |
| **Fit Page to Window** | `Ctrl + 0` |
| **Add New Page** | `Ctrl + Enter` |
| **Typesetting Command Palette** | `Ctrl + K` |

---

### <img src="assets/icons/help.svg" width="20" height="20" alt="" valign="middle" /> Frequently Asked Questions (FAQ)

- **Is TypesetOK free to use?**  
  Yes, for personal study, community, educational, and non-commercial publishing under the [TOK-NCCL v1.1](LICENSE.md) license. Commercial publishing or hosted typesetting services require a dedicated commercial license from the project authors.
- **Does it require an internet connection?**  
  No. TypesetOK is a 100% offline desktop application. Your manuscripts, documents, and data remain strictly local on your computer.
- **Which Hebrew fonts are included?**  
  The application includes high-quality open-source Hebrew typefaces (such as Frank Ruhl Libre, Noto Rashi Hebrew, David Libre, and Noto Serif Hebrew) licensed under the SIL Open Font License, and also supports local fonts installed on your operating system.
- **What is the current project status?**  
  TypesetOK is under active development (current release **v0.30.4**). Community feedback, bug reports, and typographical suggestions are welcomed on the GitHub [Issues](https://github.com/TypesetOK/typesetok/issues) page.

---

### <img src="assets/icons/layers.svg" width="20" height="20" alt="" valign="middle" /> Architecture & Technology Stack

TypesetOK features a decoupled architecture strictly separating high-performance typography computation from the desktop UI layer:

- **High-Performance Rust Core (`crates/`):**
  - `tok-core`: The Document Model (TDM) tree, transactional undo/redo history, and deterministic state management.
  - `tok-typeset`: The core layout and typography engine, HarfBuzz / rustybuzz font shaping, Knuth-Plass paragraph breaking, and Hebrew justification.
  - `tok-pdf`: Direct vector PDF generation with font subsetting and pre-press geometry boxes.
  - `tok-storage`: Project archive container (`.tok`), compression, and asset serialization.
  - `tok-cli` / `tok-ipc`: Native command-line interface and inter-process communication bridge.
- **Desktop Workbench in TypeScript & Electron (`packages/`):**
  - `tok-canvas`: High-performance facing-pages canvas accurately reflecting layout engine geometry.
  - `tok-story-editor`: Integrated distraction-free narrative editor for continuous writing.
  - `tok-ui`: Workbench shell, ribbon toolbars, command palette (`Ctrl+K`), inspector panels, and modals.
  - `tok-electron`: Native Windows desktop shell running fully offline.

---

### <img src="assets/icons/terminal.svg" width="20" height="20" alt="" valign="middle" /> Developer Quickstart

For contributors, building from source, or setting up a local development environment:

**Prerequisites:**
- [Node.js 20+](https://nodejs.org) and `npm`
- [Rust 1.85+](https://www.rust-lang.org) with Cargo

**Build & Run Instructions:**
```bash
# Clone repository
git clone https://github.com/TypesetOK/typesetok.git
cd typesetok

# Install dependencies and build TypeScript & UI bundle
npm install
npm run build

# Run test suites (TypeScript & Rust)
npm test
cargo test --workspace

# Launch desktop application
npm start
```

---

### <img src="assets/icons/license.svg" width="20" height="20" alt="" valign="middle" /> License

TypesetOK is licensed under the **[TOK-NCCL v1.1](LICENSE.md)** (Source-Available Non-Commercial Copyleft License):
- **Free for Personal & Non-Commercial Use:** Personal study, community, and non-commercial publishing.
- **Share-Alike:** Modifications and derivative works must remain under the same license.
- **Commercial Use:** Requires a separate commercial license.
