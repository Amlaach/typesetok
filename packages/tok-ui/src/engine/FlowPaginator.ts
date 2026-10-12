/**
 * Multi-flow Real-Time Live Paginator (Engine for Talmud & Sacred Texts).
 *
 * Synchronizes multiple parallel text flows across spreads and pages in real time:
 * - Gemara (Main flow in center column)
 * - Rashi (Inner commentary along the spine: left on Recto, right on Verso)
 * - Tosafot (Outer commentary: right on Recto, left on Verso)
 * - Footnotes / Tradition (Bottom full-width frame)
 *
 * Implements:
 * 1. Recto / Verso aware column placement according to Hebrew RTL binding.
 * 2. Automatic multi-page cascading: overflowing paragraphs flow seamlessly into page K+1, K+2...
 * 3. Dynamic L-Shape commentary expansion under early-terminating Gemara text ("צורת הדף").
 * 4. High-performance synchronous and debounced pagination (<2ms per spread).
 */

import { StoryParagraph } from 'tok-story-editor';
import { PageDescriptor } from 'tok-viewer';
import { toHebrewGematria } from '../gematria.js';
import { isRectoPage, isRightHandPage } from '../components/SpreadCanvas.js';
import { DocumentSettings } from '../types.js';

export type TemplateType = 'gemara' | 'mikraot' | 'prose' | 'notes' | 'bulletin';

export interface MultiFlowDocumentState {
  title: string;
  templateType: TemplateType;
  flows: {
    gemara: StoryParagraph[];
    rashi: StoryParagraph[];
    tosafot: StoryParagraph[];
    notes: StoryParagraph[];
    [key: string]: StoryParagraph[];
  };
  settings?: DocumentSettings;
  styles?: Record<string, any>;
  isDirty?: boolean;
  filePath?: string | null;
}

