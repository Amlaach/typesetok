/**
 * Continuous Unpaginated Story Editor (Section 6.1).
 *
 * Dedicated editor panel decoupled from page geometry, similar to InDesign's Story Editor.
 * Allows authors to write and edit long texts with Niqqud without the overhead of page pagination.
 */

export interface StoryParagraph {
  id: string;
  styleId: string;
  text: string;
}

export class StoryEditor {
  private container: HTMLElement;
  private editorEl: HTMLDivElement;
  private onTextChangeCallback?: (paraId: string, newText: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.editorEl = document.createElement('div');
    this.editorEl.className = 'tok-story-editor-content';
    this.editorEl.dir = 'rtl';
    this.editorEl.contentEditable = 'true';
    this.editorEl.lang = 'he';
    // Pointed (niqqud) Hebrew is flagged almost word-by-word by the spellchecker.
    this.editorEl.spellcheck = false;
    this.editorEl.setAttribute('role', 'textbox');
    this.editorEl.setAttribute('aria-multiline', 'true');
    this.editorEl.setAttribute('aria-label', 'Story editor / עורך סיפור');
    this.editorEl.style.outline = 'none';
    this.editorEl.style.padding = '24px';
    this.editorEl.style.fontFamily = '"Taamey Frank CLM", "David CLM", "SBL Hebrew", serif';
    this.editorEl.style.fontSize = '18px';
    this.editorEl.style.lineHeight = '1.6';
    this.editorEl.style.color = '#ffffff';
    // The workbench sets `user-select: none` on <body>; without overriding it here the
    // editor's text cannot be selected (no drag-select, no Shift+Arrow, no copy).
    this.editorEl.style.userSelect = 'text';
    this.editorEl.style.setProperty('-webkit-user-select', 'text');

    this.container.appendChild(this.editorEl);

    this.editorEl.addEventListener('input', () => {
      this.handleInput();
    });
  }

  public loadStory(paragraphs: StoryParagraph[]): void {
    const frag = document.createDocumentFragment();
    for (const p of paragraphs) {
      const pEl = document.createElement('p');
      pEl.dataset.paraId = p.id;
      pEl.dataset.styleId = p.styleId;
      pEl.textContent = p.text;
      pEl.style.marginBottom = '12px';
      frag.appendChild(pEl);
    }
    this.editorEl.replaceChildren(frag);
  }

  /** Current paragraphs as edited (ids, style ids and plain text). */
  public getStory(): StoryParagraph[] {
    return Array.from(this.editorEl.querySelectorAll<HTMLElement>('p[data-para-id]')).map((p) => ({
      id: p.dataset.paraId as string,
      styleId: p.dataset.styleId || '',
      text: p.textContent || '',
    }));
  }

  public onTextChange(cb: (paraId: string, newText: string) => void): void {
    this.onTextChangeCallback = cb;
  }

  private handleInput(): void {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    let node: Node | null = sel.anchorNode;
    while (node && node !== this.editorEl && node.nodeName !== 'P') {
      node = node.parentNode;
    }

    if (node && node.nodeName === 'P') {
      const pEl = node as HTMLParagraphElement;
      this.dedupeParagraphIds();
      const paraId = pEl.dataset.paraId;
      if (paraId && this.onTextChangeCallback) {
        this.onTextChangeCallback(paraId, pEl.textContent || '');
      }
    }
  }

  /**
   * Pressing Enter inside a paragraph makes Chromium split the <p> by cloning it,
   * data-para-id included. Both halves would then report the same id and each edit
   * would overwrite the other paragraph's text. The first occurrence keeps the id;
   * later copies get a fresh one.
   */
  private dedupeParagraphIds(): void {
    const seen = new Set<string>();
    const paragraphs = this.editorEl.querySelectorAll<HTMLElement>('p[data-para-id]');
    paragraphs.forEach((p) => {
      const id = p.dataset.paraId as string;
      if (seen.has(id)) {
        let n = 1;
        while (seen.has(`${id}.${n}`) || this.editorEl.querySelector(`p[data-para-id="${CSS.escape(`${id}.${n}`)}"]`)) n++;
        p.dataset.paraId = `${id}.${n}`;
      }
      seen.add(p.dataset.paraId as string);
    });
  }
}
