import { ChangelogEntry } from './types';
import { i18n, Language } from '../i18n';
import { el } from '../ui';
import { createVersionBadge, createCategoryPill } from './updatePills';

export class ChangelogEntryCard {
  public element: HTMLElement;
  private entry: ChangelogEntry;

  constructor(entry: ChangelogEntry) {
    this.entry = entry;
    this.element = el('article', `tok-changelog-card tok-changelog-${this.entry.importance}`);
    this.render();
  }

  public render(): void {
    const lang: Language = i18n.getLanguage();
    this.element.innerHTML = '';
    this.element.setAttribute('data-version', this.entry.version);

    // Header row: version, badge, date
    const header = el('header', 'tok-changelog-card-header');
    const titleGroup = el('div', 'tok-changelog-version-group');

    const versionTitle = el('h3', 'tok-changelog-version-tag', undefined, `v${this.entry.version}`);
    titleGroup.appendChild(versionTitle);

    const badge = createVersionBadge(this.entry.importance, this.entry.badge);
    titleGroup.appendChild(badge);

    header.appendChild(titleGroup);

    const dateSpan = el('time', 'tok-changelog-date', {
      datetime: this.entry.releaseDate,
      dir: 'ltr'
    }, this.entry.releaseDate);
    header.appendChild(dateSpan);

    this.element.appendChild(header);

    // Entry Title & Summary
    const titleText = this.entry.title[lang] || this.entry.title.en;
    const summaryText = this.entry.summary[lang] || this.entry.summary.en;

    const entryTitle = el('h4', 'tok-changelog-entry-title', undefined, titleText);
    this.element.appendChild(entryTitle);

    const summaryPara = el('p', 'tok-changelog-entry-summary', undefined, summaryText);
    this.element.appendChild(summaryPara);

    // Changes List
    if (this.entry.changes && this.entry.changes.length > 0) {
      const changesList = el('ul', 'tok-changelog-changes-list');

      for (const item of this.entry.changes) {
        const li = el('li', 'tok-changelog-change-item');
        const pill = createCategoryPill(item.category, item.tag);
        li.appendChild(pill);

        const textSpan = el('span', 'tok-changelog-change-text', undefined, item.text[lang] || item.text.en);
        li.appendChild(textSpan);

        changesList.appendChild(li);
      }

      this.element.appendChild(changesList);
    }
  }

  public updateLanguage(): void {
    this.render();
  }
}
