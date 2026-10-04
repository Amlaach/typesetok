import { t, i18n } from '../i18n';
import { el, iconButton, button } from '../ui';
import { ModalController } from './ModalController';
import { APP_VERSION } from './WelcomeModal';

export interface AboutModalCallbacks {
  onClose: () => void;
}

const REPO_URL = 'https://github.com/TypesetOK/typesetok';

export class AboutModal {
  public element: HTMLElement;
  private callbacks: AboutModalCallbacks;
  private isVisible = false;
  private modal: ModalController;

  constructor(callbacks: AboutModalCallbacks) {
    this.callbacks = callbacks;
    this.element = el('div', 'tok-overlay tok-about-overlay');

    this.modal = new ModalController(this.element, () => this.hide(), { closeOnBackdrop: true });

    i18n.onChange(() => {
      if (this.isVisible) this.render();
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
    this.callbacks.onClose();
  }

  private render(): void {
    const focusKey = this.modal.captureFocus();
    this.renderContent();
    this.modal.afterRender(focusKey);
  }

  private renderContent(): void {
    this.element.innerHTML = '';
    this.element.dir = i18n.getDirection();

    const card = el('div', 'tok-dialog tok-about-card');
    card.style.width = '440px';

    const head = el('div', 'tok-dialog-head');
    const headText = el('div', 'tok-dialog-head-text');
    headText.appendChild(el('h2', undefined, { 'data-modal-title': '' }, t('aboutTitle')));
    head.appendChild(headText);
    head.appendChild(iconButton('close', t('aboutClose'), () => this.hide(), { attrs: { 'data-focus-key': 'x' } }));
    card.appendChild(head);

    const body = el('div', 'tok-about-body');
    body.appendChild(el('span', 'tok-brand-mark', { 'aria-hidden': 'true' }, 'ת'));
    body.appendChild(el('h2', undefined, undefined, 'TypesetOK (TOK)'));
    body.appendChild(el('p', undefined, undefined, t('appTagline')));

    const meta = el('div', 'tok-about-meta tok-card');
    const line = (label: string, value: string, ltr = false) => {
      const row = el('div', 'tok-status-line');
      row.appendChild(el('span', undefined, undefined, label));
      row.appendChild(el('span', undefined, ltr ? { dir: 'ltr' } : undefined, value));
      meta.appendChild(row);
    };
    line(t('aboutVersionLabel'), `v${APP_VERSION}`, true);
    line(t('aboutCoreLabel'), t('aboutRustVersion'));
    line(t('aboutShellLabel'), t('aboutShellValue'));
    body.appendChild(meta);
    card.appendChild(body);

    const foot = el('div', 'tok-dialog-foot');
    foot.appendChild(button(t('aboutGithubBtn'), {
      className: 'tok-btn',
      icon: 'brand',
      attrs: { 'data-focus-key': 'github' },
      onClick: () => {
        const win = window as any;
        if (win.tokIpc && win.tokIpc.openExternal) {
          Promise.resolve(win.tokIpc.openExternal(REPO_URL)).catch((e: any) => {
            console.warn('[ABOUT] openExternal failed:', e?.message ?? e);
          });
        } else {
          window.open(REPO_URL, '_blank', 'noopener,noreferrer');
        }
      }
    }));
    foot.appendChild(el('span', 'tok-grow'));
    foot.appendChild(button(t('aboutClose'), {
      className: 'tok-btn tok-btn-primary',
      attrs: { 'data-focus-key': 'close', 'data-autofocus': '' },
      onClick: () => this.hide()
    }));
    card.appendChild(foot);

    this.element.appendChild(card);
  }
}
