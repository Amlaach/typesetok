/**
 * Multi-Select Frame Alignment & Distribution Engine
 *
 * Pure geometric alignment and even spacing distribution for interactive
 * layout frames on the SpreadCanvas.
 */

export interface FrameRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  width?: number;
  height?: number;
}

export type FrameAlignType =
  | 'align-right'
  | 'right'
  | 'align-center'
  | 'align-center-h'
  | 'center'
  | 'align-left'
  | 'left'
  | 'align-top'
  | 'top'
  | 'align-middle'
  | 'align-middle-v'
  | 'middle'
  | 'align-bottom'
  | 'bottom'
  | 'distribute-v'
  | 'distribute-vertical'
  | 'distribute-h'
  | 'distribute-horizontal';

export interface SelectionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export function computeSelectionBounds(frames: readonly FrameRect[]): SelectionBounds {
  if (frames.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const f of frames) {
    if (f.x < minX) minX = f.x;
    if (f.x + f.w > maxX) maxX = f.x + f.w;
    if (f.y < minY) minY = f.y;
    if (f.y + f.h > maxY) maxY = f.y + f.h;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function alignRight(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { maxX } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, x: maxX - f.w }));
}

export function alignCenter(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { centerX } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, x: centerX - f.w / 2 }));
}

export function alignLeft(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { minX } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, x: minX }));
}

export function alignTop(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { minY } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, y: minY }));
}

export function alignMiddle(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { centerY } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, y: centerY - f.h / 2 }));
}

export function alignBottom(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 1) return frames.map((f) => ({ ...f }));
  const { maxY } = computeSelectionBounds(frames);
  return frames.map((f) => ({ ...f, y: maxY - f.h }));
}

export function distributeVertical(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 2) return frames.map((f) => ({ ...f }));
  const indexed = frames.map((f, idx) => ({ frame: { ...f }, idx }));
  indexed.sort((a, b) => a.frame.y - b.frame.y || a.idx - b.idx);

  const first = indexed[0].frame;
  const last = indexed[indexed.length - 1].frame;
  const totalSpan = (last.y + last.h) - first.y;
  const totalHeight = indexed.reduce((sum, item) => sum + item.frame.h, 0);
  const gap = (totalSpan - totalHeight) / (indexed.length - 1);

  let currentY = first.y;
  for (let i = 0; i < indexed.length; i++) {
    if (i === 0) {
      indexed[i].frame.y = first.y;
    } else if (i === indexed.length - 1) {
      indexed[i].frame.y = last.y;
    } else {
      indexed[i].frame.y = currentY;
    }
    currentY += indexed[i].frame.h + gap;
  }

  const result = new Array<FrameRect>(frames.length);
  for (const item of indexed) {
    result[item.idx] = item.frame;
  }
  return result;
}

export function distributeHorizontal(frames: readonly FrameRect[]): FrameRect[] {
  if (frames.length <= 2) return frames.map((f) => ({ ...f }));
  const indexed = frames.map((f, idx) => ({ frame: { ...f }, idx }));
  indexed.sort((a, b) => a.frame.x - b.frame.x || a.idx - b.idx);

  const first = indexed[0].frame;
  const last = indexed[indexed.length - 1].frame;
  const totalSpan = (last.x + last.w) - first.x;
  const totalWidth = indexed.reduce((sum, item) => sum + item.frame.w, 0);
  const gap = (totalSpan - totalWidth) / (indexed.length - 1);

  let currentX = first.x;
  for (let i = 0; i < indexed.length; i++) {
    if (i === 0) {
      indexed[i].frame.x = first.x;
    } else if (i === indexed.length - 1) {
      indexed[i].frame.x = last.x;
    } else {
      indexed[i].frame.x = currentX;
    }
    currentX += indexed[i].frame.w + gap;
  }

  const result = new Array<FrameRect>(frames.length);
  for (const item of indexed) {
    result[item.idx] = item.frame;
  }
  return result;
}

/**
 * Aligns or distributes an array of frame rectangles according to `alignType`.
 * Returns a new array of `FrameRect` in the same order as `frames`.
 */
export function alignFrames(frames: readonly FrameRect[], alignType: FrameAlignType | string): FrameRect[] {
  switch (alignType) {
    case 'align-right':
    case 'right':
      return alignRight(frames);
    case 'align-center':
    case 'align-center-h':
    case 'center':
      return alignCenter(frames);
    case 'align-left':
    case 'left':
      return alignLeft(frames);
    case 'align-top':
    case 'top':
      return alignTop(frames);
    case 'align-middle':
    case 'align-middle-v':
    case 'middle':
      return alignMiddle(frames);
    case 'align-bottom':
    case 'bottom':
      return alignBottom(frames);
    case 'distribute-v':
    case 'distribute-vertical':
      return distributeVertical(frames);
    case 'distribute-h':
    case 'distribute-horizontal':
      return distributeHorizontal(frames);
    default:
      return frames.map((f) => ({ ...f }));
  }
}
