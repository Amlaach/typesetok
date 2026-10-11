//! Realistic Document Fixtures for TypesetOK Validation & Hardening (Stage 9).
//!
//! Provides reproducible, realistic Hebrew documents for end-to-end testing,
//! regression suites, and benchmarks:
//! - Complex Talmud page layouts (Mishnah, Gemara, Rashi, Tosafot, Ein Mishpat)
//! - Mikraot Gedolot multi-stream parallel biblical commentaries (Torah, Targum, Rashi, Ramban)
//! - Ordinary Hebrew prose with hierarchical headings, orphan/widow constraints, and footnotes
//! - Difficult page break boundary tests with tight vertical budgets

use crate::co_pagination::{AnchorKey, CoPaginatedChunk, CoPaginatedCommentary, CoPaginationDocument};
use tok_core::id::FractionalIndex;
use tok_core::model::{DocumentRoot, Flow, FlowId, FlowType, ParagraphNode, SectionNode};
use tok_core::styles::ParagraphStyle;

/// Helper to generate sequential FractionalIndex keys.
fn next_fidx(prev: &mut Option<FractionalIndex>) -> FractionalIndex {
    let next = match FractionalIndex::between(prev.as_ref(), None) {
        Ok(idx) => idx,
        Err(_) => FractionalIndex::initial(),
    };
    *prev = Some(next.clone());
    next
}