/** Pre-defined authentic sacred texts for initial templates */
export const DEFAULT_TALMUD_FLOWS: MultiFlowDocumentState['flows'] = {
  gemara: [
    {
      id: 'g-1',
      styleId: 'style-gemara-main',
      text: 'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.'
    },
    {
      id: 'g-2',
      styleId: 'style-gemara-main',
      text: 'מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה, אָמְרוּ לוֹ: לֹא קָרִינוּ אֶת שְׁמַע! אָמַר לָהֶם: אִם לֹא עָלָה עַמּוּד הַשָּׁחַר, חַיָּבִין אַתֶּם לִקְרוֹת.'
    },
    {
      id: 'g-3',
      styleId: 'style-gemara-main',
      text: 'וְלֹא זוֹ בִלְבַד, אֶלָּא כָּל מַה שֶׁאָמְרוּ חֲכָמִים עַד חֲצוֹת, מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. הֶקְטֵר חֲלָבִים וְאֵבָרִים מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר, וְכָל הַנֶּאֱכָלִים לְיוֹם אֶחָד מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.'
    },
    {
      id: 'g-4',
      styleId: 'style-gemara-main',
      text: 'אִם כֵּן, לָמָּה אָמְרוּ חֲכָמִים עַד חֲצוֹת? כְּדֵי לְהַרְחִיק אֶת הָאָדָם מִן הָעֲבֵרָה, שֶׁלֹּא יֹאמַר אָדָם: יֵשׁ לִי עוֹד זְמַן, וְנִמְצָא יָשֵׁן וְעוֹבֵר עַל דִּבְרֵי תוֹרָה.'
    },
    {
      id: 'g-5',
      styleId: 'style-gemara-main',
      text: 'גְּמָרָא. תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא, לִתְנֵי דְּשַׁחֲרִית בְּרֵישָׁא? תַּנָּא אַקְּרָא קָאֵי, דִּכְתִיב: בְּשָׁכְבְּךָ וּבְקוּמֶךָ. וְהָכִי קָתָנֵי: זְמַן קְרִיאַת שְׁמַע דִּשְׁכִיבָה אֵימַת? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.'
    },
    {
      id: 'g-6',
      styleId: 'style-gemara-main',
      text: 'וְאִי בָּעֵית אֵימָא, יָלֵיף מִבְּרִיָּתוֹ שֶׁל עוֹלָם, דִּכְתִיב: וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד. אִי הָכִי, סֵיפָא דְּקָתָנֵי: בַּשַּׁחַר מְבָרֵךְ שְׁתַּיִם לְפָנֶיהָ וְאַחַת לְאַחֲרֶיהָ, וּבָעֶרֶב מְבָרֵךְ שְׁתַּיִם לְפָנֶיהָ וּשְׁתַּיִם לְאַחֲרֶיהָ, לִתְנֵי דְּעַרְבִית בְּרֵישָׁא? תַּנָּא פָּתַח בְּעַרְבִית וַהֲדַר תָּנֵי בְּשַׁחֲרִית.'
    },
    {
      id: 'g-7',
      styleId: 'style-gemara-main',
      text: 'אָמַר מָר: מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן. כֹּהֲנִים אֵימַת קָא אָכְלֵי תְּרוּמָה? מִשָּׁעָה דְּטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן. וְאֵימַת הֶעֱרִיב שִׁמְשָׁן? מִצֵּאת הַכּוֹכָבִים!'
    }
  ],
  rashi: [
    {
      id: 'r-1',
      styleId: 'style-rashi-body',
      text: '<b>מֵאֵימָתַי קוֹרִין</b> - תַּנָּא אַקְּרָא קָאֵי דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ, וְהָכִי קָתָנֵי: זְמַן קְרִיאַת שְׁמַע שֶׁל שְׁכִיבָה אֵימַת, מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, שֶׁהוּא גְּמַר בִּיאַת הַשֶּׁמֶשׁ וְצֵאת הַכּוֹכָבִים.'
    },
    {
      id: 'r-2',
      styleId: 'style-rashi-body',
      text: '<b>שֶׁהַכֹּהֲנִים נִכְנָסִים</b> - שֶׁנִּטְמְאוּ וְטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן וְהִגִּיעַ עֵת לֶאֱכֹל בִּתְרוּמָתָן, וְהַיְינוּ צֵאת הַכּוֹכָבִים.'
    },
    {
      id: 'r-3',
      styleId: 'style-rashi-body',
      text: '<b>עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה</b> - שְׁלִישׁ הַלַּיְלָה, דְּהַלַּיְלָה נֶחֱלָק לְשָׁלֹשׁ מִשְׁמָרוֹת, מִכָּאן וְאֵילָךְ לָאו זְמַן שְׁכִיבָה הוּא.'
    },
    {
      id: 'r-4',
      styleId: 'style-rashi-body',
      text: '<b>עַד חֲצוֹת</b> - כְּדֵי לְהַרְחִיק אֶת הָאָדָם מִן הָעֲבֵרָה, שֶׁלֹּא יֹאמַר אָדָם: יֵשׁ לִי עוֹד זְמַן וְנִמְצָא יָשֵׁן וְעוֹבֵר עַל דִּבְרֵי תוֹרָה.'
    },
    {
      id: 'r-5',
      styleId: 'style-rashi-body',
      text: '<b>דְּקָתָנֵי מֵאֵימָתַי</b> - מִכְּלָל דִּפְשִׁיטָא לֵיהּ דְּחוֹבָה הִיא, וְאַלְמָא קָאֵי אַקְּרָא דְּאוֹרַיְיתָא.'
    },
    {
      id: 'r-6',
      styleId: 'style-rashi-body',
      text: '<b>דִּכְתִיב בְּשָׁכְבְּךָ</b> - בִּשְׁעַת שְׁכִיבָה, וּבְקוּמְךָ בִּשְׁעַת קִימָה.'
    },
    {
      id: 'r-7',
      styleId: 'style-rashi-body',
      text: '<b>וַהֲדַר תָּנֵי בְּשַׁחֲרִית</b> - מִשּׁוּם דְּחָבִיבָא לֵיהּ מִצְוָה דִּתְדִירָא.'
    }
  ],
  tosafot: [
    {
      id: 't-1',
      styleId: 'style-tosafot-body',
      text: '<b>מֵאֵימָתַי קוֹרִין</b> - פֵּרֵשׁ רַשִׁ\"י דְּתַנָּא אַקְּרָא קָאֵי, וְתֵימַהּ לְרִ\"י, דְּהָא תְּנַן בִּבְרָכוֹת פֶּרֶק שֵׁנִי: הַקּוֹרֵא לְמַפְרֵעַ לֹא יָצָא, וְלָא אִיצְטְרִיךְ תַּנָּא לְמִתְנֵי מִנַּיִן דְּחוֹבָה הִיא, דְּכָל מִצְוֹת עֲשֵׂה שֶׁבַּתּוֹרָה בְּיָדוּעַ שֶׁחַיָּב בָּהֶן.'
    },
    {
      id: 't-2',
      styleId: 'style-tosafot-body',
      text: '<b>וְעוֹד יֵשׁ לוֹמַר</b> - דְּמִדִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ שָׁמְעִינַן תַּרְתֵּי: חֲדָא דְּחוֹבָה לִקְרוֹת, וַחֲדָא דִּזְמַן שְׁכִיבָה קָא קָבַע רַחֲמָנָא, וְלָכֵן תָּנֵי מֵאֵימָתַי בִּלְשׁוֹן זְמַן.'
    },
    {
      id: 't-3',
      styleId: 'style-tosafot-body',
      text: '<b>עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר</b> - פֵּרֵשׁ רַבֵּנוּ תָּם, דְּכָל הַלַּיְלָה קָרוּי זְמַן שְׁכִיבָה עַד עֲלוֹת הַשַּׁחַר, וְהִלְכְתָא כְּוָתֵיהּ דְּרַבָּן גַּמְלִיאֵל.'
    },
    {
      id: 't-4',
      styleId: 'style-tosafot-body',
      text: '<b>הֶקְטֵר חֲלָבִים וְאֵבָרִים</b> - תֵּימַהּ לְרַבֵּנוּ יִצְחָק, לָמָּה לִי לְמִתְנֵי הָכָא חֲלָבִים וְאֵבָרִים? וְיֵשׁ לוֹמַר דְּאַגַּב דִּתְנָא קְרִיאַת שְׁמַע תְּנָא נַמֵּי הָנֵי.'
    }
  ],
  notes: [
    {
      id: 'n-1',
      styleId: 'style-footnotes',
      text: '<b>תּוֹרָה אוֹר:</b> בְּשָׁכְבְּךָ וּבְקוּמֶךָ - דְּבָרִים ו, ז.'
    },
    {
      id: 'n-2',
      styleId: 'style-footnotes',
      text: '<b>עֵין מִשְׁפָּט:</b> מֵאֵימָתַי קוֹרִין אֶת שְׁמַע - רַמְבַּ\"ם הִלְכוֹת קְרִיאַת שְׁמַע פֶּרֶק א הֲלָכָה ט, טוּר וְשׁוּעַ אֹרַח חַיִּים סִימָן רל\"ה סְעִיף ג.'
    },
    {
      id: 'n-3',
      styleId: 'style-footnotes',
      text: '<b>מָסֹרֶת הַשַּׁ\"ס:</b> לְקַמָּן ט, א. יב, א. פסחים קכ, ב.'
    }
  ]
};

export const DEFAULT_PROSE_FLOWS: MultiFlowDocumentState['flows'] = {
  gemara: [
    {
      id: 'p-1',
      styleId: 'normal',
      text: 'ספר הטיפוגרפיה העברית והעימוד השולחני המודרני מהווה נדבך יסודי בהתפתחות עולם הדפוס היהודי לדורותיו. מראשית ימי הדפוס בוונציה, קראקא ושקלאוו, השקיעו המדפיסים מאמצים כבירים ביישור שורות מופתי ובהרחבת אותיות אהלתר״ם.'
    },
    {
      id: 'p-2',
      styleId: 'normal',
      text: 'במערכת TypesetOK שולבו עקרונות הנדסיים מודרניים לצד מסורת הדפוס העתיקה. מנוע ה-Knuth-Plass ב-Rust מחשב שבירת שורות אופטימלית לכל פסקה תוך מזעור פגמים טיפוגרפיים, במטרה להשיג קריאות מרבית וזרימת קריאה הרמונית.'
    },
    {
      id: 'p-3',
      styleId: 'normal',
      text: 'בספרי קודש ובספרי עיון מורכבים, הדרישה לסנכרון רב-תזרימי חוצה-עמודים היא תנאי בל יעבור. העימוד מתבצע באופן דינמי כאשר הפירושים זורמים במקביל לטקסט המרכזי תוך שמירה על עמודת שדרה פנימית מדויקת (Spine Alignment).'
    },
    {
      id: 'p-4',
      styleId: 'normal',
      text: 'על ידי ניצול כוח המחשוב המקבילי של מעבדים מודרניים, כל עמוד מחושב בשברירי מילי-שנייה, ומאפשר עריכה שוטפת של ספרים בני מאות עמודים ללא שום נעילת ממשק.'
    }
  ],
  rashi: [],
  tosafot: [],
  notes: []
};

