export interface ThemeSettings {
  accentColor: string;
  canvasTone: string;
  density: 'comfortable' | 'compact';
  // Accessibility additions
  highContrast: boolean;
  fontScale: number; // 100, 110, 120, 130
  reducedMotion: boolean;
  enhancedFocus: boolean;
  accessibleFont: boolean;
}

export const ACCENT_PRESETS = [
  { id: 'blue', name: 'כחול קלאסי (Classic Blue)', value: '#2563EB', hover: '#1D4ED8' },
  { id: 'indigo', name: 'אינדיגו עמוק (Deep Indigo)', value: '#4F46E5', hover: '#4338CA' },
  { id: 'cyan', name: 'טורקיז (Vibrant Cyan)', value: '#0891B2', hover: '#0E7490' },
  { id: 'emerald', name: 'ברקת (Emerald Green)', value: '#059669', hover: '#047857' },
  { id: 'violet', name: 'סגול מלכותי (Royal Violet)', value: '#7C3AED', hover: '#6D28D9' },
  { id: 'amber', name: 'ענבר / זהב (Amber Gold)', value: '#D97706', hover: '#B45309' },
];

export const CANVAS_TONE_PRESETS = [
  { id: 'navy', name: 'כחול נייבי עמוק (Deep Navy)', value: '#0B132B', appBg: '#0F172A' },
  { id: 'midnight', name: 'סלייט לילה (Midnight Slate)', value: '#0F172A', appBg: '#1E293B' },
  { id: 'charcoal', name: 'פחם גרפיט (Pure Charcoal)', value: '#121212', appBg: '#1A1A1A' },
  { id: 'zinc', name: 'אבץ כהה (Dark Zinc)', value: '#18181B', appBg: '#27272A' },
];

export class ThemeManager {
  private settings: ThemeSettings;
  private listeners: ((settings: ThemeSettings) => void)[] = [];

  constructor() {
    this.settings = {
      accentColor: '#2563EB',
      canvasTone: '#0B132B',
      density: 'comfortable',
      highContrast: false,
      fontScale: 100,
      reducedMotion: false,
      enhancedFocus: false,
      accessibleFont: false,
    };

    try {
      const saved = localStorage.getItem('tok_theme_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {}

    this.applyTheme();
  }

  public getSettings(): ThemeSettings {
    return { ...this.settings };
  }

  public setAccentColor(color: string): void {
    this.settings.accentColor = color;
    this.saveAndApply();
  }

  public setCanvasTone(tone: string): void {
    this.settings.canvasTone = tone;
    this.saveAndApply();
  }

  public setDensity(density: 'comfortable' | 'compact'): void {
    this.settings.density = density;
    this.saveAndApply();
  }

  public setHighContrast(enabled: boolean): void {
    this.settings.highContrast = enabled;
    this.saveAndApply();
  }

  public setFontScale(scale: number): void {
    this.settings.fontScale = scale;
    this.saveAndApply();
  }

  public setReducedMotion(enabled: boolean): void {
    this.settings.reducedMotion = enabled;
    this.saveAndApply();
  }

  public setEnhancedFocus(enabled: boolean): void {
    this.settings.enhancedFocus = enabled;
    this.saveAndApply();
  }

  public setAccessibleFont(enabled: boolean): void {
    this.settings.accessibleFont = enabled;
    this.saveAndApply();
  }

  private saveAndApply(): void {
    try {
      localStorage.setItem('tok_theme_settings', JSON.stringify(this.settings));
    } catch {}
    this.applyTheme();
    for (const l of this.listeners) l(this.settings);
  }

  public applyTheme(): void {
    const root = document.documentElement;

    // High Contrast Theme override
    if (this.settings.highContrast) {
      root.style.setProperty('--tok-bg-app', '#000000');
      root.style.setProperty('--tok-bg-surface-1', '#050505');
      root.style.setProperty('--tok-bg-surface-2', '#111111');
      root.style.setProperty('--tok-bg-surface-hover', '#222222');
      root.style.setProperty('--tok-bg-elevated', '#0A0A0A');
      root.style.setProperty('--tok-bg-canvas', '#000000');
      root.style.setProperty('--tok-border-subtle', '#444444');
      root.style.setProperty('--tok-border-strong', '#FFFFFF');
      root.style.setProperty('--tok-border-focus', '#FFFF00');
      root.style.setProperty('--tok-text-primary', '#FFFFFF');
      root.style.setProperty('--tok-text-secondary', '#E0E0E0');
      root.style.setProperty('--tok-text-muted', '#CCCCCC');
      root.style.setProperty('--tok-accent-primary', '#3B82F6');
      root.style.setProperty('--tok-accent-hover', '#60A5FA');
    } else {
      root.style.removeProperty('--tok-bg-surface-1');
      root.style.removeProperty('--tok-bg-surface-2');
      root.style.removeProperty('--tok-bg-surface-hover');
      root.style.removeProperty('--tok-bg-elevated');
      root.style.removeProperty('--tok-border-subtle');
      root.style.removeProperty('--tok-border-strong');
      root.style.removeProperty('--tok-border-focus');
      root.style.removeProperty('--tok-text-primary');
      root.style.removeProperty('--tok-text-secondary');
      root.style.removeProperty('--tok-text-muted');

      root.style.setProperty('--tok-accent-primary', this.settings.accentColor);
      const preset = ACCENT_PRESETS.find(p => p.value === this.settings.accentColor);
      root.style.setProperty('--tok-accent-hover', preset ? preset.hover : this.settings.accentColor);

      root.style.setProperty('--tok-bg-canvas', this.settings.canvasTone);
      const tonePreset = CANVAS_TONE_PRESETS.find(p => p.value === this.settings.canvasTone);
      if (tonePreset) {
        root.style.setProperty('--tok-bg-app', tonePreset.appBg);
      }
    }

    // Font scaling
    const baseFontSize = (13 * (this.settings.fontScale / 100)).toFixed(1);
    root.style.fontSize = `${baseFontSize}px`;

    // Density
    if (this.settings.density === 'compact') {
      root.style.setProperty('--tok-top-bar-height', '38px');
      root.style.setProperty('--tok-input-height', '26px');
      root.style.setProperty('--tok-structure-width', '220px');
    } else {
      root.style.setProperty('--tok-top-bar-height', '44px');
      root.style.setProperty('--tok-input-height', '30px');
      root.style.setProperty('--tok-structure-width', '250px');
    }

    // Reduced motion class
    if (this.settings.reducedMotion) {
      root.classList.add('tok-reduced-motion');
    } else {
      root.classList.remove('tok-reduced-motion');
    }

    // Enhanced focus class
    if (this.settings.enhancedFocus) {
      root.classList.add('tok-enhanced-focus');
    } else {
      root.classList.remove('tok-enhanced-focus');
    }

    // Accessible Hebrew font
    if (this.settings.accessibleFont) {
      root.style.setProperty('--tok-font-system', "Assistant, -apple-system, 'Segoe UI', Arial, sans-serif");
    } else {
      root.style.removeProperty('--tok-font-system');
    }
  }

  public onChange(listener: (settings: ThemeSettings) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const themeManager = new ThemeManager();
