/**
 * Transparent Canvas Overlay (Section 9.2).
 *
 * Sits directly over the Vivliostyle pre-paginated view.
 * Responsible for:
 * 1. Optimistic caret advance (<16ms) upon keypress in RTL.
 * 2. Visual selection highlighting across Hebrew glyph boxes without DOM selection breakage.
 * 3. Mouse click & drag hit-testing coordination.
 * 4. Keyboard interaction with RTL caret navigation.
 */

export interface CaretPosition {
  pageIndex: number;
  x: number;
  y: number;
  height: number;
  visible: boolean;
}

export interface SelectionRect {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HitTestCallback = (x: number, y: number) => CaretPosition | null;
export type CaretMovedCallback = (pos: CaretPosition) => void;
export type SelectionChangedCallback = (rects: SelectionRect[]) => void;
export type TextInsertedCallback = (char: string) => void;
export type BackspaceCallback = () => void;

export class CanvasInteractionOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private caret: CaretPosition = { pageIndex: 0, x: 0, y: 0, height: 16, visible: true };
  private selection: SelectionRect[] = [];
  private blinkTimer: number | null = null;
  private isBlinkVisible = true;
  private isDragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private readonly onWindowResize = () => this.resizeCanvas();
  private readonly onWindowMouseUp = () => {
    this.isDragging = false;
    this.dragStart = null;
  };
  private destroyed = false;

  public onCaretMoved?: CaretMovedCallback;
  public onSelectionChanged?: SelectionChangedCallback;
  public onTextInserted?: TextInsertedCallback;
  public onBackspacePressed?: BackspaceCallback;
  public hitTestProvider?: HitTestCallback;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tok-interaction-overlay';
    this.canvas.tabIndex = 0; // Focusable for direct keyboard input
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'auto'; // Receives mouse & touch interactions
    this.canvas.style.outline = 'none';
    this.canvas.style.cursor = 'text';

    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for Canvas Overlay');
    this.ctx = ctx;

    this.resizeCanvas();
    window.addEventListener('resize', this.onWindowResize);
    this.startCaretBlink();
    this.bindEvents();
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.canvas.focus();
      const pt = this.getCanvasPoint(e);
      this.isDragging = true;
      this.dragStart = pt;
      this.clearSelection();

      if (this.hitTestProvider) {
        const hit = this.hitTestProvider(pt.x, pt.y);
        if (hit) {
          this.setCaretPosition(hit.pageIndex, hit.x, hit.y, hit.height);
          this.onCaretMoved?.(this.caret);
          return;
        }
      }

      this.setCaretPosition(this.caret.pageIndex, pt.x, pt.y - 8, 16);
      this.onCaretMoved?.(this.caret);
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging || !this.dragStart) return;
      const pt = this.getCanvasPoint(e);

      const minX = Math.min(this.dragStart.x, pt.x);
      const maxX = Math.max(this.dragStart.x, pt.x);
      const minY = Math.min(this.dragStart.y, pt.y);
      const maxY = Math.max(this.dragStart.y, pt.y);

      const rect: SelectionRect = {
        pageIndex: this.caret.pageIndex,
        x: minX,
        y: minY,
        width: Math.max(2, maxX - minX),
        height: Math.max(16, maxY - minY)
      };

      this.setSelection([rect]);
      this.onSelectionChanged?.(this.selection);
    });

    // A single window listener also covers mouseup over the canvas itself.
    window.addEventListener('mouseup', this.onWindowMouseUp);

    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // IME composition (and the 'Process' key Chromium reports during it) must not be
      // treated as a typed character.
      if (e.isComposing || e.key === 'Process' || e.key === 'Dead') return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        // Optimistic RTL move backwards (rightwards)
        this.caret.x += 8.0;
        this.render();
        this.onBackspacePressed?.();
      } else if (e.key === 'ArrowLeft') {
        // In RTL, ArrowLeft advances forward into text (leftward)
        e.preventDefault();
        this.advanceCaretOptimisticRtl(8.0);
      } else if (e.key === 'ArrowRight') {
        // In RTL, ArrowRight retreats backward (rightward)
        e.preventDefault();
        this.caret.x += 8.0;
        this.render();
      } else if ([...e.key].length === 1) {
        // One code point (`e.key.length` is 2 for astral characters such as emoji).
        // Printable character typed: Hebrew / Latin / punctuation
        e.preventDefault();
        const approxWidth = e.key === ' ' ? 4.5 : 8.0;
        this.advanceCaretOptimisticRtl(approxWidth);
        this.onTextInserted?.(e.key);
      }
    });
  }

  private getCanvasPoint(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  public resizeCanvas(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.render();
    }
  }

  /**
   * Optimistic Caret Advance: moves caret immediately to the left for Hebrew RTL typing
   * before receiving the async roundtrip from the Rust Core Typesetter (<16ms latency).
   */
  public advanceCaretOptimisticRtl(approxWidthPt: number): void {
    this.caret.x -= approxWidthPt;
    this.isBlinkVisible = true;
    this.render();
  }

  public setCaretPosition(pageIndex: number, x: number, y: number, height: number): void {
    this.caret = { pageIndex, x, y, height, visible: true };
    this.isBlinkVisible = true;
    this.render();
  }

  public getCaretPosition(): CaretPosition {
    return { ...this.caret };
  }

  public setSelection(rects: SelectionRect[]): void {
    this.selection = rects;
    this.render();
  }

  public getSelection(): SelectionRect[] {
    return [...this.selection];
  }

  public clearSelection(): void {
    this.selection = [];
    this.render();
  }

  private startCaretBlink(): void {
    if (this.blinkTimer) clearInterval(this.blinkTimer);
    this.blinkTimer = window.setInterval(() => {
      this.isBlinkVisible = !this.isBlinkVisible;
      this.render();
    }, 530);
  }

  public render(): void {
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Selection Rectangles
    if (this.selection.length > 0) {
      this.ctx.fillStyle = 'rgba(79, 195, 247, 0.35)'; // Semi-transparent blue
      for (const rect of this.selection) {
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }

    // 2. Draw Caret
    if (this.caret.visible && this.isBlinkVisible) {
      this.ctx.fillStyle = '#0288d1';
      // Standard 2px wide vertical caret
      this.ctx.fillRect(this.caret.x, this.caret.y, 2, this.caret.height);
    }
  }

  /** Stops the blink timer and removes the canvas and every window-level listener it installed. */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.blinkTimer !== null) clearInterval(this.blinkTimer);
    this.blinkTimer = null;
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    this.onCaretMoved = this.onSelectionChanged = this.onTextInserted = undefined;
    this.onBackspacePressed = undefined;
    this.hitTestProvider = undefined;
    this.canvas.remove();
  }
}
