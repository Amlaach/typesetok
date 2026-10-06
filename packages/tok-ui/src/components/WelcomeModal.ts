import { t, tf, i18n } from '../i18n';
import { el, icon, iconButton, button } from '../ui';
import { ModalController } from './ModalController';
import { fillAppVersion } from '../appInfo';

export interface WelcomeModalCallbacks {
  onSelectTemplate: (templateId: string) => void;
  /** Open a .tok file; `path` is set when a file was dropped on the screen or selected. */
  onOpenProject: (path?: string) => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

/** A block of a page drawing: top/right/width/height in % of the page, and its kind. */
type ArtBlock = [number, number, number, number, 'tl' | 'tg' | 'tg2' | 'th' | 'th2' | 'tr'];

interface Template {
  id: string;
  titleKey: string;
  descKey: string;
  metaKey: string;
  art: ArtBlock[];
}

const TEMPLATES: Template[] = [
  {
    id: 'gemara', titleKey: 'templateGemara', descKey: 'templateGemaraDesc', metaKey: 'templateMetaGemara',
    art: [[6, 8, 84, 0, 'tr'], [10, 8, 24, 84, 'tl'], [10, 36, 28, 48, 'tg'], [10, 68, 24, 84, 'tl'], [61, 36, 56, 33, 'tl']]
  },
  {
    id: 'mikraot', titleKey: 'templateMikraot', descKey: 'templateMikraotDesc', metaKey: 'templateMetaMikraot',
    art: [[6, 8, 84, 0, 'tr'], [10, 8, 58, 22, 'tg'], [10, 70, 22, 22, 'tl'], [35, 8, 41, 58, 'tl'], [35, 51, 41, 27, 'tl'], [66, 51, 41, 27, 'tl']]
  },
  {
    id: 'prose', titleKey: 'templateProse', descKey: 'templateProseDesc', metaKey: 'templateMetaProse',
    art: [[14, 32, 36, 3, 'th'], [20, 42, 16, 0, 'tr'], [26, 14, 72, 62, 'tg2']]
  },
  {
    id: 'notes', titleKey: 'templateNotes', descKey: 'templateNotesDesc', metaKey: 'templateMetaNotes',
    art: [[10, 14, 72, 60, 'tg2'], [75, 58, 28, 0, 'tr'], [78, 14, 72, 12, 'tl']]
  },
  {
    id: 'bulletin', titleKey: 'templateBulletin', descKey: 'templateBulletinDesc', metaKey: 'templateMetaBulletin',
    art: [[9, 10, 80, 6, 'th'], [18, 26, 48, 2, 'th2'], [25, 10, 38, 64, 'tg2'], [25, 52, 38, 64, 'tg2']]
  }
];

export interface RecentProject {
  name: string;
  path?: string;
  time: string;
  pages: number;
  template: number;
}

const DUMMY_PROJECT_NAMES = new Set([
  'מסכת ברכות — מהדורת מופת.tok',
  'ספר תהילים עם פירוש המילות.tok',
  'עלון שבת קודש — גיליון ק״מ.tok'
]);

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem('tok_recent_projects');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => p && typeof p.name === 'string' && !DUMMY_PROJECT_NAMES.has(p.name));
      }
    }
  } catch {}
  return [];
}

export function addRecentProject(entry: { name: string; path?: string; pages?: number; template?: number }): void {
  try {
    const list = getRecentProjects().filter((p) => p.name !== entry.name);
    list.unshift({
      name: entry.name,
      path: entry.path,
      time: 'זה עתה',
      pages: entry.pages ?? 1,
      template: entry.template ?? 0
    });
    localStorage.setItem('tok_recent_projects', JSON.stringify(list.slice(0, 10)));
  } catch {}
}

function pageArt(blocks: ArtBlock[], w: number, h: number): HTMLElement {
  const page = el('div', 'tok-page-art', { 'aria-hidden': 'true' });
  page.style.width = `${w}px`;
  page.style.height = `${h}px`;
  for (const [top, right, width, height, kind] of blocks) {
    const b = el('i', kind);
    b.style.top = `${top}%`;
    b.style.right = `${right}%`;
    b.style.width = `${width}%`;
    if (kind !== 'tr') b.style.height = `${height}%`;
    page.appendChild(b);
  }
  return page;
}

/**
 * Start screen: full-screen primary launcher for TypesetOK.
 * When no document is open, skipping is disabled.
 */
export class WelcomeModal {
  public element: HTMLElement;
  private callbacks: WelcomeModalCallbacks;
  private isVisible = false;
  private hasOpenDocument = false;
  private modal: ModalController;

