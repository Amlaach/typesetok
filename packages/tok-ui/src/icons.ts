/**
 * Professional SVG Vector Icons for TypesetOK (TOK) Desktop Publishing System
 * Replaces all emojis with clean, pixel-aligned vector iconography.
 */

export type IconName =
  | 'brand'
  | 'folder'
  | 'file'
  | 'search'
  | 'settings'
  | 'info'
  | 'pages'
  | 'flows'
  | 'typography'
  | 'layers'
  | 'canvas'
  | 'split'
  | 'story'
  | 'export'
  | 'globe'
  | 'check'
  | 'close'
  | 'eye'
  | 'eyeOff'
  | 'lock'
  | 'unlock'
  | 'refresh'
  | 'trash'
  | 'plugin'
  | 'accessibility'
  | 'contrast'
  | 'textScale'
  | 'motion'
  | 'keyboard'
  | 'templateTalmud'
  | 'templateBook'
  | 'templateColumns'
  | 'templateBlank'
  | 'sparkle'
  | 'alignJustify'
  | 'warning'
  | 'chevronDown'
  | 'image'
  | 'frame'
  | 'zap'
  | 'ruler';

const ICONS_SVG: Record<IconName, string> = {
  brand: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H16V3.5A1.5 1.5 0 0 0 14.5 2H6.5A2.5 2.5 0 0 0 4 4.5v12z"/>
      <path d="M16 14v4.5A1.5 1.5 0 0 1 14.5 20H6.5A2.5 2.5 0 0 1 4 17.5"/>
      <line x1="7.5" y1="6" x2="12.5" y2="6"/>
      <line x1="7.5" y1="9.5" x2="12.5" y2="9.5"/>
    </svg>
  `,
  folder: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.8a1.5 1.5 0 0 1 1.06.44L10.5 6H16A1.5 1.5 0 0 1 17.5 7.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15.5v-10z"/>
    </svg>
  `,
  file: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 3A1.5 1.5 0 0 1 6 1.5h5.5l5 5V17A1.5 1.5 0 0 1 15 18.5H6A1.5 1.5 0 0 1 4.5 17V3z"/>
      <path d="M11.5 1.5v5h5"/>
    </svg>
  `,
  search: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8.5" cy="8.5" r="5.5"/>
      <line x1="12.5" y1="12.5" x2="17" y2="17"/>
    </svg>
  `,
  settings: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="3"/>
      <path d="M16.2 12.4a1.2 1.2 0 0 0 .25 1.35l.06.06a1.4 1.4 0 1 1-1.98 1.98l-.06-.06a1.2 1.2 0 0 0-1.35-.25 1.2 1.2 0 0 0-.75 1.12v.16a1.4 1.4 0 0 1-2.8 0v-.16a1.2 1.2 0 0 0-.75-1.12 1.2 1.2 0 0 0-1.35.25l-.06.06a1.4 1.4 0 1 1-1.98-1.98l.06-.06a1.2 1.2 0 0 0 .25-1.35 1.2 1.2 0 0 0-1.12-.75H4.4a1.4 1.4 0 0 1 0-2.8h.16a1.2 1.2 0 0 0 1.12-.75 1.2 1.2 0 0 0-.25-1.35l-.06-.06a1.4 1.4 0 1 1 1.98-1.98l.06.06a1.2 1.2 0 0 0 1.35.25h.06a1.2 1.2 0 0 0 .75-1.12V3.4a1.4 1.4 0 0 1 2.8 0v.16a1.2 1.2 0 0 0 .75 1.12 1.2 1.2 0 0 0 1.35-.25l.06-.06a1.4 1.4 0 1 1 1.98 1.98l-.06.06a1.2 1.2 0 0 0-.25 1.35v.06a1.2 1.2 0 0 0 1.12.75h.16a1.4 1.4 0 0 1 0 2.8h-.16a1.2 1.2 0 0 0-1.12.75z"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="8"/>
      <line x1="10" y1="9" x2="10" y2="14"/>
      <circle cx="10" cy="6" r="0.75" fill="currentColor"/>
    </svg>
  `,
  pages: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5.5" y="4.5" width="11" height="13" rx="1.5"/>
      <path d="M3.5 13.5V3A1.5 1.5 0 0 1 5 1.5h9.5"/>
    </svg>
  `,
  flows: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 5c2.5 0 2.5 4 5 4s2.5-4 5-4 2.5 4 5 4"/>
      <path d="M3 11c2.5 0 2.5 4 5 4s2.5-4 5-4 2.5 4 5 4"/>
    </svg>
  `,
  typography: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 6 10 3 16 6"/>
      <line x1="10" y1="3" x2="10" y2="17"/>
      <line x1="7" y1="17" x2="13" y2="17"/>
    </svg>
  `,
  layers: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="10 2.5 17.5 6.5 10 10.5 2.5 6.5 10 2.5"/>
      <polyline points="2.5 10 10 14 17.5 10"/>
      <polyline points="2.5 13.5 10 17.5 17.5 13.5"/>
    </svg>
  `,
  canvas: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/>
      <line x1="3.5" y1="7" x2="16.5" y2="7"/>
    </svg>
  `,
  split: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/>
      <line x1="10" y1="3.5" x2="10" y2="16.5"/>
    </svg>
  `,
  story: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3.5" y1="4.5" x2="16.5" y2="4.5"/>
      <line x1="3.5" y1="8.5" x2="16.5" y2="8.5"/>
      <line x1="3.5" y1="12.5" x2="12.5" y2="12.5"/>
      <line x1="3.5" y1="16.5" x2="14.5" y2="16.5"/>
    </svg>
  `,
  export: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 13v3a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16v-3"/>
      <polyline points="6.5 7 10 3.5 13.5 7"/>
      <line x1="10" y1="3.5" x2="10" y2="13"/>
    </svg>
  `,
  globe: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <line x1="2.5" y1="10" x2="17.5" y2="10"/>
      <ellipse cx="10" cy="10" rx="3.5" ry="7.5"/>
    </svg>
  `,
  check: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4.5 10.5 8.5 14.5 15.5 6.5"/>
    </svg>
  `,
  close: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="5" x2="15" y2="15"/>
      <line x1="15" y1="5" x2="5" y2="15"/>
    </svg>
  `,
  eye: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z"/>
      <circle cx="10" cy="10" r="2.5"/>
    </svg>
  `,
  eyeOff: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.5 3.5l13 13"/>
      <path d="M9.8 4.5A8.8 8.8 0 0 1 18 10s-1.8 3.3-4.7 4.7"/>
      <path d="M6.5 6.5C3.8 8 2 10 2 10s3 5.5 8 5.5c1.4 0 2.7-.4 3.9-1.1"/>
      <path d="M8.5 8.6a2.5 2.5 0 0 0 3 3"/>
    </svg>
  `,
  lock: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4.5" y="9" width="11" height="8.5" rx="1.5"/>
      <path d="M7 9V6a3 3 0 0 1 6 0v3"/>
    </svg>
  `,
  unlock: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4.5" y="9" width="11" height="8.5" rx="1.5"/>
      <path d="M7 9V5.5a3 3 0 0 1 5.8-1"/>
    </svg>
  `,
  refresh: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 9A7.5 7.5 0 1 1 15 4.5l2.5.5"/>
      <polyline points="17.5 1 17.5 5 13.5 5"/>
    </svg>
  `,
  trash: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3.5 5.5 16.5 5.5"/>
      <path d="M6.5 5.5V4a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v1.5"/>
      <path d="M5.5 5.5v10.5A1.5 1.5 0 0 0 7 17.5h6a1.5 1.5 0 0 0 1.5-1.5V5.5"/>
    </svg>
  `,
  plugin: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11h2a2 2 0 1 0 0-4H4V4h3a2 2 0 1 0 4 0h5v3a2 2 0 1 0 0 4v5h-3a2 2 0 1 0-4 0H4v-5z"/>
    </svg>
  `,
  accessibility: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="4" r="1.5"/>
      <path d="M4 8.5h12"/>
      <path d="M10 8.5V17"/>
      <path d="M7 17l3-4 3 4"/>
    </svg>
  `,
  contrast: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M10 2.5A7.5 7.5 0 0 1 10 17.5v-15z" fill="currentColor"/>
    </svg>
  `,
  textScale: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 15.5l4-10 4 10"/>
      <line x1="4" y1="12" x2="9" y2="12"/>
      <path d="M12.5 15.5l3-7 3 7"/>
      <line x1="13.7" y1="13" x2="17.3" y2="13"/>
    </svg>
  `,
  motion: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7h7a3 3 0 0 1 0 6H3"/>
      <line x1="14" y1="10" x2="17" y2="10"/>
      <polyline points="7 4 3 7 7 10"/>
    </svg>
  `,
  keyboard: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="5" width="15" height="10" rx="1.5"/>
      <line x1="5.5" y1="8" x2="6.5" y2="8"/>
      <line x1="9.5" y1="8" x2="10.5" y2="8"/>
      <line x1="13.5" y1="8" x2="14.5" y2="8"/>
      <line x1="6.5" y1="12" x2="13.5" y2="12"/>
    </svg>
  `,
  templateTalmud: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="1.5"/>
      <rect x="6.5" y="6" width="7" height="8" rx="0.5"/>
      <line x1="4.5" y1="6" x2="5.5" y2="6"/>
      <line x1="4.5" y1="8" x2="5.5" y2="8"/>
      <line x1="14.5" y1="6" x2="15.5" y2="6"/>
      <line x1="14.5" y1="8" x2="15.5" y2="8"/>
    </svg>
  `,
  templateBook: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 4.5A2 2 0 0 1 5 2.5h5v15H5a2 2 0 0 0-2 2V4.5z"/>
      <path d="M17 4.5A2 2 0 0 0 15 2.5h-5v15h5a2 2 0 0 1 2 2V4.5z"/>
    </svg>
  `,
  templateColumns: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="3" width="4" height="14" rx="1"/>
      <rect x="8" y="3" width="4" height="14" rx="1"/>
      <rect x="13.5" y="3" width="4" height="14" rx="1"/>
    </svg>
  `,
  templateBlank: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.5" stroke-dasharray="2 2"/>
      <line x1="10" y1="8" x2="10" y2="12"/>
      <line x1="8" y1="10" x2="12" y2="10"/>
    </svg>
  `,
  sparkle: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2.5l1.8 5.7 5.7 1.8-5.7 1.8-1.8 5.7-1.8-5.7-5.7-1.8 5.7-1.8 1.8-5.7z"/>
    </svg>
  `,
  alignJustify: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <line x1="3" y1="4.5" x2="17" y2="4.5"/>
      <line x1="3" y1="8.5" x2="17" y2="8.5"/>
      <line x1="3" y1="12.5" x2="17" y2="12.5"/>
      <line x1="3" y1="16.5" x2="17" y2="16.5"/>
    </svg>
  `,
  warning: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2.5L2 17h16L10 2.5z"/>
      <line x1="10" y1="8" x2="10" y2="12"/>
      <circle cx="10" cy="14.5" r="0.75" fill="currentColor"/>
    </svg>
  `,
  chevronDown: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="5.5 7.5 10 12 14.5 7.5"/>
    </svg>
  `,
  image: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="1.5"/>
      <circle cx="7.5" cy="7.5" r="1.5"/>
      <polyline points="17 13.5 13 9.5 6 16.5"/>
    </svg>
  `,
  frame: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="1"/>
      <line x1="3" y1="7.5" x2="17" y2="7.5"/>
      <line x1="7.5" y1="3" x2="7.5" y2="17"/>
    </svg>
  `,
  zap: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 1.5 3.5 10.5 9.5 10.5 8.5 18.5 16.5 9.5 10.5 9.5 11 1.5"/>
    </svg>
  `,
  ruler: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="6" width="15" height="8" rx="1"/>
      <line x1="5.5" y1="6" x2="5.5" y2="9"/>
      <line x1="8.5" y1="6" x2="8.5" y2="11"/>
      <line x1="11.5" y1="6" x2="11.5" y2="9"/>
      <line x1="14.5" y1="6" x2="14.5" y2="11"/>
    </svg>
  `
};

/**
 * Returns an inline SVG string for the specified icon.
 */
export function renderIcon(name: IconName, size: number = 14, extraClass: string = ''): string {
  const rawSvg = ICONS_SVG[name] || ICONS_SVG.file;
  return `<span class="tok-icon-wrap ${extraClass}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;vertical-align:middle;flex-shrink:0;">
    ${rawSvg.replace('<svg ', `<svg width="${size}" height="${size}" `)}
  </span>`;
}

/**
 * Creates an HTMLElement with the rendered SVG icon.
 */
export function createIconElement(name: IconName, size: number = 14, extraClass: string = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = `tok-icon-wrap ${extraClass}`;
  span.style.display = 'inline-flex';
  span.style.alignItems = 'center';
  span.style.justifyContent = 'center';
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.style.verticalAlign = 'middle';
  span.style.flexShrink = '0';
  const rawSvg = ICONS_SVG[name] || ICONS_SVG.file;
  span.innerHTML = rawSvg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  return span;
}
