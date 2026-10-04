import { TypesetOkApp, toHebrewGematria } from './app';
import { t } from './i18n';
import { PageDescriptor } from 'tok-viewer';
import { StoryParagraph } from 'tok-story-editor';

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


// Bootstrap TypesetOK Workbench
window.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('Missing #app container');
    return;
  }

  const app = new TypesetOkApp(appContainer);
  (window as any).tokApp = app;

  // Load Initial Hebrew demo document
  app.loadDocumentPages(generateDemoPageDescriptors(12));

  // Load the same text into the continuous Story Editor
  app.loadStory(getStoryParagraphs());
  // Startup milestone (read by the opt-in startup trace in tok-electron/main.ts)
  performance.mark('tok-ui-built');

  const runAction = (action: unknown, data?: unknown) => {
    if (typeof action === 'string' && action) app.handleSystemAction(action, data);
  };

  // Hook into IPC bridge if running inside Electron
  const tokIpc = (window as any).tokIpc;
  if (tokIpc) {
    app.showToast(t('toastShellConnected'));
    // Native menu actions from the main process
    tokIpc.onEvent?.((payload: any) => {
      if (payload && typeof payload === 'object') runAction(payload.action, payload.data);
    });
  } else {
    console.log('[TOK] Running in standalone web preview mode');
  }

  // Global window listener for custom dispatch
  window.addEventListener('tok-action', ((e: CustomEvent) => {
    runAction(e.detail?.action, e.detail?.data);
  }) as EventListener);
});