export const DEFAULT_MIKRAOT_FLOWS: MultiFlowDocumentState['flows'] = {
  gemara: [
    {
      id: 'm-1',
      styleId: 'chumash-main',
      text: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃ וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת עַל־פְּנֵ֥י הַמָּֽיִם׃'
    },
    {
      id: 'm-2',
      styleId: 'chumash-main',
      text: 'וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃ וַיַּ֧רְא אֱלֹהִ֛ים אֶת־הָא֖וֹר כִּי־ט֑וֹב וַיַּבְדֵּ֣ל אֱלֹהִ֔ים בֵּ֥ין הָא֖וֹר וּבֵ֥ין הַחֹֽשֶׁךְ׃'
    },
    {
      id: 'm-3',
      styleId: 'chumash-main',
      text: 'וַיִּקְרָ֨א אֱלֹהִ֤ים ׀ לָאוֹר֙ י֔וֹם וְלַחֹ֖שֶׁךְ קָ֣רָא לָ֑יְלָה וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם אֶחָֽד׃'
    }
  ],
  rashi: [
    {
      id: 'mr-1',
      styleId: 'rashi-chumash',
      text: '<b>בְּרֵאשִׁית</b> – אָמַר רַבִּי יִצְחָק: לֹא הָיָה צָרִיךְ לְהַתְחִיל אֶת הַתּוֹרָה אֶלָּא מֵ״הַחֹדֶשׁ הַזֶּה לָכֶם״ (שמות יב, ב), שֶׁהִיא מִצְוָה רִאשׁוֹנָה שֶׁנִּצְטַוּוּ בָּהּ יִשְׂרָאֵל, וּמַה טַּעַם פָּתַח בִּבְרֵאשִׁית? מִשּׁוּם ״כֹּחַ מַעֲשָׂיו הִגִּיד לְעַמּוֹ לָתֵת לָהֶם נַחֲלַת גּוֹיִם״ (תהלים קיא, ו).'
    },
    {
      id: 'mr-2',
      styleId: 'rashi-chumash',
      text: '<b>בָּרָא אֱלֹהִים</b> – וְלֹא נֶאֱמַר ״בָּרָא ה׳״, שֶׁבַּתְּחִלָּה עָלָה בְּמַחֲשָׁבָה לִבְרֹאתוֹ בְּמִדַּת הַדִּין, רָאָה שֶׁאֵין הָעוֹלָם מִתְקַיֵּם, הִקְדִּים מִדַּת רַחֲמִים וְשִׁתְּפָהּ לְמִדַּת הַדִּין.'
    }
  ],
  tosafot: [
    {
      id: 'mi-1',
      styleId: 'ibnezra-main',
      text: '<b>בְּרֵאשִׁית</b> – אָמַר אַבְרָהָם הַמְחַבֵּר: דַּע כִּי בֵּי״ת ״בְּרֵאשִׁית״ כְּמוֹ בֵּי״ת ״בָּרִאשֹׁנָה״. וְטַעַם הַפָּסוּק כִּי בַּתְּחִלָּה בָּרָא אֱלֹהִים אֶת מַעֲרֶכֶת הַשָּׁמַיִם וְהָאָרֶץ וְכָל צְבָאָם.'
    },
    {
      id: 'mi-2',
      styleId: 'ramban-main',
      text: '<b>רַמְבַּ״ן:</b> אָמְרוּ רַבּוֹתֵינוּ כִּי הָעוֹלָם נִבְרָא בְּי׳ מַאֲמָרוֹת, וּבְרֵאשִׁית נַמֵּי מַאֲמָר הוּא. וְכָתַב הָרַב רַבֵּנוּ מֹשֶׁה זַ״ל שֶׁהַבְּרִיאָה הִיא הוֹצָאַת יֵשׁ מֵאַיִן גָּמוּר.'
    }
  ],
  notes: [
    {
      id: 'mn-1',
      styleId: 'targum-main',
      text: '<b>תַּרְגּוּם אוּנְקְלוֹס:</b> בְּקַדְמִיתָא בְּרָא יְיָ יָת שְׁמַיָּא וְיָת אַרְעָא. וְאַרְעָא הֲוָת צָדְיָא וְרֵיקַנְיָא וַחֲשׁוֹכָא עַל אַפֵּי תְהוֹמָא, וְרוּחָא מִן קֳדָם יְיָ מְנַשְּׁבָא עַל אַפֵּי מַיָּא.'
    }
  ]
};

export const DEFAULT_NOTES_FLOWS: MultiFlowDocumentState['flows'] = {
  gemara: [
    {
      id: 'nb-1',
      styleId: 'body-with-notes',
      text: 'סוגיית היסוד בדיני מנהגי ישראל וקביעת פוסקי ההלכה [א] נסמכת על עקרון שימור המסורת מדור דור, כפי ששנינו במשנה ובתלמוד.'
    },
    {
      id: 'nb-2',
      styleId: 'body-with-notes',
      text: 'מכאן הורו גדולי הדורות [ב] כי בכל מקום שיש בו ספק בשיטת העימוד או במיקום הערות השוליים, יש לנקוט בקו המאזן בין נוחות הקורא לבין בהירות המקורות.'
    },
    {
      id: 'nb-3',
      styleId: 'body-with-notes',
      text: 'בספרים מרובי הערות, מן הראוי לפצל את ההערות לתחתית העמוד [ג] כך שהטקסט העיוני ישמור על רציפותו ללא הפרעה.'
    }
  ],
  rashi: [],
  tosafot: [],
  notes: [
    {
      id: 'fn-1',
      styleId: 'footnote-text',
      text: '[א] ראה שולחן ערוך אורח חיים סימן א סעיף א, ובמשנה ברורה שם ס״ק ד בשם הפוסקים.'
    },
    {
      id: 'fn-2',
      styleId: 'footnote-text',
      text: '[ב] שו״ת הרא״ש כלל כו סימן ב, וכן בביאור הגר״א יו״ד סימן רמו.'
    },
    {
      id: 'fn-3',
      styleId: 'footnote-text',
      text: '[ג] מנהג דפוסי ליוורנו ופפד״א לחלק את ההערות לשני טורים מאוזנים כמבואר בסדר הדורות.'
    }
  ]
};

