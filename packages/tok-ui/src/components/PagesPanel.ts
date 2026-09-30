export interface PageItem {
  pageIndex: number;
  gematria: string;
}

export class PagesPanel {
  public element: HTMLElement;
  private onSelectPageCallback?: (pageIndex: number) => void;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tok-pages-panel';
    this.element.style.width = '140px';
    this.element.style.background = '#1e1e1e';
    this.element.style.borderLeft = '1px solid #333333';
    this.element.style.overflowY = 'auto';
    this.element.style.padding = '12px 8px';
    this.element.dir = 'rtl';
  }

  public setPages(pages: PageItem[]): void {
    this.element.innerHTML = '';
    const header = document.createElement('div');
    header.style.color = '#888888';
    header.style.fontSize = '12px';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '12px';
    header.textContent = `עמודים (${pages.length})`;
    this.element.appendChild(header);

    for (const p of pages) {
      const card = document.createElement('div');
      card.className = 'tok-page-thumb-card';
      card.style.background = '#2d2d2d';
      card.style.border = '1px solid #3d3d3d';
      card.style.borderRadius = '4px';
      card.style.padding = '8px';
      card.style.marginBottom = '8px';
      card.style.cursor = 'pointer';
      card.style.textAlign = 'center';
      card.style.transition = 'border-color 0.2s';

      card.addEventListener('mouseenter', () => (card.style.borderColor = '#0e639c'));
      card.addEventListener('mouseleave', () => (card.style.borderColor = '#3d3d3d'));
      card.addEventListener('click', () => {
        if (this.onSelectPageCallback) {
          this.onSelectPageCallback(p.pageIndex);
        }
      });

      const label = document.createElement('div');
      label.style.color = '#ffffff';
      label.style.fontWeight = 'bold';
      label.style.fontSize = '14px';
      label.textContent = p.gematria;
      card.appendChild(label);

      const sub = document.createElement('div');
      sub.style.color = '#888888';
      sub.style.fontSize = '11px';
      sub.textContent = `עמ' ${p.pageIndex + 1}`;
      card.appendChild(sub);

      this.element.appendChild(card);
    }
  }

  public onSelectPage(cb: (pageIndex: number) => void): void {
    this.onSelectPageCallback = cb;
  }
}
