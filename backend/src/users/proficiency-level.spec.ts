import {
  isProficiencyLevel,
  PROFICIENCY_LEVELS,
  type ProficiencyLevel,
} from './proficiency-level';

describe('proficiency level contract', () => {
  it('exposes exactly the six canonical CEFR levels', () => {
    expect(PROFICIENCY_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it.each(PROFICIENCY_LEVELS)('accepts %s', (level: ProficiencyLevel) => {
    expect(isProficiencyLevel(level)).toBe(true);
  });

  it.each(['a1', 'c2', 'B3', '', null, undefined, 1, {}, []])(
    'rejects non-canonical value %p',
    (value) => {
      expect(isProficiencyLevel(value)).toBe(false);
    },
  );
});