/// Creates a realistic Talmud document (Tzurat HaDaf) based on Masekhet Berakhot 2a.
pub fn create_realistic_talmud_document() -> DocumentRoot {
    let mut doc = DocumentRoot::new("תלמוד בבלי — מסכת ברכות דף ב עמוד א");

    // Standard typographic styles
    let mut s_gemara = ParagraphStyle::default();
    s_gemara.id = "gemara".to_string();
    s_gemara.font_family = "Frank Ruhl Libre".to_string();
    s_gemara.font_weight = 700;
    s_gemara.font_size_pt = 13.0;
    s_gemara.line_height_pt = 18.0;

    let mut s_rashi = ParagraphStyle::default();
    s_rashi.id = "rashi".to_string();
    s_rashi.font_family = "Noto Rashi Hebrew".to_string();
    s_rashi.font_weight = 400;
    s_rashi.font_size_pt = 10.5;
    s_rashi.line_height_pt = 14.5;

    let mut s_tosafot = ParagraphStyle::default();
    s_tosafot.id = "tosafot".to_string();
    s_tosafot.font_family = "Noto Rashi Hebrew".to_string();
    s_tosafot.font_weight = 400;
    s_tosafot.font_size_pt = 10.0;
    s_tosafot.line_height_pt = 14.0;

    let mut s_notes = ParagraphStyle::default();
    s_notes.id = "notes".to_string();
    s_notes.font_family = "David Libre".to_string();
    s_notes.font_weight = 400;
    s_notes.font_size_pt = 8.5;
    s_notes.line_height_pt = 11.5;

    doc.paragraph_styles = vec![s_gemara, s_rashi, s_tosafot, s_notes];

    let mut sec = SectionNode::new("פרק ראשון — מאימתי", "chapter-first");
    sec.flows.clear();
    sec.layout_kind = Some("tzurat_hadaf".to_string());

    // 1. Central Gemara stream
    let mut gemara = Flow::new(FlowId::new("gemara"), FlowType::Main);
    gemara.placement_role = Some("primary".to_string());
    let mut p_idx = None;

    let gemara_texts = [
        "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.",
        "מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה, אָמְרוּ לוֹ: לֹא קָרִינוּ אֶת שְׁמַע! אָמַר לָהֶם: אִם לֹא עָלָה עַמּוּד הַשָּׁחַר, חַיָּבִין אַתֶּם לִקְרוֹת.",
        "וְלֹא זוֹ בִלְבַד, אֶלָּא כָּל מַה שֶׁאָמְרוּ חֲכָמִים עַד חֲצוֹת, מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. הֶקְטֵר חֲלָבִים וְאֵבָרִים מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.",
        "גְּמָרָא. תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא, לִתְנֵי דְּשַׁחֲרִית בְּרֵישָׁא?",
        "תַּנָּא אַקְּרָא קָאֵי, דִּכְתִיב: 'בְּשָׁכְבְּךָ וּבְקוּמֶךָ', וְהָכִי קָתָנֵי: זְמַן קְרִיאַת שְׁמַע דִּשְׁכִיבָה אֵימַת? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.",
    ];
    for t in gemara_texts {
        gemara.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "gemara", t));
    }
    sec.flows.push(gemara);

    // 2. Inner spine commentary (Rashi)
    let mut rashi = Flow::new(FlowId::new("rashi"), FlowType::CommentA);
    rashi.placement_role = Some("inner_spine".to_string());
    p_idx = None;

    let rashi_texts = [
        "מֵאֵימָתַי קוֹרִין — מֵאֵיזֶה זְמַן נִכְנָס תְּחִלַּת זְמַן קְרִיאַת שְׁמַע שֶׁל עַרְבִית, שֶׁיְּהֵא הָאָדָם רַשַּׁאי לִקְרוֹת לָצֵאת בָּהּ יְדֵי חוֹבָתוֹ שֶׁל חִיּוּב עַרְבִית.",
        "מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן — כֹּהֲנִים שֶׁנִּטְמְאוּ וְטָבְלוּ בַּיּוֹם וְהֶעֱרִיב שִׁמְשָׁן, שֶׁהוּא צֵאת הַכּוֹכָבִים, שֶׁהוּא תְּחִלַּת הַלַּיְלָה וְזְמַן אֲכִילַת תְּרוּמָה.",
        "עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה — שְׁלִישׁ הַלַּיְלָה, שֶׁהַלַּיְלָה נֶחֱלָק לְשָׁלֹשׁ אַשְׁמוּרוֹת, מִכָּאן וְאֵילָךְ עָבַר זְמַן שְׁכִיבָה וְאֵין הָאָדָם יוֹצֵא בָּהּ.",
        "עַד חֲצוֹת — כְּדֵי לְהַרְחִיק אֶת הָאָדָם מִן הָעֲבֵרָה, שֶׁלֹּא יֹאמַר עֲדַיִן יֵשׁ לִי שְׁהוּת וְיִשַׁן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.",
        "תַּנָּא הֵיכָא קָאֵי — בְּאֵיזֶה מָקוֹם עָמַד שֶׁהִתְחִיל לִשְׁאוֹל מֵאֵימָתַי, מַשְׁמַע שֶׁכְּבָר הִזְכִּיר חִיּוּב קְרִיאָה בְּשׁוּם מָקוֹם.",
        "אַקְּרָא קָאֵי — עַל פְּסוּקֵי קְרִיאַת שְׁמַע שֶׁבַּתּוֹרָה סָמַךְ, שֶׁנֶּאֱמַר בָּהֶם בְּשָׁכְבְּךָ וּבְקוּמֶךָ.",
    ];
    for t in rashi_texts {
        rashi.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "rashi", t));
    }
    sec.flows.push(rashi);

    // 3. Outer margin commentary (Tosafot)
    let mut tosafot = Flow::new(FlowId::new("tosafot"), FlowType::CommentB);
    tosafot.placement_role = Some("outer_margin".to_string());
    p_idx = None;

    let tosafot_texts = [
        "מֵאֵימָתַי קוֹרִין — תֵּימַהּ, אַמַּאי לָא פָּרֵישׁ תַּנָּא שִׁעוּר קְרִיאַת שְׁמַע שֶׁל שַׁחֲרִית תְּחִלָּה, כְּמוֹ שֶׁסִּדֵּר תְּפִלַּת שַׁחֲרִית וּמוּסָף וּמִנְחָה וּנְעִילָה.",
        "וְיֵשׁ לוֹמַר דְּסָמַךְ אַקְּרָא דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ, וּבְרִיָּתוֹ שֶׁל עוֹלָם נַמֵּי בְּעֶרֶב תְּחִלָּה, דִּכְתִיב וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד.",
        "וְאַף עַל גַּב דִּתְנַן בְּפֶרֶק קַמָּא דִּפְסָחִים אוֹר לְאַרְבָּעָה עָשָׂר בּוֹדְקִין אֶת הֶחָמֵץ לְאוֹר הַנֵּר, הָתָם נַמֵּי מִשּׁוּם דְּלֵילְיָא הוּא.",
    ];
    for t in tosafot_texts {
        tosafot.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "tosafot", t));
    }
    sec.flows.push(tosafot);

    // 4. Footnotes / Halakhic bottom band (Ein Mishpat)
    let mut notes = Flow::new(FlowId::new("notes"), FlowType::Footnote);
    notes.placement_role = Some("bottom_band".to_string());
    p_idx = None;

    let notes_texts = [
        "[א] מיימוני פ\"א מהלכות קריאת שמע הלכה ט ובטור אורח חיים סימן רל\"ה.",
        "[ב] סמ\"ג עשין י\"ח וטוש\"ע או\"ח סימן רל\"ה סעיף א ובבית יוסף שם.",
    ];
    for t in notes_texts {
        notes.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "notes", t));
    }
    sec.flows.push(notes);

    doc.sections.push(sec);
    doc
}

