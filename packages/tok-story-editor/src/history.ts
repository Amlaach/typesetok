/**
 * TypesetOK (TOK) - Reliable Undo/Redo History Stack for Story Editor.
 *
 * Implements discrete compound transactions with typing debouncing/coalescing,
 * selection restoration, and strict undo/redo invariants without relying
 * on browser execCommand.
 */

import { StoryParagraph, StorySelection } from './types.js';


export interface HistoryRecord {
  description: string;
  timestamp: number;
  isTyping: boolean;
  paragraphsBefore: StoryParagraph[];
  paragraphsAfter: StoryParagraph[];
  selectionBefore?: StorySelection;
  selectionAfter?: StorySelection;
}

export class StoryHistory {
  private undoStack: HistoryRecord[] = [];
  private redoStack: HistoryRecord[] = [];
  private maxHistory: number;
  private lastTypingTime = 0;
  private typingCoalesceWindowMs = 600;

  constructor(maxHistory = 150) {
    this.maxHistory = maxHistory;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Pushes a new state transition. If isTyping is true and within the coalesce window,
   * updates the current top of the undo stack instead of creating a new entry.
   */
  public record(
    before: StoryParagraph[],
    after: StoryParagraph[],
    options?: {
      description?: string;
      isTyping?: boolean;
      selectionBefore?: StorySelection;
      selectionAfter?: StorySelection;
    }
  ): void {
    const now = Date.now();
    const isTyping = Boolean(options?.isTyping);
    const desc = options?.description || (isTyping ? 'הקלדה' : 'עריכה');

    // Deep clone paragraphs to prevent external mutation
    const cloneBefore = JSON.parse(JSON.stringify(before));
    const cloneAfter = JSON.parse(JSON.stringify(after));

    if (
      isTyping &&
      this.undoStack.length > 0 &&
      this.undoStack[this.undoStack.length - 1].isTyping &&
      now - this.lastTypingTime < this.typingCoalesceWindowMs
    ) {
      // Coalesce continuous typing: update the target state of the latest record
      const top = this.undoStack[this.undoStack.length - 1];
      top.paragraphsAfter = cloneAfter;
      top.selectionAfter = options?.selectionAfter;
      top.timestamp = now;
      this.lastTypingTime = now;
      this.redoStack = [];
      return;
    }

    const record: HistoryRecord = {
      description: desc,
      timestamp: now,
      isTyping,
      paragraphsBefore: cloneBefore,
      paragraphsAfter: cloneAfter,
      selectionBefore: options?.selectionBefore,
      selectionAfter: options?.selectionAfter
    };

    this.undoStack.push(record);
    if (this.maxHistory > 0 && this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastTypingTime = now;
  }

  /**
   * Pops the latest undo record and pushes it to redo.
   * Returns the paragraphs and selection to restore.
   */
  public undo(): { paragraphs: StoryParagraph[]; selection?: StorySelection } | null {
    const record = this.undoStack.pop();
    if (!record) return null;

    this.redoStack.push(record);
    return {
      paragraphs: JSON.parse(JSON.stringify(record.paragraphsBefore)),
      selection: record.selectionBefore
    };
  }

  /**
   * Pops the latest redo record and pushes it to undo.
   * Returns the paragraphs and selection to restore.
   */
  public redo(): { paragraphs: StoryParagraph[]; selection?: StorySelection } | null {
    const record = this.redoStack.pop();
    if (!record) return null;

    this.undoStack.push(record);
    return {
      paragraphs: JSON.parse(JSON.stringify(record.paragraphsAfter)),
      selection: record.selectionAfter
    };
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastTypingTime = 0;
  }
}
