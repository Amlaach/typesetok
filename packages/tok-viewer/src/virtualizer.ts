/**
 * Active 3-Page DOM Window Virtualizer (Section 10.3).
 *
 * In a 1,000-page book, keeping 1,000 pages in the browser DOM consumes >2GB of RAM
 * and degrades compositing performance down to single-digit FPS.
 *
 * This Virtualizer maintains placeholder wrappers with fixed layout heights, but mounts
 * the actual pre-paginated HTML DOM content ONLY for pages [K-1, K, K+1] around the current viewport.
 *
 * Positions vs. page indices: internally everything works on the page's *position* in
 * the array passed to setPages(). The public API (scrollToPage, getActivePage) speaks in
 * PageDescriptor.pageIndex, which need not start at 0 or be contiguous (e.g. a chapter
 * excerpt). Mixing the two used to mount the wrong pages for such documents.
 */

export interface PageDescriptor {
  pageIndex: number;
  gematriaNumber: string;
  widthPt: number;
  heightPt: number;
  htmlContent: string;
}

const PT_TO_PX = 96 / 72;

/** Inclusive [start, end] positions that must be mounted around `center` (empty when there are no pages). */
export function computeActiveWindow(center: number, total: number): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: -1 };
  const c = Math.max(0, Math.min(total - 1, Math.floor(center)));
  return { start: Math.max(0, c - 1), end: Math.min(total - 1, c + 1) };
}

export class PageDomVirtualizer {
  private container: HTMLElement;
  private pages: PageDescriptor[] = [];
  /** Position (not pageIndex) of the page at the viewport center. */
  private activeCenter = 0;
  private placeholders: HTMLElement[] = [];
  private mounted = new Set<number>();
  private scrollRaf = 0;
  private readonly onScroll = () => {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      this.handleScroll();
    });
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('tok-virtualizer-viewport');
    // offsetTop of the placeholders is measured against their offsetParent; make that
    // the scroll container so it lines up with scrollTop.
    if (!this.container.style.position && getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.addEventListener('scroll', this.onScroll, { passive: true });
  }

  public setPages(pages: PageDescriptor[]): void {
    this.pages = pages;
    this.container.innerHTML = '';
    this.placeholders = [];
    this.mounted.clear();

    // Create lightweight placeholder divs with explicit physical heights
    for (const page of pages) {
      const ph = document.createElement('div');
      ph.className = 'tok-page-placeholder';
      ph.dataset.pageIndex = page.pageIndex.toString();
      ph.style.width = `${page.widthPt * PT_TO_PX}px`;
      ph.style.height = `${page.heightPt * PT_TO_PX}px`;
      ph.style.margin = '20px auto';
      ph.style.position = 'relative';

      this.container.appendChild(ph);
      this.placeholders.push(ph);
    }

    this.activeCenter = 0;
    this.applyWindow(0);
  }

  /** Scrolls to the page whose PageDescriptor.pageIndex is `pageIndex`. */
  public scrollToPage(pageIndex: number): void {
    const pos = this.pages.findIndex((p) => p.pageIndex === pageIndex);
    if (pos < 0) return;
    this.placeholders[pos].scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.applyWindow(pos);
  }

  private handleScroll(): void {
    if (this.placeholders.length === 0) return;
    const viewportCenter = this.container.scrollTop + this.container.clientHeight / 2;

    // Placeholders are laid out top-to-bottom, so binary-search the first one whose
    // bottom edge is below the center instead of reading offsetTop of every page.
    let lo = 0;
    let hi = this.placeholders.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const ph = this.placeholders[mid];
      if (ph.offsetTop + ph.offsetHeight < viewportCenter) lo = mid + 1;
      else hi = mid;
    }

    if (lo !== this.activeCenter) {
      this.applyWindow(lo);
    }
  }

  /**
   * Enforces the 3-page active window rule around the page with the given pageIndex.
   */
  public updateActiveWindow(centerPageIndex: number): void {
    const pos = this.pages.findIndex((p) => p.pageIndex === centerPageIndex);
    if (pos >= 0) this.applyWindow(pos);
  }

  /** Mounts positions [K-1, K, K+1] and unmounts all others. Only touches pages whose state changes. */
  private applyWindow(center: number): void {
    const { start, end } = computeActiveWindow(center, this.pages.length);
    this.activeCenter = Math.max(0, Math.min(this.pages.length - 1, center));

    for (const pos of [...this.mounted]) {
      if (pos < start || pos > end) {
        // Unmount to free DOM nodes and GPU memory
        const ph = this.placeholders[pos];
        if (ph) {
          ph.innerHTML = '';
          ph.classList.remove('tok-page-mounted');
        }
        this.mounted.delete(pos);
      }
    }
    for (let pos = start; pos <= end; pos++) {
      if (this.mounted.has(pos)) continue;
      const ph = this.placeholders[pos];
      // Track mount state explicitly: a page whose HTML is plain text (or empty) has
      // no element children, so `children.length` cannot tell whether it is mounted.
      ph.innerHTML = this.pages[pos].htmlContent;
      ph.classList.add('tok-page-mounted');
      this.mounted.add(pos);
    }
  }

  /** PageDescriptor.pageIndex of the page at the viewport center (or -1 when empty). */
  public getActivePage(): number {
    return this.pages[this.activeCenter]?.pageIndex ?? -1;
  }

  public destroy(): void {
    this.container.removeEventListener('scroll', this.onScroll);
    if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = 0;
    this.container.innerHTML = '';
    this.container.classList.remove('tok-virtualizer-viewport');
    this.placeholders = [];
    this.mounted.clear();
    this.pages = [];
  }
}
