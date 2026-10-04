export * from './virtualizer';

export interface ViewerConfig {
  zoomFactor: number;
  spreadMode: 'single' | 'facing';
  rtlProgression: boolean;
}

export class TokViewer {
  private config: ViewerConfig;

  constructor(config: Partial<ViewerConfig> = {}) {
    this.config = {
      zoomFactor: 1.0,
      spreadMode: 'facing',
      rtlProgression: true,
      ...config,
    };
  }

  public setZoom(factor: number, container: HTMLElement): void {
    if (!Number.isFinite(factor)) return;
    this.config.zoomFactor = Math.max(0.25, Math.min(4.0, factor));
    // CSS zoom resizes the layout box, so scrollbars track the zoomed size; a transform
    // would leave zoomed-in content partly outside the scrollable area.
    container.style.setProperty('zoom', String(this.config.zoomFactor));
  }

  public getZoom(): number {
    return this.config.zoomFactor;
  }
}