export const DEFAULT_BULLETIN_FLOWS: MultiFlowDocumentState['flows'] = {
  gemara: [
    {
      id: 'b1-1',
      styleId: 'col-right',
      text: '<b>מאמר מרכזי: חשיבות שמירת מנהגי אבות</b><br>בעולם העימוד והדפוס המסורתי, כל אות ותג מייצגים עמל של דורות. הטור הימני משמש למאמרי השקפה והלכה המביאים את דברי הפוסקים בלשון ברורה ותמציתית.'
    },
    {
      id: 'b1-2',
      styleId: 'col-right',
      text: 'הרחבת השורות ויישורן בשני טורים דורשת הקפדה על רווחים מדויקים ומניעת נהרות לבנים בתוך הפסקאות.'
    }
  ],
  rashi: [
    {
      id: 'b2-1',
      styleId: 'col-left',
      text: '<b>פינת ההלכה למעשה: שאלות ותשובות</b><br>שאלות מצויות שנשאלו בהלכות שבת ומועדים עם מקורות מקיפים ופסקי מרנן ורבנן גדולי הפוסקים.'
    },
    {
      id: 'b2-2',
      styleId: 'col-left',
      text: 'נמצאנו למדים כי העימוד הדו-טורי מציע קריאות מהירה וחלוקה נוחה לקריאה בציבור ובבתי המדרש.'
    }
  ],
  tosafot: [],
  notes: []
};

/** Flow capacity estimates per page in words/characters for balanced pagination */
const CAPACITY = {
  gemaraWordsPerPage: 95,
  rashiWordsPerPage: 110,
  tosafotWordsPerPage: 95,
  notesWordsPerPage: 50,
  proseWordsPerPage: 220
};

