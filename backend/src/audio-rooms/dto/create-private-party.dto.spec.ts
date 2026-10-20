import { validate } from 'class-validator';
import { CreatePrivatePartyDto } from './create-private-party.dto';

describe('CreatePrivatePartyDto', () => {
  const basePayload = {
    title: 'Private Japanese Study Room',
    target_language: 'ja',
    language_pair: 'en-ja',
    topic_tag: 'Free Talk',
    is_video_stream: false,
  };

  function buildDto(invitedUserIds: string[]): CreatePrivatePartyDto {
    return Object.assign(new CreatePrivatePartyDto(), basePayload, {
      invited_user_ids: invitedUserIds,
    });
  }

  async function inviteErrors(invitedUserIds: string[]) {
    const errors = await validate(buildDto(invitedUserIds));
    return errors.find((error) => error.property === 'invited_user_ids');
  }

  it('accepts a bounded unique list of UUID v4 invitees', async () => {
    await expect(
      inviteErrors([
        'd290f1ee-6c54-4b01-90e6-d701748f0851',
        '7c84d9da-8d80-4e57-ae82-fd893aa88dc3',
      ]),
    ).resolves.toBeUndefined();
  });

  it('rejects an empty invite list', async () => {
    await expect(inviteErrors([])).resolves.toBeDefined();
  });

  it('rejects malformed user identifiers', async () => {
    await expect(inviteErrors(['not-a-user-id'])).resolves.toBeDefined();
  });

  it('rejects duplicate invitees', async () => {
    const userId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
    await expect(inviteErrors([userId, userId])).resolves.toBeDefined();
  });

  it('rejects more than 50 invitees', async () => {
    const invitedUserIds = Array.from(
      { length: 51 },
      (_, index) =>
        `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    );

    await expect(inviteErrors(invitedUserIds)).resolves.toBeDefined();
  });
});