/// Creates a CoPaginationDocument with active anchors for multi-page co-pagination testing.
pub fn create_realistic_talmud_co_pagination_doc() -> CoPaginationDocument {
    let main_chunks = vec![
        CoPaginatedChunk {
            text: "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר.".to_string(),
            anchors: vec![
                (AnchorKey("a1".to_string()), "מֵאֵימָתַי קוֹרִין".to_string()),
                (AnchorKey("a2".to_string()), "שֶׁהַכֹּהֲנִים נִכְנָסִים".to_string()),
                (AnchorKey("a3".to_string()), "עַד סוֹף הָאַשְׁמוּרָה".to_string()),
            ],
        },
        CoPaginatedChunk {
            text: "וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה.".to_string(),
            anchors: vec![
                (AnchorKey("a4".to_string()), "עַד חֲצוֹת".to_string()),
                (AnchorKey("a5".to_string()), "עַמּוּד הַשָּׁחַר".to_string()),
            ],
        },
        CoPaginatedChunk {
            text: "תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא, לִתְנֵי דְּשַׁחֲרִית בְּרֵישָׁא? תַּנָּא אַקְּרָא קָאֵי דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ.".to_string(),
            anchors: vec![
                (AnchorKey("a6".to_string()), "תַּנָּא הֵיכָא קָאֵי".to_string()),
                (AnchorKey("a7".to_string()), "אַקְּרָא קָאֵי".to_string()),
            ],
        },
    ];

    let rashi_items = vec![
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a1".to_string()),
            text: "מאימתי קורין — מתחילת שעת חיוב שכיבה בערב.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a2".to_string()),
            text: "משעה שהכהנים נכנסים — צאת הכוכבים שהעריב שמשם וטהרו לתרומה.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a3".to_string()),
            text: "סוף האשמורה — שליש הלילה הראשון שהוא זמן שכיבה לרוב בני אדם.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a4".to_string()),
            text: "עד חצות — סייג כדי להרחיק את האדם מן העבירה שלא ישקע בשינה.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a6".to_string()),
            text: "תנא היכא קאי — על איזה לימוד קדם סמך דבריו שהתחיל כאן במאימתי.".to_string(),
        },
    ];

    let tosafot_items = vec![
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a1".to_string()),
            text: "מאימתי קורין — תימה למה לא פתח בשחרית כמנהג העולם.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a4".to_string()),
            text: "וחכמים אומרים עד חצות — ואף על גב דמן התורה עד עמוד השחר.".to_string(),
        },
        CoPaginatedCommentary {
            target_anchor: AnchorKey("a6".to_string()),
            text: "תנא היכא קאי — משום דברייתו של עולם בערב תחילה נקט ערבית.".to_string(),
        },
    ];

    CoPaginationDocument {
        main_chunks,
        rashi_items,
        tosafot_items,
    }
}

