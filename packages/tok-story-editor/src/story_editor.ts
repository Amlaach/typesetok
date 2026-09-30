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
    this.editorEl.style.outline = 'none';
    this.editorEl.style.padding = '24px';
    this.editorEl.style.fontFamily = '"Taamey Frank CLM", "David CLM", "SBL Hebrew", serif';
    this.editorEl.style.fontSize = '18px';
    this.editorEl.style.lineHeight = '1.6';
    this.editorEl.style.color = '#ffffff';

    this.container.appendChild(this.editorEl);

    this.editorEl.addEventListener('input', () => {
      this.handleInput();
    });
  }

  public loadStory(paragraphs: StoryParagraph[]): void {
    this.editorEl.innerHTML = '';
    for (const p of paragraphs) {
      const pEl = document.createElement('p');
      pEl.dataset.paraId = p.id;
      pEl.dataset.styleId = p.styleId;
      pEl.textContent = p.text;
      this.editorEl.appendChild(pEl);
    }
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
      const paraId = pEl.dataset.paraId;
      if (paraId && this.onTextChangeCallback) {
        this.onTextChangeCallback(paraId, pEl.textContent || '');
      }
    }
  }
}
