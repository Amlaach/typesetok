import { t, i18n } from '../i18n';
import { renderIcon, IconName } from '../icons';

export interface WelcomeModalCallbacks {
  onSelectTemplate: (templateId: string) => void;
  onOpenProject: () => void;
  onLoadDemo: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

export class WelcomeModal {
  public element: HTMLElement;
  private callbacks: WelcomeModalCallbacks;
  private isVisible = false;

  constructor(callbacks: WelcomeModalCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'tok-welcome-overlay';
    this.element.style.position = 'fixed';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.width = '100vw';
    this.element.style.height = '100vh';
    this.element.style.background = 'rgba(11, 19, 43, 0.82)';
    this.element.style.backdropFilter = 'blur(8px)';
    this.element.style.zIndex = '99999';
    this.element.style.display = 'none';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';
    this.element.style.direction = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';

    i18n.onChange((lang) => {
      this.element.style.direction = lang === 'he' ? 'rtl' : 'ltr';
      if (this.isVisible) this.render();
    });
  }

  public show(): void {
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.render();
  }

  public hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  private render(): void {
    this.element.innerHTML = '';

    const modal = document.createElement('div');
    modal.className = 'tok-welcome-card';
    modal.style.width = '820px';
    modal.style.maxWidth = '92vw';
    modal.style.maxHeight = '88vh';
    modal.style.background = '#0F172A'; // The chosen blue tone
    modal.style.border = '1px solid #1E3A8A';
    modal.style.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 20px rgba(37, 99, 235, 0.2)';
    modal.style.borderRadius = '14px';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.overflow = 'hidden';

    // Header
    const header = document.createElement('div');
    header.style.padding = '22px 28px 18px';
    header.style.borderBottom = '1px solid #1E293B';
    header.style.background = 'linear-gradient(180deg, #131E38 0%, #0F172A 100%)';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    const brand = document.createElement('div');
    brand.style.display = 'flex';
    brand.style.alignItems = 'center';
    brand.style.gap = '14px';

    const logo = document.createElement('div');
    logo.style.width = '44px';
    logo.style.height = '44px';
    logo.style.borderRadius = '10px';
    logo.style.background = '#1E293B';
    logo.style.border = '1px solid #3B82F6';
    logo.style.display = 'flex';
    logo.style.alignItems = 'center';
    logo.style.justifyContent = 'center';
    logo.style.color = '#60A5FA';
    logo.innerHTML = renderIcon('brand', 22);
    brand.appendChild(logo);

    const titleWrap = document.createElement('div');
    const title = document.createElement('h1');
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.color = '#F8FAFC';
    title.style.margin = '0 0 4px 0';
    title.textContent = t('welcomeTitle');
    titleWrap.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#94A3B8';
    subtitle.style.margin = '0';
    subtitle.textContent = t('welcomeSubtitle');
    titleWrap.appendChild(subtitle);

    brand.appendChild(titleWrap);
    header.appendChild(brand);

    const headerActions = document.createElement('div');
    headerActions.style.display = 'flex';
    headerActions.style.alignItems = 'center';
    headerActions.style.gap = '8px';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'tok-btn';
    settingsBtn.style.height = '28px';
    settingsBtn.style.padding = '0 10px';
    settingsBtn.style.fontSize = '12px';
    settingsBtn.style.background = 'var(--tok-bg-surface-2, #1E293B)';
    settingsBtn.style.border = '1px solid var(--tok-border-strong, #334155)';
    settingsBtn.style.color = '#F1F5F9';
    settingsBtn.style.borderRadius = '6px';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.display = 'inline-flex';
    settingsBtn.style.alignItems = 'center';
    settingsBtn.style.gap = '6px';
    settingsBtn.innerHTML = `${renderIcon('settings', 13)} <span>${t('sidebarSettings')}</span>`;
    settingsBtn.addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onOpenSettings) this.callbacks.onOpenSettings();
    });
    headerActions.appendChild(settingsBtn);

    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'tok-btn';
    aboutBtn.style.height = '28px';
    aboutBtn.style.padding = '0 9px';
    aboutBtn.style.fontSize = '12px';
    aboutBtn.style.background = 'transparent';
    aboutBtn.style.border = '1px solid var(--tok-border-subtle, #334155)';
    aboutBtn.style.color = 'var(--tok-text-secondary, #94A3B8)';
    aboutBtn.style.borderRadius = '6px';
    aboutBtn.style.cursor = 'pointer';
    aboutBtn.style.display = 'inline-flex';
    aboutBtn.style.alignItems = 'center';
    aboutBtn.style.gap = '5px';
    aboutBtn.innerHTML = `${renderIcon('info', 13)} <span>${t('sidebarAbout')}</span>`;
    aboutBtn.addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onOpenAbout) this.callbacks.onOpenAbout();
    });
    headerActions.appendChild(aboutBtn);

    const closeBtn = document.createElement('button');
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94A3B8';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '4px';
    closeBtn.style.display = 'inline-flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.innerHTML = renderIcon('close', 14);
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.callbacks.onClose();
    });
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    modal.appendChild(header);

    // Body Grid
    const body = document.createElement('div');
    body.style.display = 'grid';
    body.style.gridTemplateColumns = '1.2fr 0.8fr';
    body.style.flex = '1';
    body.style.overflow = 'hidden';

    // Left Col: Templates & Quick Actions
    const leftCol = document.createElement('div');
    leftCol.style.padding = '22px 28px';
    leftCol.style.overflowY = 'auto';
    leftCol.style.borderLeft = i18n.getLanguage() === 'he' ? '1px solid #1E293B' : 'none';
    leftCol.style.borderRight = i18n.getLanguage() === 'en' ? '1px solid #1E293B' : 'none';

    const templatesHeading = document.createElement('h3');
    templatesHeading.style.fontSize = '13px';
    templatesHeading.style.color = '#60A5FA';
    templatesHeading.style.marginBottom = '14px';
    templatesHeading.style.fontWeight = '600';
    templatesHeading.textContent = t('newProject');
    leftCol.appendChild(templatesHeading);

    const templates: { id: string; icon: IconName; title: string; desc: string }[] = [
      { id: 'gemara', icon: 'templateTalmud', title: t('templateGemara'), desc: t('templateGemaraDesc') },
      { id: 'prose', icon: 'templateBook', title: t('templateProse'), desc: t('templateProseDesc') },
      { id: 'bulletin', icon: 'templateColumns', title: t('templateBulletin'), desc: t('templateBulletinDesc') },
      { id: 'blank', icon: 'templateBlank', title: t('templateBlank'), desc: t('templateBlankDesc') }
    ];

    for (const tmpl of templates) {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.alignItems = 'flex-start';
      card.style.gap = '14px';
      card.style.padding = '12px 14px';
      card.style.background = '#1E293B';
      card.style.border = '1px solid #334155';
      card.style.borderRadius = '8px';
      card.style.marginBottom = '10px';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.15s ease';

      card.addEventListener('mouseenter', () => {
        card.style.background = '#27354F';
        card.style.borderColor = '#3B82F6';
        card.style.transform = 'translateY(-1px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = '#1E293B';
        card.style.borderColor = '#334155';
        card.style.transform = 'none';
      });

      card.addEventListener('click', () => {
        this.hide();
        this.callbacks.onSelectTemplate(tmpl.id);
      });

      const icon = document.createElement('span');
      icon.style.color = '#60A5FA';
      icon.style.marginTop = '2px';
      icon.innerHTML = renderIcon(tmpl.icon, 20);
      card.appendChild(icon);

      const textWrap = document.createElement('div');
      const tmplTitle = document.createElement('div');
      tmplTitle.style.fontWeight = '600';
      tmplTitle.style.fontSize = '13px';
      tmplTitle.style.color = '#F8FAFC';
      tmplTitle.textContent = tmpl.title;
      textWrap.appendChild(tmplTitle);

      const tmplDesc = document.createElement('div');
      tmplDesc.style.fontSize = '11px';
      tmplDesc.style.color = '#94A3B8';
      tmplDesc.style.marginTop = '3px';
      tmplDesc.textContent = tmpl.desc;
      textWrap.appendChild(tmplDesc);

      card.appendChild(textWrap);
      leftCol.appendChild(card);
    }

    body.appendChild(leftCol);

    // Right Col: Recent Projects & Quick Open
    const rightCol = document.createElement('div');
    rightCol.style.padding = '22px 24px';
    rightCol.style.background = '#0B132B'; // Deep blue background
    rightCol.style.display = 'flex';
    rightCol.style.flexDirection = 'column';

    const recentHeading = document.createElement('h3');
    recentHeading.style.fontSize = '13px';
    recentHeading.style.color = '#60A5FA';
    recentHeading.style.marginBottom = '14px';
    recentHeading.style.fontWeight = '600';
    recentHeading.textContent = t('recentProjects');
    rightCol.appendChild(recentHeading);

    const recentList = [
      { name: 'מסכת ברכות — מהדורת מופת.tok', time: 'היום, 14:32', pages: 12 },
      { name: 'ספר תהילים עם פירוש המילות.tok', time: 'אתמול', pages: 48 },
      { name: 'עלון שבת קודש — גיליון ק״מ.tok', time: 'לפני 3 ימים', pages: 4 }
    ];

    const recentContainer = document.createElement('div');
    recentContainer.style.flex = '1';
    recentContainer.style.overflowY = 'auto';

    for (const rec of recentList) {
      const recItem = document.createElement('div');
      recItem.style.padding = '10px 12px';
      recItem.style.borderRadius = '6px';
      recItem.style.background = '#131E38';
      recItem.style.border = '1px solid #1E293B';
      recItem.style.marginBottom = '8px';
      recItem.style.cursor = 'pointer';
      recItem.style.transition = 'all 0.15s ease';

      recItem.addEventListener('mouseenter', () => {
        recItem.style.background = '#1E293B';
        recItem.style.borderColor = '#3B82F6';
      });
      recItem.addEventListener('mouseleave', () => {
        recItem.style.background = '#131E38';
        recItem.style.borderColor = '#1E293B';
      });
      recItem.addEventListener('click', () => {
        this.hide();
        this.callbacks.onLoadDemo();
      });

      const recName = document.createElement('div');
      recName.style.fontSize = '12px';
      recName.style.fontWeight = '600';
      recName.style.color = '#E2E8F0';
      recName.textContent = rec.name;
      recItem.appendChild(recName);

      const recMeta = document.createElement('div');
      recMeta.style.fontSize = '11px';
      recMeta.style.color = '#64748B';
      recMeta.style.marginTop = '3px';
      recMeta.textContent = `${rec.time} • ${rec.pages} עמודים`;
      recItem.appendChild(recMeta);

      recentContainer.appendChild(recItem);
    }

    rightCol.appendChild(recentContainer);

    // Action buttons at bottom of right col
    const actionBtns = document.createElement('div');
    actionBtns.style.display = 'flex';
    actionBtns.style.flexDirection = 'column';
    actionBtns.style.gap = '8px';
    actionBtns.style.marginTop = '14px';

    const openBtn = document.createElement('button');
    openBtn.className = 'tok-btn';
    openBtn.style.height = '34px';
    openBtn.style.background = '#1E293B';
    openBtn.style.color = '#F8FAFC';
    openBtn.style.border = '1px solid #334155';
    openBtn.style.fontWeight = '500';
    openBtn.style.cursor = 'pointer';
    openBtn.style.display = 'inline-flex';
    openBtn.style.alignItems = 'center';
    openBtn.style.justifyContent = 'center';
    openBtn.style.gap = '8px';
    openBtn.innerHTML = `${renderIcon('folder', 14)} <span>${t('openProject')}</span>`;
    openBtn.addEventListener('click', () => {
      this.hide();
      this.callbacks.onOpenProject();
    });
    actionBtns.appendChild(openBtn);

    const demoBtn = document.createElement('button');
    demoBtn.className = 'tok-btn tok-btn-primary';
    demoBtn.style.height = '34px';
    demoBtn.style.fontWeight = '600';
    demoBtn.style.display = 'inline-flex';
    demoBtn.style.alignItems = 'center';
    demoBtn.style.justifyContent = 'center';
    demoBtn.style.gap = '8px';
    demoBtn.innerHTML = `${renderIcon('sparkle', 14)} <span>${t('demoProject')}</span>`;
    demoBtn.addEventListener('click', () => {
      this.hide();
      this.callbacks.onLoadDemo();
    });
    actionBtns.appendChild(demoBtn);

    rightCol.appendChild(actionBtns);
    body.appendChild(rightCol);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.style.padding = '12px 28px';
    footer.style.background = '#0B132B';
    footer.style.borderTop = '1px solid #1E293B';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';

    const checkLabel = document.createElement('label');
    checkLabel.style.display = 'flex';
    checkLabel.style.alignItems = 'center';
    checkLabel.style.gap = '8px';
    checkLabel.style.fontSize = '12px';
    checkLabel.style.color = '#94A3B8';
    checkLabel.style.cursor = 'pointer';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = true;
    check.addEventListener('change', () => {
      try {
        localStorage.setItem('tok_show_welcome', check.checked ? 'true' : 'false');
      } catch {}
    });
    checkLabel.appendChild(check);
    checkLabel.appendChild(document.createTextNode(t('showOnStartup')));
    footer.appendChild(checkLabel);

    const footerLinks = document.createElement('div');
    footerLinks.style.display = 'flex';
    footerLinks.style.alignItems = 'center';
    footerLinks.style.gap = '14px';
    footerLinks.style.fontSize = '12px';
    footerLinks.style.color = '#94A3B8';

    const sLink = document.createElement('span');
    sLink.style.cursor = 'pointer';
    sLink.style.display = 'inline-flex';
    sLink.style.alignItems = 'center';
    sLink.style.gap = '4px';
    sLink.innerHTML = `${renderIcon('settings', 12)} ${t('sidebarSettings')}`;
    sLink.addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onOpenSettings) this.callbacks.onOpenSettings();
    });
    footerLinks.appendChild(sLink);

    const aLink = document.createElement('span');
    aLink.style.cursor = 'pointer';
    aLink.style.display = 'inline-flex';
    aLink.style.alignItems = 'center';
    aLink.style.gap = '4px';
    aLink.innerHTML = `${renderIcon('info', 12)} ${t('sidebarAbout')}`;
    aLink.addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onOpenAbout) this.callbacks.onOpenAbout();
    });
    footerLinks.appendChild(aLink);
    footer.appendChild(footerLinks);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'tok-btn';
    dismissBtn.textContent = t('continueToWorkspace');
    dismissBtn.addEventListener('click', () => {
      this.hide();
      this.callbacks.onClose();
    });
    footer.appendChild(dismissBtn);

    modal.appendChild(footer);
    this.element.appendChild(modal);
  }
}