/// Creates a realistic Mikraot Gedolot document (4 parallel column streams: Torah, Onkelos, Rashi, Ramban).
pub fn create_realistic_mikraot_gedolot_document() -> DocumentRoot {
    let mut doc = DocumentRoot::new("מקראות גדולות — בראשית פרק א");

    let mut sec = SectionNode::new("סדר בראשית", "mikraot-page");
    sec.flows.clear();
    sec.layout_kind = Some("parallel_columns".to_string());
    sec.column_proportions = Some(vec![0.30, 0.20, 0.25, 0.25]);

    let mut p_idx = None;

    // Stream 1: Torah text (Hebrew)
    let mut torah = Flow::new(FlowId::new("torah"), FlowType::Main);
    torah.placement_role = Some("column_0".to_string());
    let torah_verses = [
        "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ.",
        "וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל פְּנֵי הַמָּיִם.",
        "וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר.",
        "וַיַּרְא אֱלֹהִים אֶת הָאוֹר כִּי טוֹב וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ.",
    ];
    for v in torah_verses {
        torah.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "torah-style", v));
    }
    sec.flows.push(torah);

    // Stream 2: Targum Onkelos (Aramaic)
    let mut onkelos = Flow::new(FlowId::new("onkelos"), FlowType::Main);
    onkelos.placement_role = Some("column_1".to_string());
    p_idx = None;
    let onkelos_verses = [
        "בְּקַדְמִין בְּרָא יְיָ יָת שְׁמַיָּא וְיָת אַרְעָא.",
        "וְאַרְעָא הֲוָת צַדְיָא וְרֵיקַנְיָא וַחֲשׁוֹכָא עַל אַפֵּי תְהוֹמָא וְרוּחָא מִן קֳדָם יְיָ מְנַשְּׁבָא עַל אַפֵּי מַיָּא.",
        "וַאֲמַר יְיָ יְהֵי נְהוֹרָא וַהֲוָה נְהוֹרָא.",
        "וַחֲזָא יְיָ יָת נְהוֹרָא אֲרֵי טָב וְאַפְרֵשׁ יְיָ בֵּין נְהוֹרָא וּבֵין חֲשׁוֹכָא.",
    ];
    for v in onkelos_verses {
        onkelos.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "onkelos-style", v));
    }
    sec.flows.push(onkelos);

    // Stream 3: Rashi
    let mut rashi = Flow::new(FlowId::new("rashi"), FlowType::CommentA);
    rashi.placement_role = Some("column_2".to_string());
    p_idx = None;
    let rashi_comm = [
        "בְּרֵאשִׁית — אָמַר רַבִּי יִצְחָק: לֹא הָיָה צָרִיךְ לְהַתְחִיל אֶת הַתּוֹרָה אֶלָּא מֵ'הַחֹדֶשׁ הַזֶּה לָכֶם', שֶׁהִיא מִצְוָה רִאשׁוֹנָה שֶׁנִּצְטַוּוּ בָּהּ יִשְׂרָאֵל.",
        "תֹּהוּ וָבֹהוּ — תֹּהוּ לְשׁוֹן תְּמִיהָה וְשִׁמָּמוֹן, שֶׁאָדָם תּוֹהֶה וּמִשְׁתּוֹמֵם עַל בֹּהוּ שֶׁבָּהּ.",
        "יְהִי אוֹר — לֹא הֻצְרַךְ לְמַעֲשֶׂה אֶלָּא אָמַר וְנִהְיָה כִּרְצוֹנוֹ הַטּוֹב.",
    ];
    for c in rashi_comm {
        rashi.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "rashi-style", c));
    }
    sec.flows.push(rashi);

    // Stream 4: Ramban
    let mut ramban = Flow::new(FlowId::new("ramban"), FlowType::CommentB);
    ramban.placement_role = Some("column_3".to_string());
    p_idx = None;
    let ramban_comm = [
        "בְּרֵאשִׁית — דַּע כִּי כָּל הַנִּבְרָאִים מִשָּׁמַיִם וָאָרֶץ לֹא נִבְרְאוּ יֵשׁ מֵאַיִן גָּמוּר אֶלָּא בָּרָא חֹמֶר דַּק מְאֹד נִקְרָא הִיּוּלִי.",
        "וְהִנֵּה בַּבְּרִיאָה הָרִאשׁוֹנָה יָצָא הַהִיּוּלִי מִן הָאַיִן הַגָּמוּר וּמִמֶּנּוּ נוֹצְרוּ כָּל הַגְּשָׁמִים.",
    ];
    for c in ramban_comm {
        ramban.add_paragraph(ParagraphNode::new(next_fidx(&mut p_idx), "ramban-style", c));
    }
    sec.flows.push(ramban);

    doc.sections.push(sec);
    doc
}

