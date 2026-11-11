import {
  compareSemanticVersions,
  parseSemanticVersion,
} from './semantic-version';

describe('parseSemanticVersion', () => {
  it('parses a stable version', () => {
    expect(parseSemanticVersion('2.10.3')).toEqual({
      major: 2,
      minor: 10,
      patch: 3,
      prerelease: [],
    });
  });

  it('accepts a leading v, prerelease identifiers and build metadata', () => {
    expect(parseSemanticVersion(' v1.2.3-rc.1+build.5 ')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['rc', '1'],
    });
  });

  it.each([
    '',
    '   ',
    '1',
    '1.2',
    '1.2.3.4',
    '01.2.3',
    '1.02.3',
    '1.2.3-',
    '1.2.3-01',
    '1.2.3-rc..1',
    '1.2.3+',
    'latest',
    '1.2.x',
    '9007199254740993.0.0',
    `1.2.3-${'a'.repeat(80)}`,
  ])('rejects %j', (value) => {
    expect(parseSemanticVersion(value)).toBeNull();
  });
});

describe('compareSemanticVersions', () => {
  it.each([
    ['1.0.0', '2.0.0', -1],
    ['2.0.0', '1.9.9', 1],
    ['1.2.0', '1.10.0', -1],
    ['1.2.3', '1.2.4', -1],
    ['1.2.3', '1.2.3', 0],
    ['v1.2.3', '1.2.3', 0],
    ['1.2.3+build.1', '1.2.3+build.2', 0],
  ])('compares %s with %s as %i', (left, right, expected) => {
    const result = compareSemanticVersions(left, right);
    expect(result === null ? null : Math.sign(result)).toBe(expected);
  });

  it('orders prereleases by semantic version precedence', () => {
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];

    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(
        Math.sign(compareSemanticVersions(ordered[index], ordered[index + 1])!),
      ).toBe(-1);
      expect(
        Math.sign(compareSemanticVersions(ordered[index + 1], ordered[index])!),
      ).toBe(1);
    }
  });

  it('treats a release as newer than its own prerelease', () => {
    expect(compareSemanticVersions('2.0.0-rc.1', '2.0.0')).toBeLessThan(0);
  });

  it('returns null instead of guessing when either side is malformed', () => {
    expect(compareSemanticVersions('nonsense', '1.0.0')).toBeNull();
    expect(compareSemanticVersions('1.0.0', '1.0')).toBeNull();
  });
});
