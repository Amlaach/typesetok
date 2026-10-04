import { renderIcon } from '../icons';

export interface PaletteItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  action: () => void;
}

export class CommandPalette {
  public element: HTMLElement;
  private isVisible = false;
  private inputEl!: HTMLInputElement;
  private listEl!: HTMLElement;
  private items: PaletteItem[] = [];
  private filteredItems: PaletteItem[] = [];
  private selectedIndex = 0;

  constructor(items: PaletteItem[]) {
    this.items = items;
    this.filteredItems = [...items];

    this.element = document.createElement('div');
    this.element.className = 'tok-palette-overlay';
    this.element.style.display = 'none';

    this.render();
    this.bindEvents();
  }

  public setItems(items: PaletteItem[]): void {
    this.items = items;
    this.filter('');
  }

  public registerItem(item: PaletteItem): void {
    const existingIdx = this.items.findIndex(i => i.id === item.id);
    if (existingIdx >= 0) {
      this.items[existingIdx] = item;
    } else {
      this.items.push(item);
    }
    this.filter(this.inputEl ? this.inputEl.value : '');
  }

  public show(): void {
    this.element.style.display = 'flex';
    this.isVisible = true;
    this.inputEl.value = '';
    this.filter('');
    setTimeout(() => this.inputEl.focus(), 20);
  }

  public hide(): void {
    this.element.style.display = 'none';
    this.isVisible = false;
  }

  public toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }

  private render(): void {
    this.element.innerHTML = '';

    const modal = document.createElement('div');
    modal.className = 'tok-palette-modal';
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Search Input Bar
    const inputWrap = document.createElement('div');
    inputWrap.className = 'tok-palette-input-wrap';

    const searchIcon = document.createElement('span');
    searchIcon.style.display = 'inline-flex';
    searchIcon.style.alignItems = 'center';
    searchIcon.style.marginLeft = '10px';
    searchIcon.style.color = '#94A3B8';
    searchIcon.innerHTML = renderIcon('search', 16);
    inputWrap.appendChild(searchIcon);

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.className = 'tok-palette-input';
    this.inputEl.placeholder = 'הקלד לחיפוש פקודות, תזרימים, עמודים או פעולות עימוד...';
    inputWrap.appendChild(this.inputEl);

    const escBadge = document.createElement('span');
    escBadge.style.fontSize = '11px';
    escBadge.style.color = 'var(--tok-text-muted)';
    escBadge.style.background = '#333';
    escBadge.style.padding = '2px 6px';
    escBadge.style.borderRadius = '4px';
    escBadge.textContent = 'Esc';
    inputWrap.appendChild(escBadge);

    modal.appendChild(inputWrap);

    // Filtered List
    this.listEl = document.createElement('div');
    this.listEl.className = 'tok-palette-list';
    modal.appendChild(this.listEl);

    // Footer Hint Bar
    const footer = document.createElement('div');
    footer.style.padding = '8px 16px';
    footer.style.borderTop = '1px solid var(--tok-border-subtle)';
    footer.style.background = '#222222';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';
    footer.style.fontSize = '11px';
    footer.style.color = 'var(--tok-text-muted)';

    footer.innerHTML = `
      <span>ניווט עם ↑ ↓</span>
      <span>↵ להפעלה</span>
      <span>Esc ליציאה</span>
    `;
    modal.appendChild(footer);

    this.element.appendChild(modal);
  }

  private bindEvents(): void {
    // Click backdrop to dismiss
    this.element.addEventListener('click', () => this.hide());

    // Input text filter
    this.inputEl.addEventListener('input', () => {
      this.filter(this.inputEl.value.trim());
    });

    // Keyboard navigation
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.filteredItems.length);
        this.renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % Math.max(1, this.filteredItems.length);
        this.renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.filteredItems.length > 0 && this.filteredItems[this.selectedIndex]) {
          const item = this.filteredItems[this.selectedIndex];
          this.hide();
          item.action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    // Global shortcut Ctrl+K / Cmd+K / /
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName || ''))) {
        e.preventDefault();
        this.show();
      }
    });
  }

  private filter(query: string): void {
    if (!query) {
      this.filteredItems = [...this.items];
    } else {
      const q = query.toLowerCase();
      this.filteredItems = this.items.filter((it) =>
        it.title.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        (it.subtitle && it.subtitle.toLowerCase().includes(q))
      );
    }
    this.selectedIndex = 0;
    this.renderList();
  }

  private renderList(): void {
    this.listEl.innerHTML = '';

    if (this.filteredItems.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '24px';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--tok-text-muted)';
      empty.textContent = 'לא נמצאו פקודות תואמות';
      this.listEl.appendChild(empty);
      return;
    }

    let currentCat = '';
    this.filteredItems.forEach((item, index) => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        const catEl = document.createElement('div');
        catEl.className = 'tok-palette-category';
        catEl.textContent = currentCat;
        this.listEl.appendChild(catEl);
      }

      const itemEl = document.createElement('div');
      itemEl.className = 'tok-palette-item';
      if (index === this.selectedIndex) {
        itemEl.classList.add('active');
      }

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';

      const arrow = document.createElement('span');
      arrow.textContent = '>';
      arrow.style.opacity = index === this.selectedIndex ? '1' : '0.4';
      left.appendChild(arrow);

      const title = document.createElement('span');
      title.textContent = item.title;
      left.appendChild(title);

      if (item.subtitle) {
        const sub = document.createElement('span');
        sub.style.fontSize = '11px';
        sub.style.opacity = '0.7';
        sub.textContent = `— ${item.subtitle}`;
        left.appendChild(sub);
      }
      itemEl.appendChild(left);

      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.style.fontSize = '10px';
        sc.style.background = 'rgba(0,0,0,0.3)';
        sc.style.padding = '1px 5px';
        sc.style.borderRadius = '3px';
        sc.textContent = item.shortcut;
        itemEl.appendChild(sc);
      }

      itemEl.addEventListener('click', () => {
        this.hide();
        item.action();
      });

      this.listEl.appendChild(itemEl);
    });

    // Scroll active item into view
    const activeEl = this.listEl.querySelector('.tok-palette-item.active') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }
}
