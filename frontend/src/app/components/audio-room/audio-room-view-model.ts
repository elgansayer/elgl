import {
  AudioRoomRecord,
  StageInfo,
  StageParticipant,
} from '../../services/audio-rooms.store';

export const MAX_RENDERED_STAGE_PARTICIPANTS = 24;
export const MAX_VISIBLE_AUDIENCE_SEATS = 8;
export const MAX_AUDIENCE_COUNT = 10_000;

export interface StageViewModel {
  participants: StageParticipant[];
  overflowCount: number;
}

/**
 * Build the visual stage from the room snapshot plus the richer stage endpoint.
 *
 * The backend normally includes the host in `speakers`, but older/mixed-version
 * room rows may not. The UI must still render a host card exactly once. Speaker
 * identity remains keyed by the authenticated backend-provided user ID; this
 * helper never invents identities from display names.
 */
export function buildStageViewModel(
  room: AudioRoomRecord | null,
  stageInfo: StageInfo | null,
  liveParticipants: readonly StageParticipant[],
): StageViewModel {
  if (!room) return { participants: [], overflowCount: 0 };

  const hostId = stageInfo?.host?.id ?? room.host_id;
  const coHostId = stageInfo?.co_host_id ?? room.co_host_id ?? null;
  const byId = new Map<string, StageParticipant>();

  for (const participant of liveParticipants) {
    if (!participant?.user_id || byId.has(participant.user_id)) continue;
    byId.set(participant.user_id, {
      ...participant,
      isHost: participant.user_id === hostId,
      isCoHost: participant.user_id === coHostId,
    });
  }

  if (hostId && !byId.has(hostId)) {
    const host = stageInfo?.host ?? room.host ?? null;
    byId.set(hostId, {
      user_id: hostId,
      display_name: host?.display_name?.trim() || 'Room Host',
      avatar_url: host?.avatar_url ?? null,
      isSpeaking: false,
      isMuted: false,
      isHost: true,
      isCoHost: hostId === coHostId,
    });
  }

  const orderedIds: string[] = [];
  const addOrderedId = (id: string | null | undefined): void => {
    if (id && byId.has(id) && !orderedIds.includes(id)) orderedIds.push(id);
  };

  addOrderedId(hostId);
  addOrderedId(coHostId);
  for (const speaker of stageInfo?.speakers ?? []) addOrderedId(speaker.user_id);
  for (const participant of liveParticipants) addOrderedId(participant.user_id);

  const allParticipants = orderedIds
    .map((id) => byId.get(id))
    .filter((participant): participant is StageParticipant => Boolean(participant));

  return {
    participants: allParticipants.slice(0, MAX_RENDERED_STAGE_PARTICIPANTS),
    overflowCount: Math.max(0, allParticipants.length - MAX_RENDERED_STAGE_PARTICIPANTS),
  };
}

/** Normalize API counters before they are used to allocate DOM nodes. */
export function normaliseAudienceCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_AUDIENCE_COUNT, Math.floor(value));
}

/**
 * Listener identities are intentionally not inferred from room metadata. Until
 * the stage API exposes audience profiles, render a small privacy-preserving
 * set of anonymous seats and summarize the remainder numerically.
 */
export function buildAudienceSeatIndexes(count: number): number[] {
  const safeCount = normaliseAudienceCount(count);
  return Array.from(
    { length: Math.min(safeCount, MAX_VISIBLE_AUDIENCE_SEATS) },
    (_, index) => index + 1,
  );
}
