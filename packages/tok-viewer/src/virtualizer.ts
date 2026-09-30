/**
 * Active 3-Page DOM Window Virtualizer (Section 10.3).
 *
 * In a 1,000-page book, keeping 1,000 pages in the browser DOM consumes >2GB of RAM
 * and degrades compositing performance down to single-digit FPS.
 *
 * This Virtualizer maintains placeholder wrappers with fixed layout heights, but mounts
 * the actual pre-paginated HTML DOM content ONLY for pages [K-1, K, K+1] around the current viewport.
 */

export interface PageDescriptor {
  pageIndex: number;
  gematriaNumber: string;
  widthPt: number;
  heightPt: number;
  htmlContent: string;
}

export class PageDomVirtualizer {
  private container: HTMLElement;
  private pages: PageDescriptor[] = [];
  private activeCenterPage = 0;
  private pagePlaceholders: Map<number, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('tok-virtualizer-viewport');
    this.container.addEventListener('scroll', () => this.handleScroll(), { passive: true });
  }

  public setPages(pages: PageDescriptor[]): void {
    this.pages = pages;
    this.container.innerHTML = '';
    this.pagePlaceholders.clear();

    // Create lightweight placeholder divs with explicit physical heights
    for (const page of pages) {
      const ph = document.createElement('div');
      ph.className = 'tok-page-placeholder';
      ph.dataset.pageIndex = page.pageIndex.toString();
      ph.style.width = `${page.widthPt * 1.333}px`;
      ph.style.height = `${page.heightPt * 1.333}px`;
      ph.style.margin = '20px auto';
      ph.style.position = 'relative';

      this.container.appendChild(ph);
      this.pagePlaceholders.set(page.pageIndex, ph);
    }

    this.updateActiveWindow(0);
  }

  public scrollToPage(pageIndex: number): void {
    const ph = this.pagePlaceholders.get(pageIndex);
    if (ph) {
      ph.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.updateActiveWindow(pageIndex);
    }
  }

  private handleScroll(): void {
    const viewportTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    const viewportCenter = viewportTop + viewportHeight / 2;

    // Find the page currently closest to viewport center
    let closestPage = 0;
    let minDistance = Infinity;

    for (const [idx, ph] of this.pagePlaceholders.entries()) {
      const phCenter = ph.offsetTop + ph.offsetHeight / 2;
      const dist = Math.abs(phCenter - viewportCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestPage = idx;
      }
    }

    if (closestPage !== this.activeCenterPage) {
      this.updateActiveWindow(closestPage);
    }
  }

  /**
   * Enforces the 3-page active window rule: mounts [K-1, K, K+1] and unmounts all others.
   */
  public updateActiveWindow(centerPage: number): void {
    this.activeCenterPage = centerPage;
    const windowStart = Math.max(0, centerPage - 1);
    const windowEnd = Math.min(this.pages.length - 1, centerPage + 1);

    for (let i = 0; i < this.pages.length; i++) {
      const ph = this.pagePlaceholders.get(i);
      if (!ph) continue;

      const shouldBeMounted = i >= windowStart && i <= windowEnd;
      const isCurrentlyMounted = ph.children.length > 0;

      if (shouldBeMounted && !isCurrentlyMounted) {
        // Mount page HTML
        const page = this.pages[i];
        ph.innerHTML = page.htmlContent;
        ph.classList.add('tok-page-mounted');
      } else if (!shouldBeMounted && isCurrentlyMounted) {
        // Unmount to free DOM nodes and GPU memory
        ph.innerHTML = '';
        ph.classList.remove('tok-page-mounted');
      }
    }
  }

  public getActivePage(): number {
    return this.activeCenterPage;
  }
}
