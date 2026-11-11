import { describe, expect, it } from 'vitest';
import type { I18nService } from '../services/i18n.service';
import { achievementDescription, achievementName } from './achievement-copy';

function dictionary(entries: Record<string, string>): I18nService {
  // Mirrors I18nService.translate(): a missing key is echoed back.
  const translate = (key: string): string => entries[key] ?? key;
  return { translate } as unknown as I18nService;
}

const badge = {
  code: 'first_moment',
  name: 'Server name',
  description: 'Server description',
};

describe('achievement copy', () => {
  it('prefers the dictionary entry keyed by the catalogue code', () => {
    const i18n = dictionary({
      'achievements.badge.first_moment.name': 'Premier moment',
      'achievements.badge.first_moment.description': 'Partagez votre premier moment.',
    });

    expect(achievementName(i18n, badge)).toBe('Premier moment');
    expect(achievementDescription(i18n, badge)).toBe('Partagez votre premier moment.');
  });

  it('keeps the server text for a code the dictionary does not know', () => {
    const i18n = dictionary({});

    expect(achievementName(i18n, badge)).toBe('Server name');
    expect(achievementDescription(i18n, badge)).toBe('Server description');
  });

  it('translates name and description independently', () => {
    const i18n = dictionary({ 'achievements.badge.first_moment.name': 'Premier moment' });

    expect(achievementName(i18n, badge)).toBe('Premier moment');
    expect(achievementDescription(i18n, badge)).toBe('Server description');
  });
});
