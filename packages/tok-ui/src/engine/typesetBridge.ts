/**
 * Typeset Bridge
 *
 * Maps Rust `PageLayoutBox` geometry produced by `tok-cli typeset-document`
 * (and `TypesettingEngine::typeset_document`) to UI `PageDescriptor` objects
 * rendered natively in SpreadCanvas.
 */

import { PageDescriptor } from 'tok-viewer';
import { toHebrewGematria } from '../gematria.js';

export interface PhysicalPoint {
  x: number;
  y: number;
}

export interface PhysicalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlyphBox {
  glyph_id: number;
  cluster: number;
  x: number;
  y: number;
  width: number;
  height: number;
  character?: string;
  font_index?: number;
}

export interface LineBox {
  line_index: number;
  paragraph_id?: string | null;
  baseline_y: number;
  height: number;
  width: number;
  glyphs?: GlyphBox[];
  text: string;
  is_rtl: boolean;
  fonts?: string[];
}

export interface TextFrameBox {
  frame_id: string;
  flow_id: string;
  rect: PhysicalRect;
  lines: LineBox[];
}

export interface BreakToken {
  section_index: number;
  paragraph_index: number;
  char_offset: number;
}

export interface PageLayoutBox {
  page_index: number;
  page_number_gematria: string;
  dimensions: PhysicalRect;
  frames: TextFrameBox[];
  break_token?: BreakToken | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const ENGINE_FONT_STACK = "'Frank Ruhl Libre', 'Noto Rashi Hebrew', 'Noto Serif Hebrew', 'David Libre', serif";

export function formatEngineFont(family?: string, isPrimary = true): { fontFamily: string; fontWeight?: number } {
  if (!family) {
    return {
      fontFamily: isPrimary
        ? `'Frank Ruhl Libre', ${ENGINE_FONT_STACK}`
        : `'Noto Rashi Hebrew', ${ENGINE_FONT_STACK}`
    };
  }

  const isBold = family.endsWith(' Bold') || family.includes('Bold');
  const baseFamily = family.replace(/\s+Bold$/i, '').trim();

  return {
    fontFamily: `'${baseFamily}', ${ENGINE_FONT_STACK}`,
    fontWeight: isBold ? 700 : undefined
  };
}

/**
 * Converts Rust PageLayoutBox array to tok-viewer PageDescriptor array.
 * Uses exact text positions, line heights, baselines, paragraph IDs,
 * and page dimensions calculated by the Rust typesetting engine.
 */
export function layoutToPageDescriptors(pages: PageLayoutBox[]): PageDescriptor[] {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [];
  }

