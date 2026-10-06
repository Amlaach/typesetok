import { t, tf, i18n } from '../i18n';
import { el, icon, iconButton, button } from '../ui';
import { ModalController } from './ModalController';
import { fillAppVersion } from '../appInfo';

export interface AboutModalCallbacks {
  onClose: () => void;
  onCheckUpdates?: () => void;
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
    card.style.width = '680px';
    card.style.maxHeight = '88vh';

    // Header
    const head = el('div', 'tok-dialog-head');
    const headText = el('div', 'tok-dialog-head-text');
    headText.appendChild(el('h2', undefined, { 'data-modal-title': '' }, t('aboutTitle')));
    head.appendChild(headText);
    head.appendChild(iconButton('close', t('aboutClose'), () => this.hide(), { attrs: { 'data-focus-key': 'x' } }));
    card.appendChild(head);

    // Scrollable Body
    const body = el('div', 'tok-about-body', {
      style: 'flex:1;overflow-y:auto;padding:24px 28px;display:flex;flex-direction:column;gap:20px;'
    });

    // 1. Hero Brand Banner
    const hero = el('div', 'tok-card', {
      style: 'display:flex;align-items:center;gap:18px;padding:18px 20px;background:var(--tok-bg-surface-2);border-radius:12px;'
    });

    const brandMark = el('span', 'tok-brand-mark', {
      'aria-hidden': 'true',
      style: 'width:56px;height:56px;border-radius:14px;box-shadow:0 3px 10px rgba(30,74,158,0.25);flex-shrink:0;'
    });
    brandMark.appendChild(icon('brand', 32));
    hero.appendChild(brandMark);

