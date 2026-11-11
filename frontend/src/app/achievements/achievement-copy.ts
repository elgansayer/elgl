import type { I18nService } from '../services/i18n.service';

export interface AchievementCopySource {
  code: string;
  name: string;
  description: string;
}

function translateOr(i18n: I18nService, key: string, fallback: string): string {
  const text = i18n.translate(key);
  // translate() echoes the key when no dictionary entry exists.
  return text === key ? fallback : text;
}

/**
 * Badge copy is keyed by the server catalogue code so it follows the interface
 * language. A badge the dictionary does not know yet keeps the server text.
 */
export function achievementName(i18n: I18nService, badge: AchievementCopySource): string {
  return translateOr(i18n, `achievements.badge.${badge.code}.name`, badge.name);
}

export function achievementDescription(i18n: I18nService, badge: AchievementCopySource): string {
  return translateOr(i18n, `achievements.badge.${badge.code}.description`, badge.description);
}
