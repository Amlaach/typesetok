/**
 * Continuous Unpaginated Story Editor (Section 6.1).
 *
 * Dedicated editor panel decoupled from page geometry, similar to InDesign's Story Editor.
 * Allows authors to write and edit long texts with Niqqud without the overhead of page pagination.
 */

import { StoryParagraph, StorySelection } from './types';
import { renderParagraphDom, parseParagraphDom } from './dom_converter';
import { StoryHistory } from './history';
export { StoryParagraph, StorySelection };

export class StoryEditor {
  private container: HTMLElement;
  private editorEl: HTMLDivElement;
  private history: StoryHistory = new StoryHistory();
  private lastSavedParagraphs: StoryParagraph[] = [];
  private lastSelection: StorySelection | null = null;
  private onTextChangeCallback?: (paraId: string, newText: string) => void;
  private onStoryChangeCallback?: (paragraphs: StoryParagraph[]) => void;
  private historyChangeCallbacks: Array<(canUndo: boolean, canRedo: boolean) => void> = [];
  private onSelectionChange = () => this.handleSelectionChange();

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
    // Typography and colors come from the host stylesheet (.tok-story-editor-content),
    // so the editor follows the light/dark theme.
    this.editorEl.style.outline = 'none';
    // The workbench sets `user-select: none` on <body>; without overriding it here the
    // editor's text cannot be selected (no drag-select, no Shift+Arrow, no copy).
    this.editorEl.style.userSelect = 'text';
    this.editorEl.style.setProperty('-webkit-user-select', 'text');

    this.container.appendChild(this.editorEl);

    this.editorEl.addEventListener('input', () => {
      this.handleInput();
    });

