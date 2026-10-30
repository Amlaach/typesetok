import {
  ChangelogEntry,
  ChangeCategory,
  UpdateImportance,
  HighlightCard,
  LocalizedString
} from './types';

/**
 * Extracts bilingual text from a format like:
 * "עברית: טקסט בעברית | en: English text"
 * or "he: טקסט בעברית | en: English text"
 */
export function parseBilingual(raw: string): LocalizedString {
  const trimmed = raw.trim();
  const sepMatch = trimmed.match(/^(?:עברית|he):\s*(.*?)\s*\|\s*(?:en|אנגלית):\s*(.*)$/i);
  if (sepMatch) {
    return {
      he: sepMatch[1].trim(),
      en: sepMatch[2].trim()
    };
  }
  // Fallback if not separated
  return { he: trimmed, en: trimmed };
}

/**
 * Parses CHANGELOG.md content into typed ChangelogEntry objects.
 */
export function parseChangelogMarkdown(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentEntry: Partial<ChangelogEntry> | null = null;
  let currentSection: 'meta' | 'highlights' | 'changes' = 'meta';
  let currentHighlight: Partial<HighlightCard> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Version heading: ## [0.30.4] - 2026-10-30
    const versionMatch = trimmed.match(/^##\s*\[([0-9a-zA-Z.-]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (versionMatch) {
      if (currentEntry && currentEntry.version) {
        if (currentHighlight && currentHighlight.id) {
          currentEntry.highlights = currentEntry.highlights || [];
          currentEntry.highlights.push(currentHighlight as HighlightCard);
          currentHighlight = null;
        }
        entries.push(currentEntry as ChangelogEntry);
      }

      currentEntry = {
        version: versionMatch[1],
        releaseDate: versionMatch[2] || new Date().toISOString().slice(0, 10),
        importance: 'minor',
        title: { he: '', en: '' },
        summary: { he: '', en: '' },
        changes: [],
        highlights: []
      };
      currentSection = 'meta';
      currentHighlight = null;
      continue;
    }

    if (!currentEntry) continue;

    // Sub-headings: ### Highlights / ### Changes
    if (trimmed.startsWith('### Highlights')) {
      currentSection = 'highlights';
      continue;
    } else if (trimmed.startsWith('### Changes')) {
      if (currentHighlight && currentHighlight.id) {
        currentEntry.highlights = currentEntry.highlights || [];
        currentEntry.highlights.push(currentHighlight as HighlightCard);
        currentHighlight = null;
      }
      currentSection = 'changes';
      continue;
    }

    // Meta properties
    if (currentSection === 'meta') {
      const impMatch = trimmed.match(/^-\s*\*\*Importance\*\*:\s*([a-zA-Z]+)/i);
      if (impMatch) {
        currentEntry.importance = impMatch[1].toLowerCase() as UpdateImportance;
        continue;
      }

      const badgeMatch = trimmed.match(/^-\s*\*\*Badge\*\*:\s*(.*)/i);
      if (badgeMatch) {
        currentEntry.badge = parseBilingual(badgeMatch[1]);
        continue;
      }

      const titleMatch = trimmed.match(/^-\s*\*\*Title\*\*:\s*(.*)/i);
      if (titleMatch) {
        currentEntry.title = parseBilingual(titleMatch[1]);
        continue;
      }

      const summaryMatch = trimmed.match(/^-\s*\*\*Summary\*\*:\s*(.*)/i);
      if (summaryMatch) {
        currentEntry.summary = parseBilingual(summaryMatch[1]);
        continue;
      }
    }

    // Highlights section
    if (currentSection === 'highlights') {
      // Highlight head: - [rust-engine] icon: sparkle | badge: עברית: מהיר פי 10, en: 10x Faster
      const hlHeadMatch = trimmed.match(/^-\s*\[([a-zA-Z0-9_-]+)\](?:\s*icon:\s*([a-zA-Z0-9_-]+))?(?:\s*\|\s*badge:\s*(.*))?/i);
      if (hlHeadMatch) {
        if (currentHighlight && currentHighlight.id) {
          currentEntry.highlights = currentEntry.highlights || [];
          currentEntry.highlights.push(currentHighlight as HighlightCard);
        }
        currentHighlight = {
          id: hlHeadMatch[1],
          icon: hlHeadMatch[2] || 'sparkle',
          title: { he: '', en: '' },
          description: { he: '', en: '' }
        };
        if (hlHeadMatch[3]) {
          currentHighlight.badge = parseBilingual(hlHeadMatch[3].replace(/,\s*en:/i, ' | en:'));
        }
        continue;
      }

      if (currentHighlight) {
        const hlTitleMatch = trimmed.match(/^-\s*Title:\s*(.*)/i);
        if (hlTitleMatch) {
          currentHighlight.title = parseBilingual(hlTitleMatch[1]);
          continue;
        }
        const hlDescMatch = trimmed.match(/^-\s*Description:\s*(.*)/i);
        if (hlDescMatch) {
          currentHighlight.description = parseBilingual(hlDescMatch[1]);
          continue;
        }
      }
    }

    // Changes section: - [category] עברית: טקסט | en: Text
    if (currentSection === 'changes') {
      const changeMatch = trimmed.match(/^-\s*\[([a-zA-Z0-9_-]+)\]\s*(.*)/);
      if (changeMatch) {
        const cat = changeMatch[1].toLowerCase() as ChangeCategory;
        const localized = parseBilingual(changeMatch[2]);
        currentEntry.changes = currentEntry.changes || [];
        currentEntry.changes.push({
          category: cat,
          text: localized
        });
        continue;
      }
    }
  }

  // Push last entry
  if (currentEntry && currentEntry.version) {
    if (currentHighlight && currentHighlight.id) {
      currentEntry.highlights = currentEntry.highlights || [];
      currentEntry.highlights.push(currentHighlight as HighlightCard);
    }
    entries.push(currentEntry as ChangelogEntry);
  }

  return entries;
}
