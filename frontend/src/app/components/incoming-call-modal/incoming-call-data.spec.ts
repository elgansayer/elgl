import { describe, expect, it } from 'vitest';
import { normaliseIncomingCallData } from './incoming-call-data';

describe('normaliseIncomingCallData', () => {
  it('normalises a valid incoming call invitation', () => {
    expect(
      normaliseIncomingCallData({
        callerId: ' caller-1 ',
        callerName: ' Alice ',
        callerAvatarUrl: 'https://cdn.example/avatar.jpg',
        roomName: ' room-1 ',
        isVideoCall: true,
      }),
    ).toEqual({
      callerId: 'caller-1',
      callerName: 'Alice',
      callerAvatarUrl: 'https://cdn.example/avatar.jpg',
      roomName: 'room-1',
      isVideoCall: true,
    });
  });

  it.each([
    null,
    {},
    { callerId: '', callerName: 'Alice', roomName: 'room-1', isVideoCall: false },
    { callerId: 'caller-1', callerName: '', roomName: 'room-1', isVideoCall: false },
    { callerId: 'caller-1', callerName: 'Alice', roomName: '', isVideoCall: false },
    { callerId: 'caller-1', callerName: 'Alice', roomName: 'room-1', isVideoCall: 'no' },
  ])('rejects malformed required fields', (value) => {
    expect(normaliseIncomingCallData(value)).toBeNull();
  });

  it('rejects overlong identifiers and names', () => {
    expect(
      normaliseIncomingCallData({
        callerId: 'a'.repeat(129),
        callerName: 'Alice',
        roomName: 'room-1',
        isVideoCall: false,
      }),
    ).toBeNull();

    expect(
      normaliseIncomingCallData({
        callerId: 'caller-1',
        callerName: 'a'.repeat(121),
        roomName: 'room-1',
        isVideoCall: false,
      }),
    ).toBeNull();

    expect(
      normaliseIncomingCallData({
        callerId: 'caller-1',
        callerName: 'Alice',
        roomName: 'r'.repeat(256),
        isVideoCall: false,
      }),
    ).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:password@example.com/avatar.jpg',
    '/relative/avatar.jpg',
  ])('drops unsafe avatar URLs without rejecting the call', (callerAvatarUrl) => {
    expect(
      normaliseIncomingCallData({
        callerId: 'caller-1',
        callerName: 'Alice',
        callerAvatarUrl,
        roomName: 'room-1',
        isVideoCall: false,
      }),
    ).toEqual({
      callerId: 'caller-1',
      callerName: 'Alice',
      roomName: 'room-1',
      isVideoCall: false,
    });
  });
});
