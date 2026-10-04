export interface ThemePalette {
  id: string;
  name: string;
  desc: string;
  appBg: string;
  surface1: string;
  surface2: string;
  surfaceHover: string;
  elevated: string;
  canvas: string;
  borderSubtle: string;
  borderStrong: string;
  borderFocus: string;
  accent: string;
  accentHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  previewColors: string[];
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'navy',
    name: 'כחול נייבי עמוק (Deep Navy & Sapphire)',
    desc: 'ערכת הדגל של TypesetOK — כחול לילה מקצועי וניגודיות מלוטשת',
    appBg: '#0B132B',
    surface1: '#0F172A',
    surface2: '#1E293B',
    surfaceHover: '#293548',
    elevated: '#1E293B',
    canvas: '#060B18',
    borderSubtle: '#1E293B',
    borderStrong: '#334155',
    borderFocus: '#3B82F6',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    previewColors: ['#0B132B', '#1E293B', '#2563EB', '#60A5FA']
  },
  {
    id: 'parchment',
    name: 'קלף עברי מהודר (Warm Parchment & Sepia)',
    desc: 'השראת דפוסי וילנא וספרי קודש עתיקים — גווני ספיה, עץ וקלף חמים',
    appBg: '#231F1A',
    surface1: '#2D2822',
    surface2: '#3C352E',
    surfaceHover: '#4B4239',
    elevated: '#342E27',
    canvas: '#181512',
    borderSubtle: '#453D35',
    borderStrong: '#64584C',
    borderFocus: '#F59E0B',
    accent: '#D97706',
    accentHover: '#B45309',
    textPrimary: '#FAF5EF',
    textSecondary: '#D1C7BD',
    textMuted: '#9E9285',
    previewColors: ['#231F1A', '#3C352E', '#D97706', '#F59E0B']
  },
  {
    id: 'graphite',
    name: 'פחם גרפיט וזהב (Graphite & Amber Gold)',
    desc: 'סטודיו מודרני מוקפד — פחם עמוק עם הדגשות זהב חמות',
    appBg: '#18181B',
    surface1: '#27272A',
    surface2: '#3F3F46',
    surfaceHover: '#52525B',
    elevated: '#2D2D32',
    canvas: '#09090B',
    borderSubtle: '#2E2E33',
    borderStrong: '#52525B',
    borderFocus: '#EAB308',
    accent: '#EAB308',
    accentHover: '#CA8A04',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    previewColors: ['#18181B', '#27272A', '#EAB308', '#FDE047']
  },
  {
    id: 'indigo',
    name: 'אינדיגו רויאל ואזמרגד (Royal Indigo & Emerald)',
    desc: 'עושר חזותי מלא הדר — אינדיגו עמוק עם נגיעות אזמרגד ירוקות',
    appBg: '#1E1B4B',
    surface1: '#2E285F',
    surface2: '#4338CA',
    surfaceHover: '#5345E6',
    elevated: '#352D70',
    canvas: '#0F0D2B',
    borderSubtle: '#3730A3',
    borderStrong: '#6366F1',
    borderFocus: '#10B981',
    accent: '#10B981',
    accentHover: '#059669',
    textPrimary: '#EEF2FF',
    textSecondary: '#C7D2FE',
    textMuted: '#818CF8',
    previewColors: ['#1E1B4B', '#4338CA', '#10B981', '#34D399']
  },
  {
    id: 'light',
    name: 'סטודיו בהיר קלאסי (Classic Light Studio)',
    desc: 'ניקיון ובהירות מוחלטים — סביבת עבודה מוארת ונעימה לקריאה',
    appBg: '#F1F5F9',
    surface1: '#FFFFFF',
    surface2: '#E2E8F0',
    surfaceHover: '#CBD5E1',
    elevated: '#FFFFFF',
    canvas: '#94A3B8',
    borderSubtle: '#E2E8F0',
    borderStrong: '#CBD5E1',
    borderFocus: '#2563EB',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    previewColors: ['#F1F5F9', '#FFFFFF', '#2563EB', '#0F172A']
  }
];

export interface ThemeSettings {
  paletteId: string;
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
      paletteId: 'navy',
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

  public setPalette(paletteId: string): void {
    const palette = THEME_PALETTES.find(p => p.id === paletteId);
    if (palette) {
      this.settings.paletteId = paletteId;
      this.settings.accentColor = palette.accent;
      this.settings.canvasTone = palette.canvas;
      this.saveAndApply();
    }
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
      const palette = THEME_PALETTES.find(p => p.id === this.settings.paletteId) || THEME_PALETTES[0];

      root.style.setProperty('--tok-bg-app', palette.appBg);
      root.style.setProperty('--tok-bg-surface-1', palette.surface1);
      root.style.setProperty('--tok-bg-surface-2', palette.surface2);
      root.style.setProperty('--tok-bg-surface-hover', palette.surfaceHover);
      root.style.setProperty('--tok-bg-elevated', palette.elevated);
      root.style.setProperty('--tok-bg-canvas', this.settings.canvasTone || palette.canvas);
      root.style.setProperty('--tok-border-subtle', palette.borderSubtle);
      root.style.setProperty('--tok-border-strong', palette.borderStrong);
      root.style.setProperty('--tok-border-focus', palette.borderFocus);
      root.style.setProperty('--tok-text-primary', palette.textPrimary);
      root.style.setProperty('--tok-text-secondary', palette.textSecondary);
      root.style.setProperty('--tok-text-muted', palette.textMuted);

      root.style.setProperty('--tok-accent-primary', this.settings.accentColor || palette.accent);
      const preset = ACCENT_PRESETS.find(p => p.value === this.settings.accentColor);
      root.style.setProperty('--tok-accent-hover', preset ? preset.hover : palette.accentHover);
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