  return pages.map((pageBox) => {
    const pageIndex = typeof pageBox.page_index === 'number' ? pageBox.page_index : 0;
    const gematriaNumber = pageBox.page_number_gematria || toHebrewGematria(pageIndex + 1);
    const pageWidth = pageBox.dimensions?.width || 595.28;
    const pageHeight = pageBox.dimensions?.height || 841.89;

    // Content area in points - calculated dynamically from frame bounds or page margins
    const hasFrames = Array.isArray(pageBox.frames) && pageBox.frames.length > 0;
    const minFrameX = hasFrames ? Math.min(...pageBox.frames.map((f) => f.rect.x)) : 42.5;
    const minFrameY = hasFrames ? Math.min(...pageBox.frames.map((f) => f.rect.y)) : 42.5;
    const maxFrameRight = hasFrames
      ? Math.max(...pageBox.frames.map((f) => f.rect.x + f.rect.width))
      : (pageWidth - minFrameX);
    const maxFrameBottom = hasFrames
      ? Math.max(...pageBox.frames.map((f) => f.rect.y + f.rect.height))
      : (pageHeight - minFrameY);

    const marginInner = Math.max(0, minFrameX);
    const marginTop = Math.max(0, minFrameY);
    const contentWidthPt = Math.max(1, maxFrameRight - marginInner);
    const contentHeightPt = Math.max(1, maxFrameBottom - marginTop);

    // SpreadCanvas sheet content box: 404px width, 577px height
    const TARGET_CONTENT_W = 404;
    const TARGET_CONTENT_H = 577;
    const scaleX = TARGET_CONTENT_W / contentWidthPt;
    const scaleY = TARGET_CONTENT_H / contentHeightPt;

    const framesHtml = (pageBox.frames || []).map((frame) => {
      const relX = Math.max(0, frame.rect.x - marginInner);
      const relY = Math.max(0, frame.rect.y - marginTop);

      const leftPx = Math.max(0, Math.round(relX * scaleX));
      const topPx = Math.max(0, Math.round(relY * scaleY));
      const widthPx = Math.max(20, Math.round(frame.rect.width * scaleX));
      const heightPx = Math.max(20, Math.round(frame.rect.height * scaleY));

      const flowId = frame.flow_id || 'gemara';
      const frameId = frame.frame_id || `frame_${pageIndex}_${flowId}`;

      const isExpansion = flowId.endsWith('_expansion');
      const baseFlowId = isExpansion ? flowId.replace(/_expansion$/, '') : flowId;

      let flowClass = 'tok-frame-comm';
      if (baseFlowId === 'gemara' || baseFlowId === 'main' || baseFlowId === 'primary') {
        flowClass = 'tok-frame-gemara';
      } else if (baseFlowId === 'notes' || baseFlowId === 'footnote' || baseFlowId === 'heorot') {
        flowClass = 'tok-frame-notes';
      } else if (isExpansion) {
        flowClass = 'tok-frame-comm tok-frame-expansion tok-frame-l-shape';
      }

      const isPrimary = baseFlowId === 'gemara' || baseFlowId === 'main' || baseFlowId === 'primary';

      const linesHtml = (frame.lines || []).map((line) => {
        // Exact physical top offset from Rust layout engine: baseline_y - height
        const topOffsetPt = Math.max(0, line.baseline_y - line.height);
        const lineTopPx = topOffsetPt * scaleY;
        const lineHPx = Math.max(1, line.height * scaleY);

        const engineFont = formatEngineFont(line.fonts?.[0], isPrimary);
        const fontStyle = `font-family: ${engineFont.fontFamily};` + (engineFont.fontWeight ? ` font-weight: ${engineFont.fontWeight};` : '');
        const paraAttr = line.paragraph_id ? ` data-para-id="${escapeHtml(String(line.paragraph_id))}"` : '';

        return `<div class="tok-line-box tok-line" data-line-index="${line.line_index}"${paraAttr} data-baseline-y="${line.baseline_y}" data-line-height="${line.height}" data-line-width="${line.width}" style="position: absolute; top: ${lineTopPx.toFixed(2)}px; left: 0; right: 0; height: ${lineHPx.toFixed(2)}px; line-height: ${lineHPx.toFixed(2)}px; ${fontStyle} direction: ${line.is_rtl ? 'rtl' : 'ltr'}; white-space: nowrap !important; overflow: visible; contain: layout style;">${escapeHtml(line.text)}</div>`;
      }).join('\n');

      const emptyNotice = (!frame.lines || frame.lines.length === 0)
        ? `<div class="tok-frame-empty" style="font-size: 10px; color: var(--tok-text-muted); font-style: italic; text-align: center; padding-top: 15px;">[אין טקסט בעמוד זה]</div>`
        : '';

      return `
        <div class="tok-interactive-frame tok-frame-rust ${flowClass}"
             data-frame-id="${escapeHtml(frameId)}"
             data-flow-id="${escapeHtml(flowId)}"
             data-base-flow-id="${escapeHtml(baseFlowId)}"
             data-is-expansion="${isExpansion ? 'true' : 'false'}"
             data-rect-x="${frame.rect.x}"
             data-rect-y="${frame.rect.y}"
             data-rect-w="${frame.rect.width}"
             data-rect-h="${frame.rect.height}"
             style="position: absolute; left: ${leftPx}px; top: ${topPx}px; width: ${widthPx}px; height: ${heightPx}px; overflow: hidden;">
          <div class="tok-frame-inner" style="position: relative; width: 100%; height: 100%;">
            ${linesHtml}
            ${emptyNotice}
          </div>
        </div>
      `;
    }).join('\n');

    const htmlContent = `
      <div class="tok-page-layout-rust" data-page-index="${pageIndex}" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
        ${framesHtml}
      </div>
    `;

    return {
      pageIndex,
      gematriaNumber,
      widthPt: pageWidth,
      heightPt: pageHeight,
      htmlContent
    };
  });
}