    this.editorEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            this.redo();
          } else {
            e.preventDefault();
            this.undo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          this.redo();
        }
      }
    });

    this.editorEl.addEventListener('beforeinput', (e: InputEvent) => {
      if (e.inputType === 'historyUndo') {
        e.preventDefault();
        this.undo();
      } else if (e.inputType === 'historyRedo') {
        e.preventDefault();
        this.redo();
      }
    });

    // Highlight the paragraph that holds the caret.
    document.addEventListener('selectionchange', this.onSelectionChange);
  }

  public destroy(): void {
    document.removeEventListener('selectionchange', this.onSelectionChange);
    this.editorEl.remove();
  }

  /** The editable element (for focusing and scrolling from the host). */
  public getElement(): HTMLElement {
    return this.editorEl;
  }

  /** Editor text size in px (display only; the document's typography is unchanged). */
  public setFontSize(px: number): void {
    this.editorEl.style.fontSize = `${px}px`;
  }

  private handleSelectionChange(): void {
    this.markCurrentParagraph();
    const sel = this.getStorySelection();
    if (sel) {
      this.lastSelection = sel;
    }
  }

  private markCurrentParagraph(): void {
    const sel = window.getSelection();
    let node: Node | null = sel && sel.anchorNode && this.editorEl.contains(sel.anchorNode) ? sel.anchorNode : null;
    while (node && node !== this.editorEl && node.nodeName !== 'P') node = node.parentNode;
    const current = node && node.nodeName === 'P' ? (node as HTMLElement) : null;
    this.editorEl.querySelectorAll('p.tok-current').forEach((p) => {
      if (p !== current) p.classList.remove('tok-current');
    });
    current?.classList.add('tok-current');
  }

  private renderParagraphs(paragraphs: StoryParagraph[]): void {
    const frag = document.createDocumentFragment();
    for (const p of paragraphs) {
      const pEl = renderParagraphDom(p);
      frag.appendChild(pEl);
    }
    this.editorEl.replaceChildren(frag);
  }

  public loadStory(paragraphs: StoryParagraph[], resetHistory = true): void {
    this.renderParagraphs(paragraphs);
    this.lastSavedParagraphs = JSON.parse(JSON.stringify(paragraphs));
    if (resetHistory) {
      this.history.clear();
    }
    this.notifyHistoryChange();
  }

  /** Current paragraphs as edited with semantic spans and style patches. */
  public getStory(): StoryParagraph[] {
    return Array.from(this.editorEl.querySelectorAll<HTMLElement>('p[data-para-id]')).map((p) =>
      parseParagraphDom(p)
    );
  }

  /** Retrieve a single paragraph by ID */
  public getParagraph(paraId: string): StoryParagraph | null {
    const el = this.editorEl.querySelector<HTMLElement>(`p[data-para-id="${CSS.escape(paraId)}"]`);
    return el ? parseParagraphDom(el) : null;
  }

  public onTextChange(cb: (paraId: string, newText: string) => void): void {
    this.onTextChangeCallback = cb;
  }

  public onStoryChange(cb: (paragraphs: StoryParagraph[]) => void): void {
    this.onStoryChangeCallback = cb;
  }

  public onHistoryChange(cb: (canUndo: boolean, canRedo: boolean) => void): () => void {
    this.historyChangeCallbacks.push(cb);
    cb(this.canUndo(), this.canRedo());
    return () => {
      this.historyChangeCallbacks = this.historyChangeCallbacks.filter((c) => c !== cb);
    };
  }

  public canUndo(): boolean {
    return this.history.canUndo();
  }

  public canRedo(): boolean {
    return this.history.canRedo();
  }

  public getUndoCount(): number {
    return this.history.getUndoCount();
  }

  public getRedoCount(): number {
    return this.history.getRedoCount();
  }

  public undo(): boolean {
    const state = this.history.undo();
    if (!state) return false;
    this.renderParagraphs(state.paragraphs);
    this.lastSavedParagraphs = JSON.parse(JSON.stringify(state.paragraphs));
    if (state.selection) {
      this.setStorySelection(state.selection);
    }
    this.notifyHistoryChange();
    if (this.onTextChangeCallback) {
      this.onTextChangeCallback('', '');
    }
    if (this.onStoryChangeCallback) {
      this.onStoryChangeCallback(state.paragraphs);
    }
    return true;
  }

  public redo(): boolean {
    const state = this.history.redo();
    if (!state) return false;
    this.renderParagraphs(state.paragraphs);
    this.lastSavedParagraphs = JSON.parse(JSON.stringify(state.paragraphs));
    if (state.selection) {
      this.setStorySelection(state.selection);
    }
    this.notifyHistoryChange();
    if (this.onTextChangeCallback) {
      this.onTextChangeCallback('', '');
    }
    if (this.onStoryChangeCallback) {
      this.onStoryChangeCallback(state.paragraphs);
    }
    return true;
  }

  public executeTransaction(description: string, fn: () => void): void {
    const before = this.getStory();
    const selBefore = this.getStorySelection();

    fn();

    this.dedupeParagraphIds();
    const after = this.getStory();
    const selAfter = this.getStorySelection();

    this.history.record(before, after, {
      description,
      isTyping: false,
      selectionBefore: selBefore || undefined,
      selectionAfter: selAfter || undefined
    });

    this.lastSavedParagraphs = JSON.parse(JSON.stringify(after));
    this.lastSelection = selAfter;
    this.notifyHistoryChange();

    if (this.onTextChangeCallback) {
      this.onTextChangeCallback('', '');
    }
    if (this.onStoryChangeCallback) {
      this.onStoryChangeCallback(after);
    }
  }

  private notifyHistoryChange(): void {
    const u = this.canUndo();
    const r = this.canRedo();
    for (const cb of this.historyChangeCallbacks) {
      try {
        cb(u, r);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private handleInput(): void {
    this.dedupeParagraphIds();
    const currentParagraphs = this.getStory();
    const currentSel = this.getStorySelection();

    this.history.record(this.lastSavedParagraphs, currentParagraphs, {
      isTyping: true,
      selectionBefore: this.lastSelection || undefined,
      selectionAfter: currentSel || undefined
    });

    this.lastSavedParagraphs = JSON.parse(JSON.stringify(currentParagraphs));
    this.lastSelection = currentSel;
    this.notifyHistoryChange();

    const sel = window.getSelection();
    let node: Node | null = sel && sel.anchorNode;
    while (node && node !== this.editorEl && node.nodeName !== 'P') {
      node = node.parentNode;
    }

    if (node && node.nodeName === 'P') {
      const pEl = node as HTMLParagraphElement;
      const paraId = pEl.dataset.paraId;
      if (paraId && this.onTextChangeCallback) {
        this.onTextChangeCallback(paraId, pEl.textContent || '');
      }
    } else if (this.onTextChangeCallback) {
      this.onTextChangeCallback('', '');
    }

    if (this.onStoryChangeCallback) {
      this.onStoryChangeCallback(currentParagraphs);
    }
  }

  public getStorySelection(): StorySelection | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
    if (!this.editorEl.contains(sel.anchorNode) || !this.editorEl.contains(sel.focusNode)) return null;

    let anchorP: HTMLElement | null = null;
    let curr: Node | null = sel.anchorNode;
    while (curr && curr !== this.editorEl) {
      if (curr.nodeName === 'P' && (curr as HTMLElement).dataset.paraId) {
        anchorP = curr as HTMLElement;
        break;
      }
      curr = curr.parentNode;
    }

    let focusP: HTMLElement | null = null;
    curr = sel.focusNode;
    while (curr && curr !== this.editorEl) {
      if (curr.nodeName === 'P' && (curr as HTMLElement).dataset.paraId) {
        focusP = curr as HTMLElement;
        break;
      }
      curr = curr.parentNode;
    }

    if (!anchorP || !focusP) return null;

    const anchorParaId = anchorP.dataset.paraId!;
    const focusParaId = focusP.dataset.paraId!;
    const anchorOffset = this.getOffsetInParagraph(anchorP, sel.anchorNode, sel.anchorOffset);
    const focusOffset = this.getOffsetInParagraph(focusP, sel.focusNode, sel.focusOffset);

    const isCollapsed = sel.isCollapsed;
    const isSinglePara = anchorParaId === focusParaId;
    const start = isSinglePara ? Math.min(anchorOffset, focusOffset) : anchorOffset;
    const end = isSinglePara ? Math.max(anchorOffset, focusOffset) : anchorOffset;

    return {
      paraId: anchorParaId,
      start,
      end,
      isCollapsed,
      anchorParaId,
      anchorOffset,
      focusParaId,
      focusOffset
    };
  }

  public setStorySelection(selInfo: StorySelection): void {
    const aId = selInfo.anchorParaId || selInfo.paraId;
    const fId = selInfo.focusParaId || selInfo.paraId;
    const aOff = selInfo.anchorOffset !== undefined ? selInfo.anchorOffset : selInfo.start;
    const fOff = selInfo.focusOffset !== undefined ? selInfo.focusOffset : selInfo.end;

    const anchorP = this.editorEl.querySelector<HTMLElement>(`p[data-para-id="${CSS.escape(aId)}"]`);
    const focusP = this.editorEl.querySelector<HTMLElement>(`p[data-para-id="${CSS.escape(fId)}"]`);
    if (!anchorP || !focusP) return;

    const sel = window.getSelection();
    if (!sel) return;

    const anchorPoint = this.findNodeAndOffset(anchorP, aOff);
    const focusPoint = this.findNodeAndOffset(focusP, fOff);

    try {
      if (typeof sel.setBaseAndExtent === 'function') {
        sel.setBaseAndExtent(anchorPoint.node, anchorPoint.offset, focusPoint.node, focusPoint.offset);
      } else {
        const range = document.createRange();
        range.setStart(anchorPoint.node, anchorPoint.offset);
        range.setEnd(focusPoint.node, focusPoint.offset);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      // Fallback if range fails in disconnected or synthetic tree
    }
  }

  private getOffsetInParagraph(paraEl: HTMLElement, targetNode: Node, targetOffset: number): number {
    let offset = 0;
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node === targetNode) {
        return offset + targetOffset;
      }
      offset += (node.textContent || '').length;
      node = walker.nextNode();
    }
    if (targetNode === paraEl || targetNode.nodeType === Node.ELEMENT_NODE) {
      let count = 0;
      for (let i = 0; i < targetOffset && i < targetNode.childNodes.length; i++) {
        count += targetNode.childNodes[i].textContent?.length || 0;
      }
      return count;
    }
    return offset;
  }

  private findNodeAndOffset(paraEl: HTMLElement, targetOffset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    let remaining = targetOffset;
    let lastNode: Node | null = null;

    while (node) {
      lastNode = node;
      const len = (node.textContent || '').length;
      if (remaining <= len) {
        return { node, offset: remaining };
      }
      remaining -= len;
      node = walker.nextNode();
    }

    if (lastNode) {
      return { node: lastNode, offset: (lastNode.textContent || '').length };
    }
    return { node: paraEl, offset: 0 };
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

