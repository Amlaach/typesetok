/**
 * Transparent Canvas Overlay (Section 9.2).
 *
 * Sits directly over the Vivliostyle pre-paginated view.
 * Responsible for:
 * 1. Optimistic caret advance (<16ms) upon keypress in RTL.
 * 2. Visual selection highlighting across Hebrew glyph boxes without DOM selection breakage.
 * 3. Mouse click & drag hit-testing coordination.
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

export class CanvasInteractionOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private caret: CaretPosition = { pageIndex: 0, x: 0, y: 0, height: 16, visible: true };
  private selection: SelectionRect[] = [];
  private blinkTimer: number | null = null;
  private isBlinkVisible = true;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tok-interaction-overlay';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none'; // Allow scroll and clicks through, or toggle for drag

    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for Canvas Overlay');
    this.ctx = ctx;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.startCaretBlink();
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
   * before receiving the async roundtrip from the Rust Core Typesetter.
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

  public setSelection(rects: SelectionRect[]): void {
    this.selection = rects;
    this.render();
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

  public destroy(): void {
    if (this.blinkTimer) clearInterval(this.blinkTimer);
    this.canvas.remove();
  }
}