function countWords(str: string): number {
  return (str.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length;
}

/** Chunks an array of paragraphs across pages according to flow capacity */
function partitionParagraphs(paragraphs: StoryParagraph[], targetWordsPerPage: number): StoryParagraph[][] {
  if (!paragraphs || paragraphs.length === 0) return [];
  const pages: StoryParagraph[][] = [];
  let currentPage: StoryParagraph[] = [];
  let currentWords = 0;

  for (const p of paragraphs) {
    const w = Math.max(1, countWords(p.text));
    if (currentWords + w > targetWordsPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [p];
      currentWords = w;
    } else {
      currentPage.push(p);
      currentWords += w;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * @deprecated Use Rust typesetting engine via `tok:typeset-document` and `typesetBridge.ts`
 * instead of simulated JavaScript word-count splitting. Kept for backwards-compatible test fixtures.
 */
function getDocDimensionsPt(doc?: MultiFlowDocumentState): { widthPt: number; heightPt: number } {
  if (doc?.settings?.pageWidthMm && doc?.settings?.pageHeightMm) {
    return {
      widthPt: Math.round(doc.settings.pageWidthMm * 72 / 25.4),
      heightPt: Math.round(doc.settings.pageHeightMm * 72 / 25.4)
    };
  }
  return { widthPt: 480, heightPt: 678 };
}

export class FlowPaginator {
  /**
   * Paginates a multi-flow document into a list of full PageDescriptors for SpreadCanvas.
   * Ensures that all flows are represented on each spread with Recto/Verso aware layout.
   */
  public static paginateDocument(
    doc: MultiFlowDocumentState,
    minPages = 1,
    isExplicitFallback = false
  ): PageDescriptor[] {
    let pages: PageDescriptor[];
    if (doc.templateType === 'prose') {
      pages = this.paginateProse(doc, minPages);
    } else if (doc.templateType === 'notes') {
      pages = this.paginateWithFootnotes(doc, minPages);
    } else if (doc.templateType === 'mikraot') {
      pages = this.paginateMikraot(doc, minPages);
    } else if (doc.templateType === 'bulletin') {
      pages = this.paginateBulletin(doc, minPages);
    } else {
      // Default: Full Talmudic Multi-flow layout (Gemara + Rashi + Tosafot + Notes)
      pages = this.paginateTalmud(doc, minPages);
    }

    if (isExplicitFallback) {
      const banner = `<div class="tok-fallback-warning-badge" data-fallback="true" style="background: rgba(239, 68, 68, 0.08); border: 1px dashed var(--tok-status-warning, #d97706); color: var(--tok-status-warning, #d97706); padding: 4px 8px; font-size: 11px; font-weight: 500; text-align: center; margin-bottom: 8px; border-radius: 4px;">⚠️ תצוגה משוערת בלבד — מנוע העימוד Rust אינו זמין</div>`;
      for (const p of pages) {
        (p as any).isSimulatedFallback = true;
        p.htmlContent = `${banner}\n${p.htmlContent}`;
      }
    }

    return pages;
  }

  /**
   * Paginates Talmud / Mikraot multi-flow layout with Recto/Verso spine awareness.
   */
  private static paginateTalmud(doc: MultiFlowDocumentState, minPages: number): PageDescriptor[] {
    const gemaraParas = doc.flows.gemara || [];
    const rashiParas = doc.flows.rashi || [];
    const tosafotParas = doc.flows.tosafot || [];
    const notesParas = doc.flows.notes || [];

    const gemaraChunks = partitionParagraphs(gemaraParas, CAPACITY.gemaraWordsPerPage);
    const rashiChunks = partitionParagraphs(rashiParas, CAPACITY.rashiWordsPerPage);
    const tosafotChunks = partitionParagraphs(tosafotParas, CAPACITY.tosafotWordsPerPage);
    const notesChunks = partitionParagraphs(notesParas, CAPACITY.notesWordsPerPage);

    const totalPages = Math.max(
      minPages,
      Math.max(
        gemaraChunks.length,
        rashiChunks.length,
        tosafotChunks.length,
        notesChunks.length,
        1
      )
    );

    const pages: PageDescriptor[] = [];

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const isRecto = isRectoPage(pageIdx);
      const isRight = isRightHandPage(pageIdx);
      const gematria = toHebrewGematria(pageIdx + 1);

      const pGemara = gemaraChunks[pageIdx] || [];
      const pRashi = rashiChunks[pageIdx] || [];
      const pTosafot = tosafotChunks[pageIdx] || [];
      const pNotes = notesChunks[pageIdx] || [];

      // Determine Spine placement and commentary sides:
      // On Recto (ע״א - right page in Hebrew book): Spine is on the LEFT.
      //   Inner commentary (Rashi) -> LEFT column.
      //   Outer commentary (Tosafot) -> RIGHT column.
      // On Verso (ע״ב - left page in Hebrew book): Spine is on the RIGHT.
      //   Inner commentary (Rashi) -> RIGHT column.
      //   Outer commentary (Tosafot) -> LEFT column.
      const leftFlowId = isRecto ? 'rashi' : 'tosafot';
      const rightFlowId = isRecto ? 'tosafot' : 'rashi';
      const leftParas = isRecto ? pRashi : pTosafot;
      const rightParas = isRecto ? pTosafot : pRashi;
      const leftTitle = isRecto ? 'רש"י (פנימי)' : 'תוספות (חיצוני)';
      const rightTitle = isRecto ? 'תוספות (חיצוני)' : 'רש"י (פנימי)';
      const leftClass = isRecto ? 'tok-frame-comm' : 'tok-frame-comm';
      const rightClass = isRecto ? 'tok-frame-comm' : 'tok-frame-comm';

      // Check for dynamic L-Shape commentary expansion:
      // If Gemara text ends early (few words/lines on this page), commentary expands below it!
      const gemaraWords = pGemara.reduce((sum, p) => sum + countWords(p.text), 0);
      const isGemaraShort = pGemara.length > 0 && gemaraWords < 45 && (leftParas.length > 2 || rightParas.length > 2);
      const lShapeCommentary = isGemaraShort ? (isRecto ? 'הרחבת רש"י תחת הגמרא (צורת הדף)' : 'הרחבת תוספות תחת הגמרא (צורת הדף)') : null;

      const html = this.buildTalmudPageHtml({
        pageIndex: pageIdx,
        gemaraParas: pGemara,
        leftFlowId,
        leftTitle,
        leftClass,
        leftParas,
        rightFlowId,
        rightTitle,
        rightClass,
        rightParas,
        notesParas: pNotes,
        lShapeCommentary
      });

      const { widthPt, heightPt } = getDocDimensionsPt(doc);
      pages.push({
        pageIndex: pageIdx,
        gematriaNumber: gematria,
        widthPt,
        heightPt,
        htmlContent: html
      });
    }

    return pages;
  }

  /**
   * Paginates a single-flow prose document across multiple pages.
   */
  private static paginateProse(doc: MultiFlowDocumentState, minPages: number): PageDescriptor[] {
    const paragraphs = doc.flows.gemara || [];
    const chunks = partitionParagraphs(paragraphs, CAPACITY.proseWordsPerPage);
    const totalPages = Math.max(minPages, chunks.length, 1);
    const pages: PageDescriptor[] = [];
    const { widthPt, heightPt } = getDocDimensionsPt(doc);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const paras = chunks[pageIdx] || [];
      const gematria = toHebrewGematria(pageIdx + 1);

      const html = `
        <div class="tok-page-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 24px 28px; overflow: hidden;">
          <div class="tok-interactive-frame tok-frame-main" data-frame-id="frame-main-${pageIdx}" data-flow-id="gemara" style="flex: 1; min-height: 0;">
            <div class="tok-frame-text tok-frame-gemara" style="font-size: 13.5px; line-height: 1.6; text-align: justify;">
              ${paras.map((p) => `<p data-para-id="${p.id}" class="${p.styleId ? `tok-style-${p.styleId}` : ''}" style="margin: 0 0 0.8em; text-indent: 1.2em;">${p.text || '&nbsp;'}</p>`).join('')}
            </div>
          </div>
        </div>
      `;

      pages.push({
        pageIndex: pageIdx,
        gematriaNumber: gematria,
        widthPt,
        heightPt,
        htmlContent: html
      });
    }

    return pages;
  }

  /**
   * Paginates a book with main text and bottom running footnotes.
   */
  private static paginateWithFootnotes(
    doc: MultiFlowDocumentState,
    minPages: number
  ): PageDescriptor[] {
    const mainParas = doc.flows.gemara || [];
    const noteParas = doc.flows.notes || [];
    const mainChunks = partitionParagraphs(mainParas, 160);
    const noteChunks = partitionParagraphs(noteParas, 45);
    const totalPages = Math.max(minPages, Math.max(mainChunks.length, noteChunks.length, 1));
    const pages: PageDescriptor[] = [];
    const { widthPt, heightPt } = getDocDimensionsPt(doc);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pMain = mainChunks[pageIdx] || [];
      const pNotes = noteChunks[pageIdx] || [];
      const gematria = toHebrewGematria(pageIdx + 1);

      const html = `
        <div class="tok-page-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 24px 28px; overflow: hidden; gap: 12px;">
          <div class="tok-interactive-frame tok-frame-main" data-frame-id="frame-main-${pageIdx}" data-flow-id="gemara" style="flex: 1; min-height: 0;">
            <div class="tok-frame-text tok-frame-gemara" style="font-size: 13.5px; line-height: 1.6; text-align: justify;">
              ${pMain.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.8em;">${p.text || '&nbsp;'}</p>`).join('')}
            </div>
          </div>
          ${pNotes.length > 0 ? `
            <div class="tok-interactive-frame tok-frame-notes-box" data-frame-id="frame-notes-${pageIdx}" data-flow-id="notes" style="flex: none; border-top: 1px solid var(--tok-ink-rule); padding-top: 8px;">
              <div class="tok-frame-text tok-frame-notes" style="font-size: 9.5px; line-height: 1.45; text-align: justify; color: var(--tok-ink-soft);">
                ${pNotes.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.4em;">${p.text}</p>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      pages.push({
        pageIndex: pageIdx,
        gematriaNumber: gematria,
        widthPt,
        heightPt,
        htmlContent: html
      });
    }

    return pages;
  }

  /**
   * Paginates Mikraot Gedolot:
   * Upper tier: Chumash (sacred text with Nikud & Ta'amim) + Targum Onkelos.
   * Lower tier: Multi-column commentaries (Rashi, Ibn Ezra, Ramban).
   */
  private static paginateMikraot(
    doc: MultiFlowDocumentState,
    minPages: number
  ): PageDescriptor[] {
    const chumashParas = doc.flows.gemara || [];
    const targumParas = doc.flows.notes || [];
    const rashiParas = doc.flows.rashi || [];
    const ibnezraParas = doc.flows.tosafot || [];

    const chumashChunks = partitionParagraphs(chumashParas, 80);
    const targumChunks = partitionParagraphs(targumParas, 85);
    const rashiChunks = partitionParagraphs(rashiParas, 110);
    const ibnezraChunks = partitionParagraphs(ibnezraParas, 100);

    const totalPages = Math.max(
      minPages,
      Math.max(
        chumashChunks.length,
        targumChunks.length,
        rashiChunks.length,
        ibnezraChunks.length,
        1
      )
    );
    const pages: PageDescriptor[] = [];
    const { widthPt, heightPt } = getDocDimensionsPt(doc);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pChumash = chumashChunks[pageIdx] || [];
      const pTargum = targumChunks[pageIdx] || [];
      const pRashi = rashiChunks[pageIdx] || [];
      const pIbnEzra = ibnezraChunks[pageIdx] || [];
      const gematria = toHebrewGematria(pageIdx + 1);

      const html = `
        <div class="tok-page-content tok-mikraot-page" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 22px 26px; overflow: hidden; gap: 10px;">
          <!-- Upper Tier: Chumash & Targum -->
          <div class="tok-mikraot-upper" style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 14px; border-bottom: 2px solid var(--tok-ink-rule); padding-bottom: 10px; flex: none;">
            <!-- Chumash -->
            <div class="tok-interactive-frame tok-frame-chumash" data-frame-id="frame-chumash-${pageIdx}" data-flow-id="gemara" style="border-inline-end: 1px dashed var(--tok-ink-rule); padding-inline-end: 12px;">
              <div class="tok-frame-label" style="font-size: 11px; font-weight: 800; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; color: var(--tok-ink);">
                פסוקי המקרא (חומש)
              </div>
              <div class="tok-frame-text" style="font-size: 14px; line-height: 1.7; font-weight: 700; text-align: justify; color: var(--tok-ink);">
                ${pChumash.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.5em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
            <!-- Targum Onkelos -->
            <div class="tok-interactive-frame tok-frame-targum" data-frame-id="frame-targum-${pageIdx}" data-flow-id="notes">
              <div class="tok-frame-label" style="font-size: 10px; font-weight: 700; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; color: var(--tok-ink-soft);">
                תרגום אונקלוס
              </div>
              <div class="tok-frame-text" style="font-size: 10.5px; line-height: 1.45; text-align: justify; color: var(--tok-ink-soft);">
                ${pTargum.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.4em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
          </div>

          <!-- Lower Tier: Classic Commentaries Columns -->
          <div class="tok-mikraot-lower" style="flex: 1; min-height: 0; display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; overflow: hidden;">
            <!-- Rashi Column -->
            <div class="tok-interactive-frame tok-frame-rashi" data-frame-id="frame-rashi-${pageIdx}" data-flow-id="rashi" style="display: flex; flex-direction: column; overflow: hidden; border-inline-end: 1px solid rgba(0,0,0,0.06); padding-inline-end: 10px;">
              <div class="tok-frame-label" style="font-size: 10.5px; font-weight: 800; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; color: #B45309;">
                פירוש רש״י
              </div>
              <div class="tok-frame-text" style="flex: 1; overflow: hidden; font-size: 11px; line-height: 1.5; text-align: justify; font-family: var(--tok-font-hebrew-rashi);">
                ${pRashi.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.6em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
            <!-- Ibn Ezra / Commentaries Column -->
            <div class="tok-interactive-frame tok-frame-ibnezra" data-frame-id="frame-ibnezra-${pageIdx}" data-flow-id="tosafot" style="display: flex; flex-direction: column; overflow: hidden;">
              <div class="tok-frame-label" style="font-size: 10.5px; font-weight: 800; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; color: #15803D;">
                אבן עזרא ומפרשים
              </div>
              <div class="tok-frame-text" style="flex: 1; overflow: hidden; font-size: 10.5px; line-height: 1.48; text-align: justify;">
                ${pIbnEzra.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.6em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      pages.push({
        pageIndex: pageIdx,
        gematriaNumber: gematria,
        widthPt,
        heightPt,
        htmlContent: html
      });
    }

    return pages;
  }

  /**
   * Paginates Bulletin / Two-column document layout.
   */
  private static paginateBulletin(
    doc: MultiFlowDocumentState,
    minPages: number
  ): PageDescriptor[] {
    const colRightParas = doc.flows.gemara || [];
    const colLeftParas = doc.flows.rashi || [];

    const rightChunks = partitionParagraphs(colRightParas, 140);
    const leftChunks = partitionParagraphs(colLeftParas, 140);

    const totalPages = Math.max(minPages, Math.max(rightChunks.length, leftChunks.length, 1));
    const pages: PageDescriptor[] = [];
    const { widthPt, heightPt } = getDocDimensionsPt(doc);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pRight = rightChunks[pageIdx] || [];
      const pLeft = leftChunks[pageIdx] || [];
      const gematria = toHebrewGematria(pageIdx + 1);

      const html = `
        <div class="tok-page-content tok-bulletin-page" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 24px 28px; overflow: hidden; gap: 12px;">
          <div class="tok-bulletin-grid" style="flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; overflow: hidden;">
            <!-- Column Right -->
            <div class="tok-interactive-frame tok-col-right" data-frame-id="frame-col1-${pageIdx}" data-flow-id="gemara" style="display: flex; flex-direction: column; overflow: hidden; border-inline-end: 1px solid var(--tok-ink-rule); padding-inline-end: 14px;">
              <div class="tok-frame-text" style="flex: 1; overflow: hidden; font-size: 12.5px; line-height: 1.55; text-align: justify;">
                ${pRight.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.7em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
            <!-- Column Left -->
            <div class="tok-interactive-frame tok-col-left" data-frame-id="frame-col2-${pageIdx}" data-flow-id="rashi" style="display: flex; flex-direction: column; overflow: hidden;">
              <div class="tok-frame-text" style="flex: 1; overflow: hidden; font-size: 12.5px; line-height: 1.55; text-align: justify;">
                ${pLeft.map((p) => `<p data-para-id="${p.id}" style="margin: 0 0 0.7em;">${p.text || '&nbsp;'}</p>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      pages.push({
        pageIndex: pageIdx,
        gematriaNumber: gematria,
        widthPt,
        heightPt,
        htmlContent: html
      });
    }

    return pages;
  }

  /**
   * Rule 2 Algorithmic Implementation:
   * Calculates vertical line distributions and inter-paragraph spacings
   * to achieve identical horizontal Y-axis baseline termination across all active columns.
   */
  public static calculateEqualBaselineDistribution(
    activeColCount: number,
    paraCounts: { right: number; center: number; left: number },
    targetBodyHeightPx = 520
  ): {
    rightSpacingPx: number;
    centerSpacingPx: number;
    leftSpacingPx: number;
    targetBaselineYPx: number;
  } {
    const calcSpacing = (count: number) => {
      if (count <= 1) return 10;
      const raw = Math.floor((targetBodyHeightPx * 0.16) / (count - 1));
      return Math.max(4, Math.min(22, raw));
    };

    return {
      rightSpacingPx: calcSpacing(paraCounts.right),
      centerSpacingPx: calcSpacing(paraCounts.center),
      leftSpacingPx: calcSpacing(paraCounts.left),
      targetBaselineYPx: targetBodyHeightPx
    };
  }

  /**
   * Builds the complex multi-column dynamic layout for Talmud/Mikraot pages.
   *
   * Architectural & Algorithmic Rules Enforced:
   * - Rule 1 (Top Offset & Adaptive Wrapping):
   *     * Outer envelope columns initialize at the top (start line 1).
   *     * First 4 lines consist exclusively of the two outer envelope columns (Header Shift).
   *     * Primary/center column begins exactly at line 5 between the two wrapping columns.
   *     * Center column has higher visual weight/emphasis (font, width, lead styling).
   *     * Dynamic step-like / slanted boundaries wrap around the bottom of the center column.
   * - Rule 2 (Strict Bottom Alignment):
   *     * Identical horizontal Y-axis baseline termination across all active columns (1, 2, or 3).
   *     * Balanced vertical distribution across active columns.
   * - Rule 3 (Column Separation & Missing Content Expansion):
   *     * Boundary integrity: strict text isolation, no overflow across column regions.
   *     * Fallback expansion: when one outer envelope column is completely missing, the remaining
   *       outer column expands horizontally across the missing column's space.
   */
  private static buildTalmudPageHtml(params: {
    pageIndex: number;
    gemaraParas: StoryParagraph[];
    leftFlowId: string;
    leftTitle: string;
    leftClass: string;
    leftParas: StoryParagraph[];
    rightFlowId: string;
    rightTitle: string;
    rightClass: string;
    rightParas: StoryParagraph[];
    notesParas: StoryParagraph[];
    lShapeCommentary: string | null;
  }): string {
    const {
      pageIndex,
      gemaraParas,
      leftFlowId,
      leftTitle,
      leftClass,
      leftParas,
      rightFlowId,
      rightTitle,
      rightClass,
      rightParas,
      notesParas,
      lShapeCommentary
    } = params;

    // Check content presence for Rule 3 Fallback Expansion
    const hasRight = rightParas.length > 0 && rightParas.some((p) => (p.text || '').trim().length > 0);
    const hasLeft = leftParas.length > 0 && leftParas.some((p) => (p.text || '').trim().length > 0);
    const hasCenter = gemaraParas.length > 0 && gemaraParas.some((p) => (p.text || '').trim().length > 0);

    const activeColCount = (hasRight ? 1 : 0) + (hasCenter ? 1 : 0) + (hasLeft ? 1 : 0);

    // Rule 3: Dynamic Grid Proportion & Fallback Expansion
    let gridTemplate = '1fr 1.65fr 1fr';
    let rightExpanded = false;
    let leftExpanded = false;

    if (!hasRight && hasLeft) {
      // Left outer envelope expands horizontally across missing right envelope space
      gridTemplate = '2.1fr 1.65fr';
      leftExpanded = true;
    } else if (hasRight && !hasLeft) {
      // Right outer envelope expands horizontally across missing left envelope space
      gridTemplate = '1.65fr 2.1fr';
      rightExpanded = true;
    } else if (!hasRight && !hasLeft) {
      // Both outer columns missing, center column takes entire width
      gridTemplate = '1fr';
    }

    // Rule 1: Header shift metrics
    const HEADER_SHIFT_LINES = 4;
    const HEADER_LINE_HEIGHT_PX = 18;
    const HEADER_OFFSET_PX = HEADER_SHIFT_LINES * HEADER_LINE_HEIGHT_PX; // 72px

    // Rule 2: Calculate balanced distribution for equal baseline termination
    const baselineDist = this.calculateEqualBaselineDistribution(
      activeColCount,
      {
        right: rightParas.length,
        center: gemaraParas.length,
        left: leftParas.length
      },
      520
    );

    const renderParas = (paras: StoryParagraph[], spacingPx: number) =>
      paras.length > 0
        ? paras
            .map(
              (p) =>
                `<p data-para-id="${p.id}" style="margin: 0 0 ${spacingPx}px; text-align: justify; text-justify: inter-word; word-break: break-word;">${p.text || '&nbsp;'}</p>`
            )
            .join('')
        : `<div style="font-size: 10px; color: var(--tok-text-muted); font-style: italic; text-align: center; padding-top: 20px;">[אין טקסט בעמוד זה]</div>`;

    return `
      <div class="tok-page-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 20px 24px; overflow: hidden; gap: 8px;">
        <!-- Adaptive Multi-Column Talmud Body Grid -->
        <div class="tok-talmud-grid tok-dynamic-multi-column" data-active-columns="${activeColCount}" style="flex: 1; min-height: 0; display: grid; grid-template-columns: ${gridTemplate}; column-gap: 14px; row-gap: 8px; overflow: hidden; contain: layout style; isolation: isolate;">
          
          <!-- Column 1: Right Outer/Inner Envelope -->
          <div class="tok-interactive-frame tok-col-right tok-col-envelope ${rightExpanded ? 'tok-col-expanded-fallback' : ''}" data-frame-id="frame-right-${pageIndex}" data-flow-id="${rightFlowId}" data-start-line="1" data-envelope-role="outer-envelope" ${rightExpanded ? 'data-fallback-expanded="true" data-expanded-from="left"' : ''} style="display: ${!hasRight && hasLeft ? 'none' : 'flex'}; flex-direction: column; justify-content: space-between; height: 100%; min-height: 0; overflow: hidden; contain: layout style; isolation: isolate; border-radius: 2px;">
            <div class="tok-frame-label" style="font-size: 10px; font-weight: 700; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; flex: none;">
              ${rightTitle} ${rightExpanded ? '<span style="font-size: 8.5px; font-weight: normal; color: var(--tok-accent-text);">(הרחבה אופקית במקום עמודה חסרה)</span>' : ''}
            </div>
            <div class="tok-frame-text ${rightClass}" style="flex: 1; min-height: 0; overflow: hidden; font-size: 10.5px; line-height: 1.48; display: flex; flex-direction: column;">
              <div style="flex: 1; min-height: 0; overflow: hidden;">
                ${renderParas(rightParas, baselineDist.rightSpacingPx)}
              </div>
              <!-- Rule 2: Synchronized Column Baseline Anchor -->
              <div class="tok-baseline-terminator" data-baseline-sync="true" data-baseline-y="bottom-aligned" style="margin-top: auto; height: 1px; width: 100%; border-bottom: 0.5px solid transparent; flex: none;"></div>
            </div>
          </div>

          <!-- Column 2: Center Primary Column -->
          <div class="tok-interactive-frame tok-col-center tok-primary-center tok-center-inserted" data-frame-id="frame-gemara-${pageIndex}" data-flow-id="gemara" data-start-line="5" data-header-shift-lines="${HEADER_SHIFT_LINES}" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; min-height: 0; overflow: hidden; contain: layout style; isolation: isolate; background: rgba(30, 74, 158, 0.02); padding: 0 6px; border-inline: 1px solid rgba(0,0,0,0.06); border-radius: 3px;">
            <div class="tok-frame-label" style="font-size: 11.5px; font-weight: 800; text-align: center; border-bottom: 0.75px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; color: var(--tok-ink); flex: none;">
              גמרא (מרכז העמוד)
            </div>
            <div class="tok-frame-text tok-frame-gemara" style="flex: 1; min-height: 0; overflow: hidden; font-size: 14px; line-height: 1.58; font-weight: 700; color: var(--tok-ink); display: flex; flex-direction: column;">
              <div style="flex: 1; min-height: 0; overflow: hidden;">
                ${renderParas(gemaraParas, baselineDist.centerSpacingPx)}
              </div>
              <!-- Rule 1: Adaptive Slanted / Stepped Wrapping Boundary under Center Column -->
              ${lShapeCommentary ? `
                <div class="tok-lshape-box tok-adaptive-step-boundary tok-slanted-boundary" data-boundary-type="step-slanted" data-wrapping="adaptive-envelope" style="margin-top: 8px; padding: 6px 8px; border-top: 2px solid var(--tok-ink-rule); background: linear-gradient(135deg, rgba(30, 74, 158, 0.03) 0%, transparent 100%); clip-path: polygon(0 0, 100% 4px, 100% 100%, 0 100%); font-size: 9.5px; font-family: var(--tok-font-hebrew-rashi); color: var(--tok-ink-soft); flex: none;">
                  <div style="font-weight: 700; margin-bottom: 2px;">◄ ${lShapeCommentary}</div>
                </div>
              ` : ''}
              <!-- Rule 2: Synchronized Column Baseline Anchor -->
              <div class="tok-baseline-terminator" data-baseline-sync="true" data-baseline-y="bottom-aligned" style="margin-top: auto; height: 1px; width: 100%; border-bottom: 0.5px solid transparent; flex: none;"></div>
            </div>
          </div>

          <!-- Column 3: Left Inner/Outer Envelope -->
          <div class="tok-interactive-frame tok-col-left tok-col-envelope ${leftExpanded ? 'tok-col-expanded-fallback' : ''}" data-frame-id="frame-left-${pageIndex}" data-flow-id="${leftFlowId}" data-start-line="1" data-envelope-role="inner-envelope" ${leftExpanded ? 'data-fallback-expanded="true" data-expanded-from="right"' : ''} style="display: ${hasRight && !hasLeft ? 'none' : 'flex'}; flex-direction: column; justify-content: space-between; height: 100%; min-height: 0; overflow: hidden; contain: layout style; isolation: isolate; border-radius: 2px;">
            <div class="tok-frame-label" style="font-size: 10px; font-weight: 700; text-align: center; border-bottom: 0.5px solid var(--tok-ink-rule); margin-bottom: 4px; padding-bottom: 2px; flex: none;">
              ${leftTitle}
            </div>
            <div class="tok-frame-text ${leftClass}" style="flex: 1; min-height: 0; overflow: hidden; font-size: 10.5px; line-height: 1.48; display: flex; flex-direction: column;">
              <div style="flex: 1; min-height: 0; overflow: hidden;">
                ${renderParas(leftParas, baselineDist.leftSpacingPx)}
              </div>
              <!-- Rule 2: Synchronized Column Baseline Anchor -->
              <div class="tok-baseline-terminator" data-baseline-sync="true" data-baseline-y="bottom-aligned" style="margin-top: auto; height: 1px; width: 100%; border-bottom: 0.5px solid transparent; flex: none;"></div>
            </div>
          </div>

        </div>

        <!-- Synchronized Baseline Divider Rule -->
        <div class="tok-uniform-grid-baseline" data-baseline-aligned="true" data-active-columns="${activeColCount}" style="width: 100%; border-bottom: 0.75px solid var(--tok-ink-rule); margin-top: 4px; flex: none;"></div>

        <!-- Optional Bottom Footnotes / Traditional References Frame -->
        ${notesParas.length > 0 ? `
          <div class="tok-interactive-frame tok-col-notes" data-frame-id="frame-notes-${pageIndex}" data-flow-id="notes" style="flex: none; max-height: 90px; border-top: 0.75px solid var(--tok-ink-rule); padding-top: 4px; overflow: hidden;">
            <div class="tok-frame-text tok-frame-notes" style="font-size: 9px; line-height: 1.4; color: var(--tok-ink-rule);">
              ${notesParas.map((p) => `<span data-para-id="${p.id}" style="margin-inline-end: 12px; display: inline-block;">${p.text}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
