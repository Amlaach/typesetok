/**
 * Shared keyboard/focus behavior for the full-screen modals (Welcome, Settings, About):
 *  - role="dialog" + aria-modal, labelled by the element carrying `data-modal-title`
 *  - Escape closes; clicking the dimmed backdrop closes (optional)
 *  - Tab / Shift+Tab cycle inside the dialog instead of escaping to the workbench behind it
 *  - focus moves into the dialog on open and returns to the previously focused control on close
 *  - re-renders keep focus on the "same" control via `data-focus-key`
 *    (the modals rebuild their DOM on every tab switch, which used to drop focus to <body>)
 */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let titleSeq = 0;

export class ModalController {
  private previousFocus: HTMLElement | null = null;
  private open = false;

  constructor(
    private readonly overlay: HTMLElement,
    private readonly requestClose: () => void,
    options: { closeOnBackdrop?: boolean } = {}
  ) {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // Listen on the document: after a re-render the focused node may be gone and
    // events would then originate from <body>, outside the overlay.
    document.addEventListener('keydown', (e) => {
      if (!this.open || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.requestClose();
      } else if (e.key === 'Tab') {
        this.cycleFocus(e);
      }
    });

    if (options.closeOnBackdrop) {
      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) this.requestClose();
      });
    }
  }

  public isOpen(): boolean {
    return this.open;
  }

  /** Call when the modal becomes visible (after its first render). */
  public opened(): void {
    if (!this.open) {
      const active = document.activeElement;
      this.previousFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    this.open = true;
    if (!this.overlay.contains(document.activeElement)) this.focusFirst();
  }

  /** Call when the modal is hidden. */
  public closed(): void {
    if (!this.open) return;
    this.open = false;
    const prev = this.previousFocus;
    this.previousFocus = null;
    if (prev && prev.isConnected) prev.focus();
  }

  /** Returns the focus key of the focused control inside the dialog (call before re-rendering). */
  public captureFocus(): string | null {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.overlay.contains(active)) return null;
    return active.dataset.focusKey ?? null;
  }

  /** Re-applies aria-labelledby and restores focus after a re-render. */
  public afterRender(focusKey: string | null): void {
    const title = this.overlay.querySelector<HTMLElement>('[data-modal-title]');
    if (title) {
      if (!title.id) title.id = `tok-modal-title-${++titleSeq}`;
      this.overlay.setAttribute('aria-labelledby', title.id);
    }
    if (!this.open) return;
    const target = focusKey
      ? this.overlay.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)
      : null;
    if (target) target.focus();
    else if (!this.overlay.contains(document.activeElement)) this.focusFirst();
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.overlay.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  private focusFirst(): void {
    const preferred = this.overlay.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? this.focusables()[0])?.focus();
  }

  private cycleFocus(e: KeyboardEvent): void {
    const items = this.focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? (idx <= 0 ? items.length - 1 : idx - 1)
      : (idx < 0 || idx === items.length - 1 ? 0 : idx + 1);
    e.preventDefault();
    items[next].focus();
  }
}
