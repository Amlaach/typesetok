import { UpdateImportance, ChangeCategory, LocalizedString } from './types';
import { t, i18n, Language } from '../i18n';
import { el, icon } from '../ui';
import { IconName } from '../icons';

export function getCategoryIcon(category: ChangeCategory): IconName {
  switch (category) {
    case 'features':
      return 'sparkle';
    case 'typography':
      return 'typography';
    case 'improvements':
      return 'zap';
    case 'fixes':
      return 'check';
    case 'performance':
      return 'zap';
    default:
      return 'sparkle';
  }
}

export function getCategoryLabel(category: ChangeCategory): string {
  switch (category) {
    case 'features':
      return t('whatsNewCatFeatures');
    case 'typography':
      return t('whatsNewCatTypography');
    case 'improvements':
      return t('whatsNewCatImprovements');
    case 'fixes':
      return t('whatsNewCatFixes');
    case 'performance':
      return t('whatsNewCatPerformance');
    default:
      return category;
  }
}

export function createCategoryPill(category: ChangeCategory, customTag?: LocalizedString): HTMLElement {
  const lang: Language = i18n.getLanguage();
  const label = customTag ? (customTag[lang] || customTag.en) : getCategoryLabel(category);
  const pill = el('span', `tok-update-pill tok-update-pill-${category}`);
  pill.appendChild(icon(getCategoryIcon(category), 12));
  pill.appendChild(el('span', undefined, undefined, label));
  return pill;
}

export function createVersionBadge(importance: UpdateImportance, customLabel?: LocalizedString): HTMLElement {
  const lang: Language = i18n.getLanguage();
  let defaultLabel = '';
  let badgeClass = '';

  switch (importance) {
    case 'major':
      defaultLabel = t('whatsNewBadgeMajor');
      badgeClass = 'tok-badge tok-badge-major';
      break;
    case 'minor':
      defaultLabel = t('whatsNewBadgeMinor');
      badgeClass = 'tok-badge tok-badge-info';
      break;
    case 'patch':
      defaultLabel = t('whatsNewBadgePatch');
      badgeClass = 'tok-badge tok-badge-neutral';
      break;
  }

  const text = customLabel ? (customLabel[lang] || customLabel.en) : defaultLabel;
  return el('span', badgeClass, undefined, text);
}
