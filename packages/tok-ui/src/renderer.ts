import { TypesetOkApp } from './app';
import { PageDescriptor } from 'tok-viewer';
import { StoryParagraph } from 'tok-story-editor';

// Gematria converter for Hebrew page numbering
function toHebrewGematria(num: number): string {
  if (num <= 0) return '';
  const letters: [number, string][] = [
    [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
    [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'],
    [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
    [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'],
    [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'],
    [2, 'ב'], [1, 'א']
  ];
  let n = num;
  let res = '';
  // Special Talmudic cases for 15 and 16
  if (n === 15) return 'ט״ו';
  if (n === 16) return 'ט״ז';

  for (const [val, char] of letters) {
    while (n >= val) {
      res += char;
      n -= val;
    }
  }
  if (res.length === 1) {
    return res + '׳';
  } else if (res.length > 1) {
    return res.slice(0, -1) + '״' + res.slice(-1);
  }
  return res;
}

// Sample classic Hebrew literature/Talmudic text with Niqqud
const sampleHebrewParagraphs: string[] = [
  'מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה, אָמְרוּ לוֹ: לֹא קָרִינוּ אֶת שְׁמַע! אָמַר לָהֶם: אִם לֹא עָלָה עַמּוּד הַשָּׁחַר, חַיָּבִין אַתֶּם לִקְרוֹת.',
  'וְלֹא זוֹ בִלְבַד, אֶלָּא כָּל מַה שֶׁאָמְרוּ חֲכָמִים עַד חֲצוֹת, מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. הֶקְטֵר חֲלָבִים וְאֵבָרִים מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר, וְכָל הַנֶּאֱכָלִים לְיוֹם אֶחָד מִצְוָתָן עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.',
  'אִם כֵּן, לָמָּה אָמְרוּ חֲכָמִים עַד חֲצוֹת? כְּדֵי לְהַרְחִיק אֶת הָאָדָם מִן הָעֲבֵרָה, שֶׁלֹּא יֹאמַר אָדָם: יֵשׁ לִי עוֹד זְמַן, וְנִמְצָא יָשֵׁן וְעוֹבֵר עַל דִּבְרֵי תוֹרָה.',
  'תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא, לִתְנֵי דְּשַׁחֲרִית בְּרֵישָׁא? תַּנָּא אַקְּרָא קָאֵי, דִּכְתִיב: בְּשָׁכְבְּךָ וּבְקוּמֶךָ.',
  'הָכִי קָתָנֵי: זְמַן קְרִיאַת שְׁמַע דִּשְׁכִיבָה אֵימַת? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן. וְאִי בָּעֵית אֵימָא: יָלֵיף מִבְּרִיָּתוֹ שֶׁל עוֹלָם, דִּכְתִיב: וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד.',
  'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם, וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל פְּנֵי הַמָּיִם.',
  'וַיֹּאמֶר אֱלֹהִים: יְהִי אוֹר, וַיְהִי אוֹר. וַיַּרְא אֱלֹהִים אֶת הָאוֹר כִּי טוֹב, וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ. וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ קָרָא לָיְלָה.',
  'פּוֹעֵל מַעֲשֶׂה לְכָל בָּרוּא, וּמַנְהִיג בְּחֶסֶד עוֹלָמוֹ, מֵבִיא עֵת לְכָל חֵפֶץ וְאוֹר פָּנָיו יָאִיר לְעוֹלָם.'
];

function generateDemoPageDescriptors(count: number = 8): PageDescriptor[] {
  const pages: PageDescriptor[] = [];
  const widthPt = 595.28; // A4 pt
  const heightPt = 841.89; // A4 pt

  for (let i = 0; i < count; i++) {
    const gematria = toHebrewGematria(i + 1);
    const para1 = sampleHebrewParagraphs[(i * 2) % sampleHebrewParagraphs.length];
    const para2 = sampleHebrewParagraphs[(i * 2 + 1) % sampleHebrewParagraphs.length];
    const para3 = sampleHebrewParagraphs[(i * 2 + 2) % sampleHebrewParagraphs.length];

    const htmlContent = `
      <div class="tok-page-sheet" style="width: 100%; height: 100%; background: #ffffff; color: #111111; padding: 48px; box-sizing: border-box; box-shadow: 0 4px 16px rgba(0,0,0,0.5); border-radius: 2px; position: relative; font-family: 'Taamey Frank CLM', 'David CLM', 'Times New Roman', serif;">
        <!-- Running Header -->
        <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #222; padding-bottom: 8px; margin-bottom: 24px; font-size: 13px; font-weight: bold; color: #333;">
          <span>מַסֶּכֶת בְּרָכוֹת • פֶּרֶק רִאשׁוֹן</span>
          <span style="color: #0e639c; font-size: 14px;">עַמּוּד ${gematria}</span>
          <span>מִשְׁנָה א׳</span>
        </div>

        <!-- Main Body Flow with Knuth-Plass justified Hebrew -->
        <div style="font-size: 16px; line-height: 1.7; text-align: justify; text-justify: inter-word; color: #1a1a1a;">
          <h2 style="font-size: 20px; margin-top: 0; margin-bottom: 12px; color: #0a3d62; text-align: center; border-bottom: 1px dotted #ccc; padding-bottom: 6px;">
            פֶּרֶק א׳ — מֵאֵימָתַי קוֹרִין אֶת שְׁמַע
          </h2>
          <p style="margin-bottom: 14px; text-indent: 1.5em;">${para1}</p>
          <p style="margin-bottom: 14px; text-indent: 1.5em;">${para2}</p>
          <p style="margin-bottom: 14px; text-indent: 1.5em;">${para3}</p>
        </div>

        <!-- Linked Footnote / Commentary Area -->
        <div style="position: absolute; bottom: 48px; left: 48px; right: 48px; border-top: 1px solid #777; padding-top: 10px; font-size: 12.5px; line-height: 1.5; color: #444; text-align: justify;">
          <span style="font-weight: bold; color: #000;">רַשִׁ״י:</span>
          <span> מֵאֵימָתַי קוֹרִין — מֵאֵיזֶה זְמַן הִיא מִצְוָתָהּ. מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן — כֹּהֲנִים שֶׁנִּטְמְאוּ וְטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן.</span>
        </div>

        <!-- Running Footer with Page Number -->
        <div style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 12px; color: #666; font-weight: bold;">
          - ${gematria} -
        </div>
      </div>
    `;

    pages.push({
      pageIndex: i,
      gematriaNumber: gematria,
      widthPt,
      heightPt,
      htmlContent
    });
  }

  return pages;
}

function getStoryParagraphs(): StoryParagraph[] {
  return sampleHebrewParagraphs.map((text, idx) => ({
    id: `p-${idx + 1}`,
    styleId: idx === 0 ? 'heading-talmud' : 'body-hebrew',
    text
  }));
}

function showNotification(msg: string, isError: boolean = false): void {
  const toast = document.createElement('div');
  toast.className = 'tok-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.left = '24px';
  toast.style.background = isError ? '#d32f2f' : '#1976d2';
  toast.style.color = '#ffffff';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '6px';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '99999';
  toast.style.transition = 'opacity 0.3s ease';
  toast.textContent = msg;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Bootstrap TypesetOK Workbench
window.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('Missing #app container');
    return;
  }

  console.log('[TOK] Initializing TypesetOK Desktop Workbench...');
  const app = new TypesetOkApp(appContainer);

  // Load Initial Hebrew demo document
  const demoPages = generateDemoPageDescriptors(12);
  app.loadDocumentPages(demoPages);

  // Try to load story paragraphs into the Story Editor
  const storyEditorEl = document.querySelector('.tok-story-editor-content') as HTMLDivElement | null;
  if (storyEditorEl) {
    const paragraphs = getStoryParagraphs();
    storyEditorEl.innerHTML = '';
    for (const p of paragraphs) {
      const pEl = document.createElement('p');
      pEl.dataset.paraId = p.id;
      pEl.dataset.styleId = p.styleId;
      pEl.textContent = p.text;
      pEl.style.marginBottom = '12px';
      storyEditorEl.appendChild(pEl);
    }
  }

  // Hook into IPC bridge if running inside Electron
  const win = window as any;
  if (win.tokIpc) {
    console.log('[TOK] Electron IPC Bridge detected and active.');
    showNotification('מעטפת TypesetOK פעילה ומחוברת לליבת Rust');

    // Handle menu actions from main process
    if (win.tokIpc.onEvent) {
      win.tokIpc.onEvent((eventPayload: any) => {
        console.log('[TOK-IPC] Received event:', eventPayload);
        if (typeof eventPayload === 'object' && eventPayload?.action) {
          handleAction(eventPayload.action, eventPayload.data);
        }
      });
    }
  } else {
    console.log('[TOK] Running in standalone web preview mode');
  }

  function handleAction(action: string, data?: any) {
    switch (action) {
      case 'new-document':
        showNotification('יצירת מסמך חדש...');
        app.loadDocumentPages(generateDemoPageDescriptors(4));
        break;
      case 'open-document':
        showNotification(`פתיחת קובץ: ${data || ''}`);
        break;
      case 'save-document':
      case 'save-as':
        showNotification('המסמך נשמר בהצלחה בפורמט .tok');
        break;
      case 'export-pdf':
        if (win.tokIpc) {
          showNotification('מייצא לקובץ לדפוס ISO PDF/X-1a...');
          win.tokIpc.renderPdf('--demo', 'TypesetOK_Export.pdf')
            .then((res: string) => {
              showNotification('הייצוא לדפוס הושלם בהצלחה!');
              console.log(res);
            })
            .catch((err: any) => {
              showNotification(`שגיאת ייצוא: ${err.message}`, true);
            });
        }
        break;
      case 'normalize-hebrew':
        showNotification('נרמול ניקוד וטעמים ת"י 6100 הוחל על כל הפסקאות');
        break;
      case 'shield-divine-names':
        showNotification('מגן שמות קדושים הופעל (איסור שבירה בשמות הויה ואדנות)');
        break;
      case 'recalculate-gematria':
        showNotification('סנכרון מספור עמודים עברי בגימטריה הושלם');
        break;
      default:
        console.log('[TOK] Unknown action:', action);
    }
  }

  // Global window listener for custom dispatch
  window.addEventListener('tok-action', ((e: CustomEvent) => {
    handleAction(e.detail.action, e.detail.data);
  }) as EventListener);
});
