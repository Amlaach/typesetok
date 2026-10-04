import { t, i18n } from '../i18n';

export interface ActionHudCallbacks {
  onFontChange: (fontFamily: string) => void;
  onSizeChange: (sizePt: number) => void;
  onWeightChange: (isBold: boolean) => void;
  onAlignChange: (align: 'right' | 'center' | 'left' | 'justify') => void;
  onStyleChange: (styleToken: string) => void;
  onDismiss: () => void;
}

export class ActionHud {
  public element: HTMLElement;
  private callbacks: ActionHudCallbacks;
  private isVisible = false;
  private currentSize = 14;
  private isBold = false;
  private currentAlign: 'right' | 'center' | 'left' | 'justify' = 'right';
  private currentStyle = 'gemara';
  private currentFont = '';

  constructor(callbacks: ActionHudCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'tok-action-hud';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', t('hudQuickStyle'));
    // The stylesheet pins the HUD to RTL; follow the UI language.
    this.element.style.direction = i18n.getDirection();
    i18n.onChange(() => {
      this.element.style.direction = i18n.getDirection();
      this.element.setAttribute('aria-label', t('hudQuickStyle'));
      if (this.isVisible) this.render();
    });
    this.element.style.display = 'none';

    this.render();

    // Dismiss on Escape key
    window.addEventListener('keydown', (e) => {
      if (this.isVisible && e.key === 'Escape') {
        this.hide();
        this.callbacks.onDismiss();
      }
    });
  }

  public showAt(x: number, y: number, initialValues?: {
    font?: string;
    size?: number;
    bold?: boolean;
    align?: 'right' | 'center' | 'left' | 'justify';
    style?: string;
  }): void {
    if (initialValues?.size) this.currentSize = initialValues.size;
    if (initialValues?.bold !== undefined) this.isBold = initialValues.bold;
    if (initialValues?.align) this.currentAlign = initialValues.align;

    if (initialValues?.style) this.currentStyle = initialValues.style;
    if (initialValues?.font) this.currentFont = initialValues.font;

    this.render();

    // Position HUD centered above (x, y), kept fully inside the window
    this.element.style.display = 'flex';
    const width = this.element.offsetWidth || 360;
    const maxLeft = Math.max(10, window.innerWidth - width - 10);
    this.element.style.left = `${Math.min(maxLeft, Math.max(10, x - width / 2))}px`;
    this.element.style.top = `${Math.max(50, y - 48)}px`;
    this.isVisible = true;
  }

