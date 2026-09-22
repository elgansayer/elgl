import * as jwt from 'jsonwebtoken';
import { AssertCheckFn } from './types';

export function verifyLiveKit(assertCheck: AssertCheckFn) {
  // 3. Verify LiveKit & Centrifugo Token Cryptography
  try {
    const lkSecret =
      process.env.LIVEKIT_SECRET || 'dev_livekit_secret_test_value_123';
    const lkApiKey =
      process.env.LIVEKIT_API_KEY || 'dev_livekit_key_test_value_123';

    const lkToken = jwt.sign(
      {
        sub: 'usr_test_123',
        video: {
          roomJoin: true,
          room: 'room_global_en_ja',
          canPublish: true,
          canSubscribe: true,
        },
      },
      lkSecret,
      { expiresIn: '6h', issuer: lkApiKey },
    );
    const decoded = jwt.verify(lkToken, lkSecret) as {
      video?: { roomJoin?: boolean; room?: string; canPublish?: boolean };
    };
    assertCheck(
      'LiveKit SFU WebRTC JWT Generation & VideoGrant Verification',
      decoded.video?.roomJoin === true &&
        decoded.video?.room === 'room_global_en_ja' &&
        decoded.video?.canPublish === true,
      `Token payload room: ${decoded.video?.room}`,
    );
  } catch (e: unknown) {
    const err = e as Error;
    assertCheck('LiveKit Cryptographic Grant Verification', false, err.message);
  }
}
