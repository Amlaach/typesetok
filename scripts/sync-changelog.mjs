// Reads CHANGELOG.md from project root and regenerates packages/tok-ui/src/updates/changelogData.ts
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const targetPath = path.join(rootDir, 'packages', 'tok-ui', 'src', 'updates', 'changelogData.ts');

function parseBilingual(raw) {
  const trimmed = (raw || '').trim();
  const sepMatch = trimmed.match(/^(?:עברית|he):\s*(.*?)\s*\|\s*(?:en|אנגלית):\s*(.*)$/i);
  if (sepMatch) {
    return {
      he: sepMatch[1].trim(),
      en: sepMatch[2].trim()
    };
  }
  return { he: trimmed, en: trimmed };
}

export function parseChangelogMarkdown(markdown) {
  const entries = [];
  const lines = markdown.split(/\r?\n/);

  let currentEntry = null;
  let currentSection = 'meta';
  let currentHighlight = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Version heading: ## [0.30.4] - 2026-10-30
    const versionMatch = trimmed.match(/^##\s*\[([0-9a-zA-Z.-]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (versionMatch) {
      if (currentEntry && currentEntry.version) {
        if (currentHighlight && currentHighlight.id) {
          currentEntry.highlights = currentEntry.highlights || [];
          currentEntry.highlights.push(currentHighlight);
          currentHighlight = null;
        }
        entries.push(currentEntry);
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
        currentEntry.highlights.push(currentHighlight);
        currentHighlight = null;
      }
      currentSection = 'changes';
      continue;
    }

    // Meta properties
    if (currentSection === 'meta') {
      const impMatch = trimmed.match(/^-\s*\*\*Importance\*\*:\s*([a-zA-Z]+)/i);
      if (impMatch) {
        currentEntry.importance = impMatch[1].toLowerCase();
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
      const hlHeadMatch = trimmed.match(/^-\s*\[([a-zA-Z0-9_-]+)\](?:\s*icon:\s*([a-zA-Z0-9_-]+))?(?:\s*\|\s*badge:\s*(.*))?/i);
      if (hlHeadMatch) {
        if (currentHighlight && currentHighlight.id) {
          currentEntry.highlights = currentEntry.highlights || [];
          currentEntry.highlights.push(currentHighlight);
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
        const cat = changeMatch[1].toLowerCase();
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
      currentEntry.highlights.push(currentHighlight);
    }
    entries.push(currentEntry);
  }

  return entries;
}

export function syncChangelog() {
  if (!fs.existsSync(changelogPath)) {
    console.error(`[CHANGELOG-SYNC] Error: ${changelogPath} not found!`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(changelogPath, 'utf8');
  const entries = parseChangelogMarkdown(markdown);

  if (!entries || entries.length === 0) {
    console.error('[CHANGELOG-SYNC] Error: No changelog entries parsed from CHANGELOG.md');
    process.exit(1);
  }

  const fileContent = `/**
 * AUTO-GENERATED from CHANGELOG.md by scripts/sync-changelog.mjs
 * DO NOT EDIT DIRECTLY. Update CHANGELOG.md in the project root instead.
 */
import { ChangelogEntry } from './types';

export const CHANGELOG_ENTRIES: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  fs.writeFileSync(targetPath, fileContent, 'utf8');
  console.log(`[CHANGELOG-SYNC] Successfully synced ${entries.length} release entries from CHANGELOG.md to changelogData.ts`);
}

// Run directly if invoked as main script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  syncChangelog();
}