/// Creates a realistic Hebrew prose document with headings, subheadings, and footnotes.
pub fn create_realistic_prose_document(num_chapters: usize) -> DocumentRoot {
    let mut doc = DocumentRoot::new("מבוא לטיפוגרפיה עברית מתקדמת");

    let mut s_h1 = ParagraphStyle::default();
    s_h1.id = "h1".to_string();
    s_h1.font_size_pt = 18.0;
    s_h1.line_height_pt = 26.0;
    s_h1.space_before_pt = 24.0;
    s_h1.space_after_pt = 12.0;
    s_h1.keep_with_next = true;

    let mut s_h2 = ParagraphStyle::default();
    s_h2.id = "h2".to_string();
    s_h2.font_size_pt = 14.0;
    s_h2.line_height_pt = 20.0;
    s_h2.space_before_pt = 16.0;
    s_h2.space_after_pt = 8.0;
    s_h2.keep_with_next = true;

    let mut s_body = ParagraphStyle::default();
    s_body.id = "body".to_string();
    s_body.font_size_pt = 11.0;
    s_body.line_height_pt = 15.0;
    s_body.space_before_pt = 0.0;
    s_body.space_after_pt = 6.0;
    s_body.orphan_control = 2;
    s_body.widow_control = 2;

    doc.paragraph_styles = vec![s_h1, s_h2, s_body];

    let mut sec = SectionNode::new("ספר ראשון", "prose-page");
    let flow = sec.main_flow_mut().unwrap();
    let mut p_idx = None;

    for ch in 1..=num_chapters {
        flow.add_paragraph(ParagraphNode::new(
            next_fidx(&mut p_idx),
            "h1",
            &format!("פרק {}: עקרונות העימוד והטיפוגרפיה העברית", crate::gematria::GematriaEngine::to_hebrew_numeral(ch)),
        ));

        flow.add_paragraph(ParagraphNode::new(
            next_fidx(&mut p_idx),
            "h2",
            "סעיף א: יישור שורות תלת-שלבי והרחבת אותיות אהלתר\"ם",
        ));

        flow.add_paragraph(ParagraphNode::new(
            next_fidx(&mut p_idx),
            "body",
            "הטיפוגרפיה העברית המסורתית מאופיינת בשימוש ביישור קצוות מדויק. בשונה מן השפות הלטיניות, שבהן נעשה שימוש במקף בסוף השורה, במסורת העברית נמנעו משימוש במקפים בספרי קודש, ותחת זאת הרחיבו אותיות נבחרות המכונות אהלתר\"ם (אל\"ף, ה\"א, למ\"ד, תי\"ו, רי\"ש, מ\"ם סופית, דל\"ת וכ\"ף סופית).",
        ));

        flow.add_paragraph(ParagraphNode::new(
            next_fidx(&mut p_idx),
            "body",
            "אלגוריתם קנות'-פלאס (Knuth-Plass) מספק פתרון אופטימלי גלובלי לשבירת שורות בפסקה, על ידי חישוב פונקציית עונשין ואי-נוחות (Badness) המונעת 'נהרות של לבן' ומבטיחה מראה אחיד ומאוזן של הטקסט.",
        ));
    }

    doc.sections.push(sec);
    doc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_realistic_talmud_document_structure() {
        let doc = create_realistic_talmud_document();
        assert_eq!(doc.sections.len(), 2);
        let sec = &doc.sections[1];
        assert_eq!(sec.flows.len(), 4);
        assert_eq!(sec.layout_kind.as_deref(), Some("tzurat_hadaf"));

        let gemara = sec.flows.iter().find(|f| f.id == FlowId::new("gemara")).unwrap();
        assert!(!gemara.paragraphs.is_empty());
        assert_eq!(gemara.placement_role.as_deref(), Some("primary"));

        let rashi = sec.flows.iter().find(|f| f.id == FlowId::new("rashi")).unwrap();
        assert_eq!(rashi.placement_role.as_deref(), Some("inner_spine"));

        let tosafot = sec.flows.iter().find(|f| f.id == FlowId::new("tosafot")).unwrap();
        assert_eq!(tosafot.placement_role.as_deref(), Some("outer_margin"));
    }

    #[test]
    fn test_create_realistic_mikraot_gedolot_document_structure() {
        let doc = create_realistic_mikraot_gedolot_document();
        let sec = &doc.sections[1];
        assert_eq!(sec.flows.len(), 4);
        assert_eq!(sec.layout_kind.as_deref(), Some("parallel_columns"));
        assert_eq!(sec.column_proportions, Some(vec![0.30, 0.20, 0.25, 0.25]));
    }

    #[test]
    fn test_create_realistic_prose_document_headings_and_orphans() {
        let doc = create_realistic_prose_document(3);
        let h1_style = doc.paragraph_styles.iter().find(|s| s.id == "h1").unwrap();
        assert!(h1_style.keep_with_next);
        let body_style = doc.paragraph_styles.iter().find(|s| s.id == "body").unwrap();
        assert_eq!(body_style.orphan_control, 2);
        assert_eq!(body_style.widow_control, 2);
    }
}
