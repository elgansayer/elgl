import {
  parseJoinableLanguagePartyRoom,
  parseLanguagePartyList,
} from './language-party-contract';

const room = {
  id: 'party-1',
  room_name: 'language-party-free-talk-1',
  title: 'Free Talk',
  target_language: 'es',
  language_pair: 'en-es',
  topic_tag: 'Free Talk',
  host_id: 'host-1',
  is_active: true,
  speakers: ['host-1'],
  raised_hands: [],
  listeners_count: 4,
  created_at: '2026-08-27T10:00:00.000Z',
  party_type: 'language_party',
  host: {
    id: 'host-1',
    display_name: 'Host',
    avatar_url: 'https://cdn.example.test/avatar.jpg',
  },
};

describe('language party response contract', () => {
  it('normalizes a bounded public party list', () => {
    expect(parseLanguagePartyList([room])).toEqual([
      expect.objectContaining({
        id: 'party-1',
        title: 'Free Talk',
        language_pair: 'en-es',
        listeners_count: 4,
        host: expect.objectContaining({ avatar_url: 'https://cdn.example.test/avatar.jpg' }),
      }),
    ]);
  });

  it('drops malformed and duplicate list records without rendering them', () => {
    const malformed = { ...room, id: '' };
    expect(parseLanguagePartyList([room, malformed, room])).toHaveLength(1);
  });

  it('rejects unbounded list responses', () => {
    expect(() => parseLanguagePartyList(Array.from({ length: 51 }, () => room))).toThrow(
      'Invalid language party response',
    );
  });

  it('strips unsafe or credential-bearing avatar URLs', () => {
    const [unsafe] = parseLanguagePartyList([
      { ...room, host: { ...room.host, avatar_url: 'javascript:alert(1)' } },
    ]);
    const [credentialed] = parseLanguagePartyList([
      { ...room, host: { ...room.host, avatar_url: 'https://user:pass@example.test/a.jpg' } },
    ]);

    expect(unsafe?.host?.avatar_url).toBeNull();
    expect(credentialed?.host?.avatar_url).toBeNull();
  });

  it('accepts an active language-party room returned by the authoritative lookup', () => {
    expect(parseJoinableLanguagePartyRoom(room, 'party-1')).toEqual(
      expect.objectContaining({ id: 'party-1', party_type: 'language_party', is_active: true }),
    );
  });

  it('rejects stale, mismatched, or non-language-party join responses', () => {
    expect(() => parseJoinableLanguagePartyRoom({ ...room, is_active: false }, 'party-1')).toThrow();
    expect(() => parseJoinableLanguagePartyRoom(room, 'another-party')).toThrow();
    expect(() =>
      parseJoinableLanguagePartyRoom({ ...room, party_type: 'private_party' }, 'party-1'),
    ).toThrow('Unexpected audio room type');
  });

  it('rejects malformed participant collections and counters', () => {
    expect(() =>
      parseJoinableLanguagePartyRoom({ ...room, speakers: 'host-1' }, 'party-1'),
    ).toThrow();
    expect(() =>
      parseJoinableLanguagePartyRoom({ ...room, listeners_count: Number.POSITIVE_INFINITY }, 'party-1'),
    ).toThrow();
  });
});