  constructor(callbacks: WelcomeModalCallbacks) {
    this.callbacks = callbacks;
    this.element = el('div', 'tok-welcome-overlay');
    this.element.dir = i18n.getDirection();

    this.modal = new ModalController(this.element, () => this.close());

    i18n.onChange(() => {
      this.element.dir = i18n.getDirection();
      if (this.isVisible) this.render();
    });

    // Dropping a .tok file anywhere on the screen opens it.
    this.element.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      this.element.querySelector('.tok-dropzone')?.classList.add('tok-drag');
    });
    this.element.addEventListener('dragleave', (e) => {
      if (e.target === this.element || !this.element.contains(e.relatedTarget as Node)) {
        this.element.querySelector('.tok-dropzone')?.classList.remove('tok-drag');
      }
    });
    this.element.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      this.element.querySelector('.tok-dropzone')?.classList.remove('tok-drag');
      if (!file) return;
      e.preventDefault();
      // Electron exposes the absolute path on File objects.
      const path = (file as File & { path?: string }).path || file.name;
      this.hide();
      this.callbacks.onOpenProject(path);
    });
  }

  public setHasOpenDocument(hasDoc: boolean): void {
    this.hasOpenDocument = hasDoc;
    if (this.isVisible) this.render();
  }

  public show(): void {
    this.isVisible = true;
    this.element.classList.add('tok-open');
    this.render();
    this.modal.opened();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.element.classList.remove('tok-open');
    this.modal.closed();
  }

  private close(): void {
    if (!this.hasOpenDocument) return;
    this.hide();
    this.callbacks.onClose();
  }

  private render(): void {
    const focusKey = this.modal.captureFocus();
    this.renderContent();
    this.modal.afterRender(focusKey);
  }

  private renderContent(): void {
    this.element.innerHTML = '';

    // ---- Top strip ----
    const topStrip = el('div', 'tok-welcome-top');
    const brandMark = el('span', 'tok-brand-mark', { 'aria-hidden': 'true' });
    brandMark.appendChild(icon('brand', 18));
    topStrip.appendChild(brandMark);
    topStrip.appendChild(el('span', 'tok-brand-name', undefined, 'TypesetOK'));
    topStrip.appendChild(el('span', 'tok-grow'));
    topStrip.appendChild(iconButton('settings', t('sidebarSettings'), () => {
      this.hide();
      this.callbacks.onOpenSettings?.();
    }, { attrs: { 'data-focus-key': 'settings' } }));
    topStrip.appendChild(iconButton('info', t('sidebarAbout'), () => {
      this.hide();
      this.callbacks.onOpenAbout?.();
    }, { attrs: { 'data-focus-key': 'about' } }));

    if (this.hasOpenDocument) {
      topStrip.appendChild(button(t('returnToDocument'), {
        className: 'tok-btn tok-btn-sm',
        icon: 'arrowForward',
        attrs: { 'data-focus-key': 'return' },
        onClick: () => this.close()
      }));
    }
    this.element.appendChild(topStrip);

    // ---- Body ----
    const body = el('div', 'tok-welcome-body');
    const card = el('div', 'tok-welcome-card');

    // New project
    const main = el('section', 'tok-welcome-main', { 'aria-labelledby': 'tok-welcome-h' });
    const head = el('div');
    const h1 = el('h1', undefined, { id: 'tok-welcome-h', 'data-modal-title': '' }, t('welcomeTitle'));
    head.appendChild(h1);
    head.appendChild(el('p', 'tok-lead', undefined, t('welcomeSubtitle')));
    main.appendChild(head);

    const grid = el('div', 'tok-template-grid', { role: 'list', 'aria-label': t('newProject') });
    for (const tmpl of TEMPLATES) {
      const b = el('button', 'tok-template-card', { type: 'button', role: 'listitem', 'data-focus-key': `template-${tmpl.id}` });
      const art = el('span', 'tok-template-art');
      art.appendChild(pageArt(tmpl.art, 84, 118));
      b.appendChild(art);
      const text = el('span', 'tok-template-text');
      text.appendChild(el('span', 'tok-template-title', undefined, t(tmpl.titleKey)));
      text.appendChild(el('span', 'tok-template-desc', undefined, t(tmpl.descKey)));
      text.appendChild(el('span', 'tok-template-meta', undefined, t(tmpl.metaKey)));
      b.appendChild(text);
      b.addEventListener('click', () => {
        this.hide();
        this.callbacks.onSelectTemplate(tmpl.id);
      });
      grid.appendChild(b);
    }
    const blank = el('button', 'tok-template-card tok-template-blank', { type: 'button', role: 'listitem', 'data-focus-key': 'template-blank' });
    const plus = el('span', 'tok-plus', { 'aria-hidden': 'true' });
    plus.appendChild(icon('plus', 20));
    blank.appendChild(plus);
    blank.appendChild(el('span', 'tok-template-title', undefined, t('templateBlank')));
    blank.appendChild(el('span', 'tok-template-desc', undefined, t('templateBlankDesc')));
    blank.addEventListener('click', () => {
      this.hide();
      this.callbacks.onSelectTemplate('blank');
    });
    grid.appendChild(blank);
    main.appendChild(grid);
    card.appendChild(main);

    // Recent projects
    const side = el('aside', 'tok-recent', { 'aria-labelledby': 'tok-recent-h' });
    const sideHead = el('div', 'tok-recent-head');
    sideHead.appendChild(el('h2', undefined, { id: 'tok-recent-h' }, t('recentProjects')));
    sideHead.appendChild(button(t('openProject'), {
      className: 'tok-btn tok-btn-sm',
      icon: 'folder',
      iconSize: 15,
      attrs: { 'data-focus-key': 'open' },
      onClick: () => {
        this.hide();
        this.callbacks.onOpenProject();
      }
    }));
    side.appendChild(sideHead);

    const recent = getRecentProjects();
    const list = el('div', undefined, { role: 'list', style: 'display:flex;flex-direction:column;gap:2px;flex:1' });
    if (recent.length === 0) {
      const emptyBox = el('div', 'tok-recent-empty', { style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:36px 12px;margin:auto 0' });
      const emptyIcon = el('div', undefined, { style: 'color:var(--tok-text-muted);opacity:0.6' });
      emptyIcon.appendChild(icon('history', 32));
      emptyBox.appendChild(emptyIcon);
      emptyBox.appendChild(el('strong', undefined, { style: 'font-size:13px;color:var(--tok-text-primary)' }, t('noRecentProjects')));
      emptyBox.appendChild(el('span', undefined, { style: 'font-size:12px;color:var(--tok-text-muted);text-align:center' }, t('noRecentProjectsSub')));
      list.appendChild(emptyBox);
    } else {
      for (const rec of recent) {
        const row = el('button', 'tok-recent-row', { type: 'button', role: 'listitem' });
        const tpl = TEMPLATES[rec.template] || TEMPLATES[0];
        row.appendChild(pageArt(tpl.art, 34, 48));
        const info = el('span', 'tok-recent-main');
        info.appendChild(el('span', 'tok-recent-name', { title: rec.name }, rec.name.replace(/\.tok$/i, '')));
        info.appendChild(el('span', 'tok-recent-sub', undefined, `${t(tpl.titleKey)} · ${tf('welcomePagesCount', { n: rec.pages })}`));
        row.appendChild(info);
        row.appendChild(el('span', 'tok-recent-when', undefined, rec.time));
        row.addEventListener('click', () => {
          this.hide();
          this.callbacks.onOpenProject(rec.path || rec.name);
        });
        list.appendChild(row);
      }
    }
    side.appendChild(list);

    const drop = el('div', 'tok-dropzone');
    const dropIcon = icon('folder', 22);
    dropIcon.style.color = 'var(--tok-text-muted)';
    drop.appendChild(dropIcon);
    drop.appendChild(el('span', undefined, undefined, t('welcomeDropHint')));
    side.appendChild(drop);
    card.appendChild(side);

    body.appendChild(card);
    this.element.appendChild(body);

    // ---- Footer ----
    const foot = el('footer', 'tok-welcome-foot');
    const guide = el('button', 'tok-link', { type: 'button' }, t('welcomeGuide'));
    guide.addEventListener('click', () => {
      const url = 'https://github.com/TypesetOK/typesetok#readme';
      const win = window as any;
      if (win.tokIpc?.openExternal) Promise.resolve(win.tokIpc.openExternal(url)).catch(() => {});
      else window.open(url, '_blank', 'noopener,noreferrer');
    });
    foot.appendChild(guide);
    foot.appendChild(el('span', 'tok-grow'));
    const verSpan = el('span');
    fillAppVersion(verSpan, (v) => tf('welcomeVersion', { v }));
    foot.appendChild(verSpan);

    if (this.hasOpenDocument) {
      foot.appendChild(button(t('returnToDocument'), {
        className: 'tok-btn tok-btn-sm',
        attrs: { 'data-focus-key': 'continue' },
        onClick: () => this.close()
      }));
    }
    this.element.appendChild(foot);
  }
}
