/**
 * Types and interfaces for the TypesetOK What's New and Changelog notification system.
 */

export type UpdateImportance = 'major' | 'minor' | 'patch';

export type ChangeCategory =
  | 'features'
  | 'improvements'
  | 'fixes'
  | 'typography'
  | 'performance';

export interface LocalizedString {
  he: string;
  en: string;
}

export interface LocalizedStringList {
  he: string[];
  en: string[];
}

export interface HighlightCard {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  icon: string;
  badge?: LocalizedString;
}

export interface ChangeItem {
  category: ChangeCategory;
  text: LocalizedString;
  tag?: LocalizedString;
}

export interface ChangelogEntry {
  version: string;
  releaseDate: string; // ISO date string: YYYY-MM-DD
  importance: UpdateImportance;
  title: LocalizedString;
  summary: LocalizedString;
  badge?: LocalizedString;
  highlights?: HighlightCard[];
  changes: ChangeItem[];
  readMoreUrl?: string;
}

export interface UserUpdatesState {
  lastSeenVersion: string;
  lastSeenMajorVersion: string;
  dismissedVersions: string[];
  lastCheckedTime?: number;
}

export interface UpdatesFilterOptions {
  category?: ChangeCategory | 'all';
  importance?: UpdateImportance | 'all';
  searchQuery?: string;
}
