import {
  MESSAGE_REACTION_EMOJIS,
  parseMessageReactionPublication,
} from './message-reactions.service';

describe('parseMessageReactionPublication', () => {
  it('accepts bounded supported reaction state', () => {
    expect(
      parseMessageReactionPublication({
        reaction: {
          message_id: 'message-1',
          reactions: [
            { user_id: 'user-1', emoji: '❤️' },
            { user_id: 'user-2', emoji: '👍' },
          ],
        },
      }),
    ).toEqual({
      message_id: 'message-1',
      reactions: [
        { user_id: 'user-1', emoji: '❤️' },
        { user_id: 'user-2', emoji: '👍' },
      ],
    });
  });

  it.each(['🔥', '', '<script>'])('rejects unsupported emoji %s', (emoji) => {
    expect(
      parseMessageReactionPublication({
        reaction: {
          message_id: 'message-1',
          reactions: [{ user_id: 'user-1', emoji }],
        },
      }),
    ).toBeNull();
  });

  it('rejects malformed realtime envelopes', () => {
    expect(parseMessageReactionPublication(null)).toBeNull();
    expect(parseMessageReactionPublication({ reaction: null })).toBeNull();
    expect(
      parseMessageReactionPublication({ reaction: { message_id: 'message-1', reactions: '❤️' } }),
    ).toBeNull();
  });

  it('rejects unbounded reaction publications', () => {
    expect(MESSAGE_REACTION_EMOJIS).toHaveLength(6);
    expect(
      parseMessageReactionPublication({
        reaction: {
          message_id: 'message-1',
          reactions: Array.from({ length: 601 }, (_, index) => ({
            user_id: `user-${index}`,
            emoji: '👍',
          })),
        },
      }),
    ).toBeNull();
  });
});
