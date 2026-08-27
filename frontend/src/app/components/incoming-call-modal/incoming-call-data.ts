export interface IncomingCallData {
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  roomName: string;
  isVideoCall: boolean;
}

const MAX_CALLER_ID_LENGTH = 128;
const MAX_CALLER_NAME_LENGTH = 120;
const MAX_ROOM_NAME_LENGTH = 255;
const MAX_AVATAR_URL_LENGTH = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function safeHttpUrl(value: unknown): string | undefined {
  const candidate = boundedText(value, MAX_AVATAR_URL_LENGTH);
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Treat realtime call invitations as untrusted network data before rendering or
 * routing with them. Invalid required fields reject the invitation; an invalid
 * optional avatar is simply omitted so a bad image URL cannot block a call.
 */
export function normaliseIncomingCallData(value: unknown): IncomingCallData | null {
  if (!isRecord(value)) return null;

  const callerId = boundedText(value['callerId'], MAX_CALLER_ID_LENGTH);
  const callerName = boundedText(value['callerName'], MAX_CALLER_NAME_LENGTH);
  const roomName = boundedText(value['roomName'], MAX_ROOM_NAME_LENGTH);
  const isVideoCall = value['isVideoCall'];

  if (!callerId || !callerName || !roomName || typeof isVideoCall !== 'boolean') {
    return null;
  }

  const callerAvatarUrl = safeHttpUrl(value['callerAvatarUrl']);

  return {
    callerId,
    callerName,
    ...(callerAvatarUrl ? { callerAvatarUrl } : {}),
    roomName,
    isVideoCall,
  };
}
