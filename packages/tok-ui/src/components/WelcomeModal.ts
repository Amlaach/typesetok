import { t, tf, i18n } from '../i18n';
import { el, icon, iconButton, button } from '../ui';
import { ModalController } from './ModalController';

export interface WelcomeModalCallbacks {
  onSelectTemplate: (templateId: string) => void;
  /** Open a .tok file; `path` is set when a file was dropped on the screen. */
  onOpenProject: (path?: string) => void;
  onLoadDemo: () => void;
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

const DEFAULT_RECENT: RecentProject[] = [
  { name: 'מסכת ברכות — מהדורת מופת.tok', time: 'היום, 14:32', pages: 12, template: 0 },
  { name: 'ספר תהילים עם פירוש המילות.tok', time: 'אתמול', pages: 48, template: 1 },
  { name: 'עלון שבת קודש — גיליון ק״מ.tok', time: 'לפני 3 ימים', pages: 4, template: 4 }
];

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem('tok_recent_projects');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return DEFAULT_RECENT;
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

export const APP_VERSION = '0.7.3';

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
 * Start screen: fills the window (it used to be a dialog over a dimmed workbench).
 * Escape or "continue to workspace" closes it.
 */
export class WelcomeModal {
  public element: HTMLElement;
  private callbacks: WelcomeModalCallbacks;
  private isVisible = false;
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
    const top = el('header', 'tok-welcome-top');
    top.appendChild(el('span', 'tok-brand-mark', { 'aria-hidden': 'true' }, 'ת'));
    top.appendChild(el('span', 'tok-brand-name', undefined, 'TypesetOK'));
    top.appendChild(el('span', 'tok-grow'));
    top.appendChild(iconButton('settings', t('sidebarSettings'), () => {
      this.hide();
      this.callbacks.onOpenSettings?.();
    }, { attrs: { 'data-focus-key': 'settings' } }));
    top.appendChild(iconButton('info', t('sidebarAbout'), () => {
      this.hide();
      this.callbacks.onOpenAbout?.();
    }, { attrs: { 'data-focus-key': 'about' } }));
    top.appendChild(iconButton('close', t('continueToWorkspace'), () => this.close(), { attrs: { 'data-focus-key': 'close' } }));
    this.element.appendChild(top);

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

    // First-run hint with the sample project
    const firstRun = el('div', 'tok-first-run');
    const frIcon = el('span', 'tok-first-run-icon', { 'aria-hidden': 'true' });
    frIcon.appendChild(icon('brand', 18));
    firstRun.appendChild(frIcon);
    const frText = el('span', 'tok-first-run-text');
    frText.appendChild(el('strong', undefined, undefined, t('welcomeFirstRunTitle')));
    frText.appendChild(el('span', undefined, undefined, t('welcomeFirstRunDesc')));
    firstRun.appendChild(frText);
    firstRun.appendChild(button(t('demoProject'), {
      className: 'tok-btn tok-btn-primary',
      icon: 'sparkle',
      attrs: { 'data-focus-key': 'demo' },
      onClick: () => {
        this.hide();
        this.callbacks.onLoadDemo();
      }
    }));
    main.appendChild(firstRun);
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
    const list = el('div', undefined, { role: 'list', style: 'display:flex;flex-direction:column;gap:2px' });
    if (recent.length === 0) {
      list.appendChild(el('p', 'tok-recent-empty', undefined, t('noRecentProjects')));
    }
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
        if (rec.path) this.callbacks.onOpenProject(rec.path);
        else this.callbacks.onLoadDemo();
      });
      list.appendChild(row);
    }
    side.appendChild(list);

    const drop = el('div', 'tok-dropzone');
    const dropIcon = icon('upload', 22);
    dropIcon.style.color = 'var(--tok-text-muted)';
    drop.appendChild(dropIcon);
    drop.appendChild(el('span', undefined, undefined, t('welcomeDropHint')));
    side.appendChild(drop);
    card.appendChild(side);

    body.appendChild(card);
    this.element.appendChild(body);

    // ---- Footer ----
    const foot = el('footer', 'tok-welcome-foot');
    const label = el('label');
    const check = el('input', undefined, { type: 'checkbox' });
    // Reflect the saved preference (the app only auto-opens this screen when it isn't 'false').
    let showOnStartup = true;
    try {
      showOnStartup = localStorage.getItem('tok_show_welcome') !== 'false';
    } catch {}
    check.checked = showOnStartup;
    check.addEventListener('change', () => {
      try {
        localStorage.setItem('tok_show_welcome', check.checked ? 'true' : 'false');
      } catch {}
    });
    label.appendChild(check);
    label.appendChild(document.createTextNode(t('showOnStartup')));
    foot.appendChild(label);
    foot.appendChild(el('span', 'tok-grow'));
    const guide = el('button', 'tok-link', { type: 'button' }, t('welcomeGuide'));
    guide.addEventListener('click', () => {
      const url = 'https://github.com/TypesetOK/typesetok#readme';
      const win = window as any;
      if (win.tokIpc?.openExternal) Promise.resolve(win.tokIpc.openExternal(url)).catch(() => {});
      else window.open(url, '_blank', 'noopener,noreferrer');
    });
    foot.appendChild(guide);
    foot.appendChild(el('span', undefined, undefined, tf('welcomeVersion', { v: APP_VERSION })));
    foot.appendChild(button(t('continueToWorkspace'), {
      className: 'tok-btn tok-btn-sm',
      attrs: { 'data-focus-key': 'continue' },
      onClick: () => this.close()
    }));
    this.element.appendChild(foot);
  }
}