    const heroDetails = el('div', undefined, { style: 'display:flex;flex-direction:column;gap:4px;flex:1;' });
    const titleRow = el('div', undefined, { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' });
    titleRow.appendChild(el('h1', undefined, { style: 'font-size:20px;font-weight:800;letter-spacing:-0.02em;' }, 'TypesetOK (TOK)'));

    const verBadge = el('span', 'tok-badge tok-badge-success', { dir: 'ltr' }, 'Stable');
    verBadge.setAttribute('data-app-version', '');
    fillAppVersion(verBadge, (v) => `v${v} Stable`);
    titleRow.appendChild(verBadge);
    heroDetails.appendChild(titleRow);

    heroDetails.appendChild(el('p', undefined, {
      style: 'font-size:13px;color:var(--tok-text-secondary);line-height:1.45;'
    }, 'מערכת שולחנית מקצועית לסדר ועימוד דפוס עברי, ספרי קודש וספרות עברית.'));

    const tagsRow = el('div', undefined, { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;' });
    const makeTag = (label: string) => el('span', 'tok-badge-count', { style: 'font-size:11px;' }, label);
    tagsRow.appendChild(makeTag('Rust Core'));
    tagsRow.appendChild(makeTag('Knuth-Plass'));
    tagsRow.appendChild(makeTag('PDF/X-1a & X-4'));
    tagsRow.appendChild(makeTag('תקן ת"י 6100'));
    tagsRow.appendChild(makeTag('Windows x64 Native'));
    heroDetails.appendChild(tagsRow);

    hero.appendChild(heroDetails);
    body.appendChild(hero);

    // Section Helper
    const createSection = (title: string, iconName: any, items: { title: string; desc: string }[]) => {
      const sec = el('div', 'tok-card', { style: 'display:flex;flex-direction:column;gap:12px;padding:16px 18px;' });
      const secHead = el('div', undefined, { style: 'display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;color:var(--tok-text-primary);' });
      secHead.appendChild(icon(iconName, 17));
      secHead.appendChild(el('span', undefined, undefined, title));
      sec.appendChild(secHead);

      const itemsList = el('div', undefined, { style: 'display:flex;flex-direction:column;gap:10px;' });
      for (const item of items) {
        const row = el('div', undefined, { style: 'display:flex;flex-direction:column;gap:2px;' });
        const itemTitle = el('span', undefined, { style: 'font-size:12.5px;font-weight:600;color:var(--tok-text-primary);' }, item.title);
        const itemDesc = el('span', undefined, { style: 'font-size:12px;color:var(--tok-text-secondary);line-height:1.5;' }, item.desc);
        row.appendChild(itemTitle);
        row.appendChild(itemDesc);
        itemsList.appendChild(row);
      }
      sec.appendChild(itemsList);
      return sec;
    };

    // 2. Typesetting & Core Algorithms
    body.appendChild(createSection('ליבת מנוע העימוד והאלגוריתמיקה (Typesetting Engine)', 'sparkle', [
      {
        title: 'מנוע Rust Native (tok-typeset / tok-cli)',
        desc: 'ליבת עימוד מהירה ודטרמיניסטית הכתובה כולה ב-Rust לבטיחות זיכרון מרבית, עיבוד עשרות אלפי מילים בשניות ספורות ופלט ביט-לביט זהה לחלוטין.'
      },
      {
        title: 'אלגוריתם שבירת שורות אופטימלי Knuth-Plass',
        desc: 'שבירת שורות מבוססת תכנות דינמי (Dynamic Programming) על פני הפסקה כולה למינימום Total Badness, מניעת רווחים לא אחידים והימנעות מוחלטת מיתומים ואלמנות (Orphans & Widows).'
      },
      {
        title: 'יישור עברי מסורתי תלת-שכבתי (3-Tier Hebrew Justifier)',
        desc: 'שילוב מתמטי עדין של שלושת רבדי היישור המסורתיים בדפוס העברי: רווחי מילים גמישים (85%–125%), מתיחת אותיות עבריות רפויות / אהלתר"ם עד 120%, וריווח בין-אותי מיקרומטרי עדין.'
      },
      {
        title: 'תזרימים מקבילים לצורת הדף ומקראות גדולות',
        desc: 'מנוע אילוצים הידראולי רציף לסינכרון טקסט מרכזי (גמרא/מקרא) עם מפרשים בטורים מקבילים (רש"י, תוספות, תרגום, הערות) בדיוק של עשירית המילימטר.'
      },
      {
        title: 'דיוק טיפוגרפי וקדושת הטקסט',
        desc: 'נרמול סדר הניקוד והטעמים לפי תקן ישראלי ת"י 6100, מגן שמות קדושים (No-Break איסור שבירה בשמות הויה ואדנות), וסנכרון מספור עמודים עברי בגימטריה כולל כללי טו/טז וגרשיים.'
      }
    ]));

    // 3. Pre-Press & Standards
    body.appendChild(createSection('תקני דפוס ואיכות קדם-דפוס (Pre-Press & Print Standards)', 'export', [
      {
        title: 'ייצוא תקני ISO PDF/X-1a ו-PDF/X-4',
        desc: 'הפקת קובצי PDF תקניים להדפסה מקצועית בבתי דפוס מסחריים (אופסט ודיגיטלי) עם פרופילי צבע Fogra 39, Fogra 51 ו-ISO Coated v2.'
      },
      {
        title: 'הפרדת צבעים מלאה עם 100% K (שחור נקי)',
        desc: 'טקסט עברי מודפס ב-100% שחור נקי בערוץ ה-K ללא ערבוב ערוצי CMY, למניעת עכירות, טשטוש ופסיפס בדפוס.'
      },
      {
        title: 'רשת שורות בסיס (Baseline Grid) ושולי גלישה (Bleed)',
        desc: 'יישור שורות קפדני בין טורים סמוכים ובשני צדי הדף (Back-to-back Register), שולי גלישה של 3 מ"מ, סימני חיתוך וסרגלי צבע.'
      }
    ]));

    // 4. Runtime & System Environment
    body.appendChild(createSection('סביבת ריצה ואבטחה (Runtime & Security)', 'settings', [
      {
        title: 'מעטפת שולחן עבודה מוקשחת (Hardened Lean Electron)',
        desc: 'סביבת ריצה מודרנית המבוססת על Electron 29, מנוע Chromium 122, Node.js 20 ומנוע V8, ללא תקורות מיותרות ועם אבטחת זיכרון מחמירה.'
      },
      {
        title: 'תמיכה בסינוני אינטרנט בישראל (נטפרי, רימון, אתרוג)',
        desc: 'מודול סינון מאובטח ייעודי (Filter-SSL) המטפל בתעודות אבטחה מקומיות של כלל הסינונים, למניעת שגיאות תעודה בבדיקת עדכונים.'
      },
      {
        title: 'מערכת תוספים מודולרית (Plugins System)',
        desc: 'תמיכה מלאה בהרחבות קוד מותאמות אישית ב-TypeScript (.ts) ו-JavaScript (.js), עם הידור חי ב-esbuild ובידוד ביצועים.'
      },
      {
        title: 'גופנים עבריים מובנים ברישיון חופשי (SIL OFL)',
        desc: 'Frank Ruhl Libre (טקסט ראשי), IBM Plex Sans Hebrew (ממשק), Noto Rashi Hebrew (רש"י), Noto Serif Hebrew ו-David Libre.'
      }
    ]));

    card.appendChild(body);

    // Footer with buttons
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

    foot.appendChild(button(t('updatesCheckNow'), {
      className: 'tok-btn',
      icon: 'refresh',
      attrs: { 'data-focus-key': 'updates' },
      onClick: () => {
        this.hide();
        if (this.callbacks.onCheckUpdates) {
          this.callbacks.onCheckUpdates();
        } else {
          // Open settings on updates tab
          (window as any).tokApp?.openSettings();
        }
      }
    }));

    foot.appendChild(el('span', 'tok-grow'));

    foot.appendChild(button(t('aboutClose'), {
      className: 'tok-btn tok-btn-primary',
      attrs: { 'data-focus-key': 'close' },
      onClick: () => this.hide()
    }));
    card.appendChild(foot);

    this.element.appendChild(card);
  }
}
