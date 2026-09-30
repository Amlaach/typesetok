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
    this.config.zoomFactor = Math.max(0.25, Math.min(4.0, factor));
    container.style.transform = `scale(${this.config.zoomFactor})`;
    container.style.transformOrigin = 'top center';
  }

  public getZoom(): number {
    return this.config.zoomFactor;
  }
}