  public hide(): void {
    this.element.style.display = 'none';
    this.isVisible = false;
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  private render(): void {
    this.element.innerHTML = '';

    // 1. Font Family Picker
    const fontSelect = document.createElement('select');
    fontSelect.className = 'tok-select';
    fontSelect.style.height = '26px';
    fontSelect.style.fontSize = '12px';
    fontSelect.style.padding = '0 6px';
    fontSelect.style.background = 'var(--tok-bg-surface-2)';

    const fonts = ['וילנא (Vilna)', 'טעמי פרנק (Taamey Frank)', 'דוד (David CLM)', 'כתב רש"י (Rashi)'];
    for (const f of fonts) {
      const opt = document.createElement('option');
      opt.value = f.split(' ')[0];
      opt.textContent = f;
      if (opt.value === this.currentFont) opt.selected = true;
      fontSelect.appendChild(opt);
    }
    fontSelect.title = t('hudFont');
    fontSelect.setAttribute('aria-label', t('hudFont'));
    fontSelect.addEventListener('change', () => {
      this.currentFont = fontSelect.value;
      this.callbacks.onFontChange(fontSelect.value);
    });
    this.element.appendChild(fontSelect);

    this.element.appendChild(this.createDivider());

    // 2. Font Size with Scrubber / Stepper
    const sizeWrap = document.createElement('div');
    sizeWrap.style.display = 'flex';
    sizeWrap.style.alignItems = 'center';
    sizeWrap.style.gap = '2px';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'tok-btn';
    minusBtn.textContent = '−';
    minusBtn.style.padding = '0 5px';
    minusBtn.style.height = '24px';
    minusBtn.title = t('hudSmaller');
    minusBtn.setAttribute('aria-label', t('hudSmaller'));
    minusBtn.addEventListener('click', () => {
      this.currentSize = Math.max(6, this.currentSize - 1);
      sizeInput.value = `${this.currentSize}pt`;
      this.callbacks.onSizeChange(this.currentSize);
    });
    sizeWrap.appendChild(minusBtn);

    const sizeInput = document.createElement('input');
    sizeInput.type = 'text';
    sizeInput.className = 'tok-input tok-input-number';
    sizeInput.value = `${this.currentSize}pt`;
    sizeInput.style.width = '44px';
    sizeInput.style.height = '24px';
    sizeInput.style.padding = '0 2px';
    sizeInput.setAttribute('aria-label', t('inspFontSize'));
    sizeInput.addEventListener('change', () => {
      const parsed = parseInt(sizeInput.value, 10);
      // Same 6–150pt range the −/+ steppers enforce.
      if (!isNaN(parsed) && parsed >= 6 && parsed <= 150) {
        this.currentSize = parsed;
        this.callbacks.onSizeChange(this.currentSize);
      }
      sizeInput.value = `${this.currentSize}pt`;
    });
    sizeWrap.appendChild(sizeInput);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'tok-btn';
    plusBtn.textContent = '+';
    plusBtn.style.padding = '0 5px';
    plusBtn.style.height = '24px';
    plusBtn.title = t('hudLarger');
    plusBtn.setAttribute('aria-label', t('hudLarger'));
    plusBtn.addEventListener('click', () => {
      this.currentSize = Math.min(150, this.currentSize + 1);
      sizeInput.value = `${this.currentSize}pt`;
      this.callbacks.onSizeChange(this.currentSize);
    });
    sizeWrap.appendChild(plusBtn);

    this.element.appendChild(sizeWrap);

    this.element.appendChild(this.createDivider());

    // 3. Bold Toggle
    const boldBtn = document.createElement('button');
    boldBtn.className = 'tok-btn';
    boldBtn.textContent = 'B';
    boldBtn.style.fontWeight = 'bold';
    boldBtn.style.width = '26px';
    boldBtn.style.height = '24px';
    boldBtn.style.background = this.isBold ? 'var(--tok-accent-primary)' : 'var(--tok-bg-surface-2)';
    boldBtn.style.color = this.isBold ? '#FFFFFF' : 'var(--tok-text-primary)';
    boldBtn.title = t('hudBold');
    boldBtn.setAttribute('aria-label', t('hudBold'));
    boldBtn.setAttribute('aria-pressed', String(this.isBold));
    boldBtn.addEventListener('click', () => {
      this.isBold = !this.isBold;
      boldBtn.style.background = this.isBold ? 'var(--tok-accent-primary)' : 'var(--tok-bg-surface-2)';
      boldBtn.style.color = this.isBold ? '#FFFFFF' : 'var(--tok-text-primary)';
      boldBtn.setAttribute('aria-pressed', String(this.isBold));
      this.callbacks.onWeightChange(this.isBold);
    });
    this.element.appendChild(boldBtn);

    // 4. Basic Alignment Toggle (Right / Center / Justify)
    const alignBtn = document.createElement('button');
    alignBtn.className = 'tok-btn';
    const alignLabel = () => `≡ ${t(this.currentAlign === 'justify' ? 'hudAlignJustify' : this.currentAlign === 'center' ? 'hudAlignCenter' : 'hudAlignRight')}`;
    alignBtn.textContent = alignLabel();
    alignBtn.style.height = '24px';
    alignBtn.style.fontSize = '11px';
    alignBtn.style.padding = '0 6px';
    alignBtn.title = t('hudAlignTitle');
    alignBtn.addEventListener('click', () => {
      if (this.currentAlign === 'right') {
        this.currentAlign = 'justify';
      } else if (this.currentAlign === 'justify') {
        this.currentAlign = 'center';
      } else {
        this.currentAlign = 'right';
      }
      alignBtn.textContent = alignLabel();
      this.callbacks.onAlignChange(this.currentAlign);
    });
    this.element.appendChild(alignBtn);

    this.element.appendChild(this.createDivider());

    // 5. Quick Style Selector Badge
    const styleSelect = document.createElement('select');
    styleSelect.className = 'tok-select';
    styleSelect.style.height = '24px';
    styleSelect.style.fontSize = '11px';
    styleSelect.style.padding = '0 4px';
    styleSelect.title = t('hudQuickStyle');

    const styles = [
      { id: 'gemara', name: 'גמרא' },
      { id: 'rashi', name: 'רש"י' },
      { id: 'tosafot', name: 'תוספות' },
      { id: 'heading', name: 'כותרת' }
    ];
    for (const s of styles) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === this.currentStyle) opt.selected = true;
      styleSelect.appendChild(opt);
    }
    styleSelect.setAttribute('aria-label', t('hudQuickStyle'));
    styleSelect.addEventListener('change', () => {
      this.currentStyle = styleSelect.value;
      this.callbacks.onStyleChange(styleSelect.value);
    });
    this.element.appendChild(styleSelect);
  }

  private createDivider(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'tok-hud-divider';
    return div;
  }
}
