import { t, i18n } from '../i18n';
import { renderIcon } from '../icons';
import { ModalController } from './ModalController';
import { fillAppVersion } from '../appInfo';

export interface AboutModalCallbacks {
  onClose: () => void;
}

export class AboutModal {
  public element: HTMLElement;
  private callbacks: AboutModalCallbacks;
  private isVisible = false;
  private modal: ModalController;

  constructor(callbacks: AboutModalCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'tok-about-overlay';
    this.element.style.position = 'fixed';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.width = '100vw';
    this.element.style.height = '100vh';
    this.element.style.background = 'rgba(11, 19, 43, 0.82)';
    this.element.style.backdropFilter = 'blur(6px)';
    this.element.style.zIndex = '99999';
    this.element.style.display = 'none';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';

    this.modal = new ModalController(this.element, () => this.hide(), { closeOnBackdrop: true });

    i18n.onChange(() => {
      if (this.isVisible) this.render();
    });
  }

  public show(): void {
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.render();
    this.modal.opened();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.element.style.display = 'none';
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
    this.element.style.direction = i18n.getDirection();

    const card = document.createElement('div');
    card.className = 'tok-about-card';
    card.style.width = '520px';
    card.style.maxWidth = '90vw';
    card.style.background = '#0F172A';
    card.style.border = '1px solid #1E3A8A';
    card.style.borderRadius = '14px';
    card.style.boxShadow = '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 24px rgba(37, 99, 235, 0.25)';
    card.style.padding = '28px 32px';
    card.style.textAlign = 'center';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';

    // Logo Emblem
    const logo = document.createElement('div');
    logo.style.width = '64px';
    logo.style.height = '64px';
    logo.style.borderRadius = '14px';
    logo.style.background = '#1E293B';
    logo.style.border = '1.5px solid #3B82F6';
    logo.style.display = 'flex';
    logo.style.alignItems = 'center';
    logo.style.justifyContent = 'center';
    logo.style.color = '#60A5FA';
    logo.style.marginBottom = '14px';
    logo.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.4)';
    logo.innerHTML = renderIcon('brand', 30);
    card.appendChild(logo);

    // Title & Tagline
    const title = document.createElement('h2');
    title.style.margin = '0 0 6px 0';
    title.style.fontSize = '22px';
    title.style.fontWeight = '800';
    title.style.color = '#60A5FA';
    title.style.letterSpacing = '-0.3px';
    title.textContent = 'TypesetOK (TOK)';
    title.dataset.modalTitle = '';
    card.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.style.margin = '0 0 18px 0';
    subtitle.style.fontSize = '13px';
    subtitle.style.color = '#94A3B8';
    subtitle.textContent = t('appTagline');
    card.appendChild(subtitle);

    // Metadata List
    const metaBox = document.createElement('div');
    metaBox.style.width = '100%';
    metaBox.style.background = '#0B132B';
    metaBox.style.border = '1px solid #1E293B';
    metaBox.style.borderRadius = '8px';
    metaBox.style.padding = '12px 16px';
    metaBox.style.marginBottom = '20px';
    metaBox.style.fontSize = '12px';
    metaBox.style.color = '#CBD5E1';
    metaBox.style.textAlign = i18n.getLanguage() === 'he' ? 'right' : 'left';

    metaBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #64748B;">${t('aboutVersionLabel')}</span>
        <span style="font-weight: 600; color: #F8FAFC;" data-app-version>—</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #64748B;">${t('aboutCoreLabel')}</span>
        <span style="color: #38BDF8;">${t('aboutRustVersion')}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748B;">${t('aboutShellLabel')}</span>
        <span style="color: #F8FAFC;">${t('aboutShellValue')}</span>
      </div>
    `;
    fillAppVersion(metaBox.querySelector('[data-app-version]') as HTMLElement, (v) => `v${v} Stable`);
    card.appendChild(metaBox);

    // GitHub Link Button
    const ghBtn = document.createElement('button');
    ghBtn.className = 'tok-btn tok-btn-primary';
    ghBtn.style.width = '100%';
    ghBtn.style.height = '38px';
    ghBtn.style.fontSize = '13px';
    ghBtn.style.fontWeight = '600';
    ghBtn.style.marginBottom = '10px';
    ghBtn.style.display = 'inline-flex';
    ghBtn.style.alignItems = 'center';
    ghBtn.style.justifyContent = 'center';
    ghBtn.style.gap = '8px';
    ghBtn.dataset.focusKey = 'github';
    ghBtn.innerHTML = `${renderIcon('brand', 15)} <span>${t('aboutGithubBtn')}</span>`;

    ghBtn.addEventListener('click', () => {
      const url = 'https://github.com/TypesetOK/typesetok';
      const win = window as any;
      if (win.tokIpc && win.tokIpc.openExternal) {
        Promise.resolve(win.tokIpc.openExternal(url)).catch((e: any) => {
          console.warn('[ABOUT] openExternal failed:', e?.message ?? e);
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
    card.appendChild(ghBtn);

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tok-btn';
    closeBtn.style.width = '100%';
    closeBtn.style.height = '34px';
    closeBtn.textContent = t('aboutClose');
    closeBtn.dataset.focusKey = 'close';
    closeBtn.dataset.autofocus = '';
    closeBtn.addEventListener('click', () => this.hide());
    card.appendChild(closeBtn);

    this.element.appendChild(card);
  }
}
