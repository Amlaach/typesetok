/**
 * Small DOM helpers shared by the components so every control is built the same way.
 * All visual styling lives in index.html (classes + theme tokens); these helpers only
 * set structure, text and ARIA. Text always goes in as textContent, never as HTML.
 */
import { renderIcon, IconName } from './icons';

type Attrs = Record<string, string | number | boolean | undefined | null>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Attrs,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(name: IconName, size = 16): HTMLElement {
  const span = document.createElement('span');
  span.innerHTML = renderIcon(name, size);
  const inner = span.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.setAttribute('aria-hidden', 'true');
    return inner;
  }
  return span;
}

/** Button with an optional leading icon and a text label. */
export function button(
  label: string,
  options: { className?: string; icon?: IconName; iconSize?: number; onClick?: (e: MouseEvent) => void; attrs?: Attrs } = {}
): HTMLButtonElement {
  const b = el('button', options.className ?? 'tok-btn', { type: 'button', ...options.attrs });
  if (options.icon) b.appendChild(icon(options.icon, options.iconSize ?? 16));
  if (label) b.appendChild(el('span', undefined, undefined, label));
  if (options.onClick) b.addEventListener('click', options.onClick);
  return b;
}

/** Icon-only button: the label becomes its accessible name and tooltip. */
export function iconButton(
  name: IconName,
  label: string,
  onClick?: (e: MouseEvent) => void,
  options: { size?: number; className?: string; attrs?: Attrs } = {}
): HTMLButtonElement {
  const b = el('button', options.className ?? 'tok-icon-btn', { type: 'button', 'aria-label': label, title: label, ...options.attrs });
  b.appendChild(icon(name, options.size ?? 18));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Keyboard shortcut chip (always laid out left-to-right). */
export function kbd(text: string): HTMLElement {
  return el('kbd', 'tok-kbd', { dir: 'ltr' }, text);
}

/** On/off switch (role="switch"). Returns the row; `onChange` gets the new state. */
export function switchRow(
  label: string,
  checked: boolean,
  onChange: (value: boolean) => void,
  options: { description?: string; disabled?: boolean; focusKey?: string } = {}
): HTMLElement {
  const row = el('div', 'tok-switch-row');
  const text = el('span', 'tok-switch-text');
  const id = `tok-sw-${Math.random().toString(36).slice(2, 9)}`;
  text.appendChild(el('span', undefined, { id }, label));
  if (options.description) text.appendChild(el('span', 'tok-switch-desc', undefined, options.description));
  row.appendChild(text);
  const sw = el('button', 'tok-switch', {
    type: 'button',
    role: 'switch',
    'aria-checked': String(checked),
    'aria-labelledby': id,
    disabled: options.disabled,
    'data-focus-key': options.focusKey
  });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  row.appendChild(sw);
  return row;
}

/** Segmented control. Buttons carry aria-pressed; returns the group element. */
export function segmented<T extends string>(
  label: string,
  options: { id: T; label: string; icon?: IconName; title?: string }[],
  active: T,
  onSelect: (id: T) => void,
  config: { fill?: boolean; iconOnly?: boolean; focusPrefix?: string } = {}
): HTMLElement {
  const group = el('div', config.fill ? 'tok-seg tok-seg-fill' : 'tok-seg', { role: 'group', 'aria-label': label });
  for (const opt of options) {
    const b = el('button', 'tok-seg-btn', {
      type: 'button',
      'aria-pressed': String(opt.id === active),
      'aria-label': config.iconOnly ? opt.label : undefined,
      title: opt.title ?? (config.iconOnly ? opt.label : undefined),
      'data-focus-key': config.focusPrefix ? `${config.focusPrefix}-${opt.id}` : undefined
    });
    if (opt.icon) b.appendChild(icon(opt.icon, 17));
    if (!config.iconOnly) b.appendChild(el('span', undefined, undefined, opt.label));
    b.addEventListener('click', () => {
      group.querySelectorAll('.tok-seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onSelect(opt.id);
    });
    group.appendChild(b);
  }
  return group;
}

/** Titled group inside a dialog: heading, optional hint, then the body. */
export function group(title: string, body: HTMLElement | HTMLElement[], hint?: string): HTMLElement {
  const g = el('section', 'tok-group');
  const head = el('div', 'tok-group-head');
  head.appendChild(el('h3', undefined, undefined, title));
  if (hint) head.appendChild(el('p', undefined, undefined, hint));
  g.appendChild(head);
  for (const b of Array.isArray(body) ? body : [body]) g.appendChild(b);
  return g;
}

/** Labelled <select>. */
export function selectField(
  label: string,
  options: { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void,
  attrs?: Attrs
): HTMLSelectElement {
  const sel = el('select', 'tok-select', { 'aria-label': label, ...attrs });
  for (const o of options) {
    const opt = el('option', undefined, { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
