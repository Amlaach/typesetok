export class TokToolbar {
  public element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tok-toolbar';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.padding = '8px 16px';
    this.element.style.background = '#252526';
    this.element.style.borderBottom = '1px solid #333333';
    this.element.style.gap = '12px';
    this.element.dir = 'rtl';

    this.render();
  }

  private render(): void {
    // Document title
    const title = document.createElement('span');
    title.style.fontWeight = 'bold';
    title.style.color = '#4fc3f7';
    title.textContent = 'TypesetOK (TOK)';
    this.element.appendChild(title);

    // Separator
    this.addSeparator();

    // Font Selector
    const fontSelect = document.createElement('select');
    fontSelect.style.background = '#3c3c3c';
    fontSelect.style.color = '#cccccc';
    fontSelect.style.border = '1px solid #555555';
    fontSelect.style.padding = '4px 8px';
    fontSelect.style.borderRadius = '4px';

    const fonts = ['Taamey Frank CLM', 'David CLM', 'Keter YG', 'SBL Hebrew', 'Frank Ruehl CLM'];
    for (const f of fonts) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      fontSelect.appendChild(opt);
    }
    this.element.appendChild(fontSelect);

    // Font size
    const sizeSelect = document.createElement('select');
    sizeSelect.style.background = '#3c3c3c';
    sizeSelect.style.color = '#cccccc';
    sizeSelect.style.border = '1px solid #555555';
    sizeSelect.style.padding = '4px 8px';
    sizeSelect.style.borderRadius = '4px';

    const sizes = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt'];
    for (const s of sizes) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === '11pt') opt.selected = true;
      sizeSelect.appendChild(opt);
    }
    this.element.appendChild(sizeSelect);

    this.addSeparator();

    // Hebrew Typography Actions
    this.addButton('מתיחת אהלתר"ם', () => alert('הפעלת מתיחת אותיות אהלתר"ם (Tier 2 Justification)'));
    this.addButton('נרמול ת"י 6100', () => alert('נרמול רצף תווי ניקוד וטעמים לפי ת"י 6100'));
    this.addButton('ייצוא PDF/X-1a לדפוס', () => {
      // Trigger prepress render
      const win = window as any;
      if (win.tokIpc) {
        win.tokIpc.renderPdf('--demo', 'exported_prepress.pdf');
      }
    });
  }

  private addSeparator(): void {
    const sep = document.createElement('div');
    sep.style.width = '1px';
    sep.style.height = '20px';
    sep.style.background = '#444444';
    this.element.appendChild(sep);
  }

  private addButton(label: string, onClick: () => void): void {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.background = '#0e639c';
    btn.style.color = '#ffffff';
    btn.style.border = 'none';
    btn.style.padding = '4px 12px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.addEventListener('click', onClick);
    this.element.appendChild(btn);
  }
}
