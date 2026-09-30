import { TokToolbar } from './components/Toolbar';
import { PagesPanel } from './components/PagesPanel';
import { PageDomVirtualizer, PageDescriptor } from 'tok-viewer';
import { CanvasInteractionOverlay } from 'tok-canvas';
import { StoryEditor } from 'tok-story-editor';

export class TypesetOkApp {
  private root: HTMLElement;
  private toolbar: TokToolbar;
  private pagesPanel: PagesPanel;
  private virtualizer: PageDomVirtualizer;
  private overlay: CanvasInteractionOverlay;
  private storyEditor: StoryEditor;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.height = '100vh';
    this.root.style.background = '#181818';
    this.root.style.color = '#e0e0e0';

    // 1. Toolbar
    this.toolbar = new TokToolbar();
    this.root.appendChild(this.toolbar.element);

    // 2. Main Workbench
    const workbench = document.createElement('div');
    workbench.style.display = 'flex';
    workbench.style.flex = '1';
    workbench.style.overflow = 'hidden';
    this.root.appendChild(workbench);

    // Left: Pages panel
    this.pagesPanel = new PagesPanel();
    workbench.appendChild(this.pagesPanel.element);

    // Center: Paged Media Viewport with Overlay
    const centerContainer = document.createElement('div');
    centerContainer.style.position = 'relative';
    centerContainer.style.flex = '1';
    centerContainer.style.overflowY = 'auto';
    centerContainer.style.background = '#121212';
    workbench.appendChild(centerContainer);

    this.virtualizer = new PageDomVirtualizer(centerContainer);
    this.overlay = new CanvasInteractionOverlay(centerContainer);

    // Right: Story Editor panel
    const storyContainer = document.createElement('div');
    storyContainer.style.width = '380px';
    storyContainer.style.background = '#1e1e1e';
    storyContainer.style.borderRight = '1px solid #333333';
    storyContainer.style.display = 'flex';
    storyContainer.style.flexDirection = 'column';
    workbench.appendChild(storyContainer);

    const storyHeader = document.createElement('div');
    storyHeader.style.padding = '8px 16px';
    storyHeader.style.background = '#252526';
    storyHeader.style.borderBottom = '1px solid #333333';
    storyHeader.style.fontWeight = 'bold';
    storyHeader.style.fontSize = '12px';
    storyHeader.style.color = '#888888';
    storyHeader.dir = 'rtl';
    storyHeader.textContent = 'עורך סיפור רציף (Story Editor)';
    storyContainer.appendChild(storyHeader);

    this.storyEditor = new StoryEditor(storyContainer);

    // Wire up events
    this.pagesPanel.onSelectPage((idx) => {
      this.virtualizer.scrollToPage(idx);
    });

    this.storyEditor.onTextChange((paraId, newText) => {
      console.log(`[TOK-UI] Text changed in paragraph ${paraId}: ${newText.length} chars`);
      // Trigger optimistic caret advance in overlay
      this.overlay.advanceCaretOptimisticRtl(7.5);
    });
  }

  public loadDocumentPages(pages: PageDescriptor[]): void {
    this.virtualizer.setPages(pages);
    this.pagesPanel.setPages(
      pages.map((p) => ({
        pageIndex: p.pageIndex,
        gematria: p.gematriaNumber,
      }))
    );
  }
}
