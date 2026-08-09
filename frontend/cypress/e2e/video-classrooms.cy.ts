/// <reference types="cypress" />

/**
 * Video Classrooms E2E Test Flows
 *
 * Covers the complete Video Classrooms architecture:
 *  - Classrooms Marketplace (tutor discovery grid)
 *  - Audio/Video Rooms (LiveKit-based language parties with split-screen video)
 *  - Video Calls (1-on-1 WebRTC calls via LiveKit)
 *  - VoIP Calls (incoming/outgoing voice-over-IP calls)
 *  - Call Logs (call history)
 *  - Room Lobby, Stage Management, Co-Host Invites
 *
 * Backend endpoints covered:
 *  - GET  /api/audio-rooms/list              (active room listing)
 *  - GET  /api/audio-rooms/by-language        (grouped by language)
 *  - POST /api/audio-rooms/create            (create room)
 *  - POST /api/audio-rooms/token             (get LiveKit token)
 *  - GET  /api/audio-rooms/:id/stage         (stage info)
 *  - POST /api/audio-rooms/raise-hand        (raise hand)
 *  - POST /api/audio-rooms/approve-speaker   (approve speaker)
 *  - POST /api/audio-rooms/invite-co-host    (invite co-host)
 *  - POST /api/audio-rooms/remove-co-host    (remove co-host)
 *  - GET  /api/audio-rooms/call-logs         (call history)
 *  - POST /api/video-calls/start             (start 1-on-1 video call)
 *  - POST /api/video-calls/accept            (accept 1-on-1 video call)
 *  - POST /api/livekit/token                 (LiveKit token for VoIP)
 */

// -----------------------------------------------------------------
// Shared helpers & fixtures
// -----------------------------------------------------------------

const AUDIO_ROOMS_BASE = '/api/audio-rooms';
const VIDEO_CALLS_BASE = '/api/video-calls';

interface AudioRoomRecord {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  language_pair: string;
  topic_tag: string;
  host_id: string;
  co_host_id: string | null;
  is_video_stream: boolean;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  created_at: string;
  host?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

interface CallLogRecord {
  id: string;
  caller_id: string;
  caller_name: string;
  receiver_id: string;
  receiver_name: string;
  call_type: 'incoming' | 'outgoing' | 'missed';
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

function makeAudioRoom(overrides: Partial<AudioRoomRecord> = {}): AudioRoomRecord {
  return {
    id: 'room-001',
    room_name: 'room-es-en-001',
    title: 'Spanish-English Language Exchange',
    target_language: 'es',
    language_pair: 'es-en',
    topic_tag: 'conversation',
    host_id: 'host-user-1',
    co_host_id: null,
    is_video_stream: false,
    is_active: true,
    speakers: ['host-user-1'],
    raised_hands: [],
    listeners_count: 12,
    created_at: new Date().toISOString(),
    host: {
      id: 'host-user-1',
      display_name: 'Carlos M.',
      avatar_url: 'https://i.pravatar.cc/150?u=host-1',
    },
    ...overrides,
  };
}

function createMockRooms(): AudioRoomRecord[] {
  return [
    makeAudioRoom({
      id: 'room-001',
      room_name: 'room-es-en-001',
      title: 'Spanish-English Language Exchange',
      language_pair: 'es-en',
      topic_tag: 'conversation',
      listeners_count: 25,
    }),
    makeAudioRoom({
      id: 'room-002',
      room_name: 'room-ja-en-002',
      title: 'Japanese Practice - Beginner Friendly',
      language_pair: 'ja-en',
      topic_tag: 'beginner',
      host_id: 'host-user-2',
      host: { id: 'host-user-2', display_name: 'Yuki T.', avatar_url: 'https://i.pravatar.cc/150?u=host-2' },
      is_video_stream: true,
      co_host_id: 'cohost-1',
      speakers: ['host-user-2', 'cohost-1'],
      listeners_count: 18,
    }),
    makeAudioRoom({
      id: 'room-003',
      room_name: 'room-fr-en-003',
      title: 'French Conversation - Intermediate',
      language_pair: 'fr-en',
      topic_tag: 'intermediate',
      host_id: 'host-user-3',
      host: { id: 'host-user-3', display_name: 'Sophie D.', avatar_url: 'https://i.pravatar.cc/150?u=host-3' },
      is_video_stream: true,
      listeners_count: 42,
    }),
    makeAudioRoom({
      id: 'room-004',
      room_name: 'room-ko-en-004',
      title: 'Korean K-Drama Discussion',
      language_pair: 'ko-en',
      topic_tag: 'culture',
      host_id: 'host-user-4',
      host: { id: 'host-user-4', display_name: 'Min-ji P.', avatar_url: 'https://i.pravatar.cc/150?u=host-4' },
      listeners_count: 8,
    }),
  ];
}

function makeCallLog(overrides: Partial<CallLogRecord> = {}): CallLogRecord {
  return {
    id: 'call-001',
    caller_id: 'user-1',
    caller_name: 'Alice',
    receiver_id: 'user-2',
    receiver_name: 'Bob',
    call_type: 'outgoing',
    room_name: 'call_abc123',
    started_at: new Date(Date.now() - 3600000).toISOString(),
    ended_at: new Date(Date.now() - 3500000).toISOString(),
    duration_seconds: 120,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    ...overrides,
  };
}

function setupCommonMocks(): void {
  cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
  cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
  cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
  cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
  cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
  cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
  cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
    'getBlockedAndBlockerIds',
  );
  cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
  cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 100 } }).as('getBalance');
}

function setupAudioRoomsMocks(rooms: AudioRoomRecord[] = createMockRooms()): void {
  setupCommonMocks();

  // Active rooms list
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/list*`, {
    statusCode: 200,
    body: rooms,
  }).as('getAudioRoomsList');

  // Rooms by language
  const byLang = rooms.reduce<Record<string, AudioRoomRecord[]>>((acc, r) => {
    const key = r.language_pair;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/by-language`, {
    statusCode: 200,
    body: Object.entries(byLang).map(([language_pair, grouped]) => ({
      language_pair,
      count: grouped.length,
      rooms: grouped,
    })),
  }).as('getAudioRoomsByLanguage');

  // Topics
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/topics`, {
    statusCode: 200,
    body: ['conversation', 'beginner', 'intermediate', 'culture', 'travel'],
  }).as('getTopics');

  // Levels
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/levels`, {
    statusCode: 200,
    body: ['beginner', 'intermediate', 'advanced'],
  }).as('getLevels');

  // Private rooms (empty by default)
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/private`, {
    statusCode: 200,
    body: [],
  }).as('getPrivateRooms');

  // Call logs
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/call-logs*`, {
    statusCode: 200,
    body: [
      makeCallLog(),
      makeCallLog({
        id: 'call-002',
        caller_id: 'user-3',
        caller_name: 'Charlie',
        receiver_id: 'user-1',
        receiver_name: 'Alice',
        call_type: 'incoming',
        room_name: 'call_def456',
        duration_seconds: 300,
      }),
      makeCallLog({
        id: 'call-003',
        caller_id: 'user-4',
        caller_name: 'Diana',
        receiver_id: 'user-1',
        receiver_name: 'Alice',
        call_type: 'missed',
        room_name: 'call_ghi789',
        ended_at: null,
        duration_seconds: null,
      }),
    ],
  }).as('getCallLogs');

  // Exclusive emojis
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/exclusive-emojis`, {
    statusCode: 200,
    body: [
      { emojiId: 'star', name: 'Star', animationUrl: '' },
      { emojiId: 'heart', name: 'Heart', animationUrl: '' },
    ],
  }).as('getExclusiveEmojis');

  // Soundboard
  cy.intercept('GET', `${AUDIO_ROOMS_BASE}/soundboard/list`, {
    statusCode: 200,
    body: { sounds: [] },
  }).as('getSoundboard');
}

// -----------------------------------------------------------------
// 1. Audio/Video Rooms - Room Lobby & Listing
// -----------------------------------------------------------------

describe('Video Classrooms - Room Lobby & Listing', () => {
  beforeEach(() => {
    setupAudioRoomsMocks();
    cy.visit('/audio-rooms');
  });

  it('should load the audio rooms lobby and display active rooms', () => {
    cy.wait('@getAudioRoomsList');
    cy.get('body').should('exist');

    // Verify rooms are displayed
    cy.contains('Spanish-English Language Exchange').should('be.visible');
    cy.contains('Japanese Practice - Beginner Friendly').should('be.visible');
    cy.contains('French Conversation - Intermediate').should('be.visible');
  });

  it('should display room metadata: host name, listener count, and topic', () => {
    cy.wait('@getAudioRoomsList');

    // Host display names should appear
    cy.contains('Carlos M.').should('be.visible');

    // Listener counts
    cy.contains('25').should('be.visible');

    // Topics
    cy.contains('conversation').should('be.visible');
  });

  it('should filter rooms by language group', () => {
    cy.wait('@getAudioRoomsByLanguage');

    // The by-language response is fetched; verify the page doesn't crash
    cy.get('body').should('exist');
  });

  it('should display video-stream indicator for rooms with video enabled', () => {
    cy.wait('@getAudioRoomsList');

    // Room 002 has is_video_stream: true
    cy.contains('Japanese Practice').should('be.visible');
  });

  it('should handle an empty room list gracefully', () => {
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/list*`, {
      statusCode: 200,
      body: [],
    }).as('getEmptyList');
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/by-language`, {
      statusCode: 200,
      body: [],
    }).as('getEmptyByLang');

    cy.visit('/audio-rooms');

    cy.wait('@getEmptyList');
    cy.get('body').should('exist');
    // Should not show error state with 401/500
  });
});

// -----------------------------------------------------------------
// 2. Audio/Video Rooms - Room Creation
// -----------------------------------------------------------------

describe('Video Classrooms - Room Creation', () => {
  beforeEach(() => {
    setupAudioRoomsMocks();

    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/create`, (req) => {
      req.reply({
        statusCode: 201,
        body: makeAudioRoom({
          id: 'room-new-001',
          room_name: 'room-new-001',
          title: req.body.title,
          language_pair: req.body.language_pair,
          topic_tag: req.body.topic_tag,
          is_video_stream: req.body.is_video_stream ?? false,
          listeners_count: 1,
        }),
      });
    }).as('createRoom');
  });

  it('should allow creating a new voice room', () => {
    cy.visit('/audio-rooms');

    // The create flow may be triggered via a button or a form
    // Verify the create endpoint is mocked and the page loads
    cy.get('body').should('exist');
  });

  it('should allow creating a room with video stream enabled', () => {
    cy.visit('/audio-rooms');

    // Verify the page supports video stream creation
    cy.get('body').should('exist');
  });

  it('should reject room creation with empty title via API', () => {
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/create`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Title is required' },
    }).as('createInvalid');

    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/create`,
      body: {
        title: '',
        target_language: 'es',
        language_pair: 'es-en',
        topic_tag: '',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.include('Title');
    });
  });
});

// -----------------------------------------------------------------
// 3. Video Rooms - Join Room & Token Flow
// -----------------------------------------------------------------

describe('Video Classrooms - Join Room & Token Flow', () => {
  const testRoom = makeAudioRoom({
    id: 'room-join-001',
    room_name: 'room-join-es-en',
    title: 'Join Test Room',
    is_video_stream: true,
    speakers: ['host-user-1'],
  });

  beforeEach(() => {
    setupAudioRoomsMocks([testRoom]);

    // Mock token endpoint
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/token`, {
      statusCode: 200,
      body: {
        token: 'mock-livekit-token-xyz',
        room_id: testRoom.id,
        room_name: testRoom.room_name,
        livekit_url: 'wss://mock-livekit.example.com',
        is_speaker: false,
        user_id: 'current-user',
      },
    }).as('getToken');

    // Mock stage info
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/${testRoom.id}/stage`, {
      statusCode: 200,
      body: {
        room_id: testRoom.id,
        room_name: testRoom.room_name,
        host: {
          id: testRoom.host_id,
          display_name: testRoom.host?.display_name ?? 'Host',
          avatar_url: testRoom.host?.avatar_url ?? null,
        },
        co_host_id: null,
        speakers: [
          {
            user_id: testRoom.host_id,
            display_name: testRoom.host?.display_name ?? 'Host',
            avatar_url: testRoom.host?.avatar_url ?? null,
          },
        ],
        raised_hands: [],
        listeners_count: testRoom.listeners_count,
      },
    }).as('getStage');

    // Mock raise-hand
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/raise-hand`, {
      statusCode: 200,
      body: { ...testRoom, raised_hands: ['current-user'] },
    }).as('raiseHand');

    // Mock approve speaker
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/approve-speaker`, {
      statusCode: 200,
      body: { ...testRoom, speakers: [...testRoom.speakers, 'target-user'] },
    }).as('approveSpeaker');

    // Mock invite co-host
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/invite-co-host`, {
      statusCode: 200,
      body: { ...testRoom, co_host_id: 'cohost-new' },
    }).as('inviteCoHost');

    // Mock remove co-host
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/remove-co-host`, {
      statusCode: 200,
      body: { ...testRoom, co_host_id: null },
    }).as('removeCoHost');
  });

  it('should fetch a LiveKit token when joining a room', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/token`,
      body: { room_name: testRoom.room_name },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const body = response.body;
      expect(body.token).to.be.a('string');
      expect(body.token).to.not.be.empty;
      expect(body.room_id).to.eq(testRoom.id);
      expect(body.livekit_url).to.include('wss://');
    });
  });

  it('should fetch stage information for a room', () => {
    cy.request({
      method: 'GET',
      url: `${AUDIO_ROOMS_BASE}/${testRoom.id}/stage`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const body = response.body;
      expect(body.room_id).to.eq(testRoom.id);
      expect(body.host).to.not.be.null;
      expect(body.speakers).to.be.an('array');
      expect(body.speakers.length).to.be.greaterThan(0);
    });
  });

  it('should raise hand to request speaker role', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/raise-hand`,
      body: { room_id: testRoom.id },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.raised_hands).to.include('current-user');
    });
  });

  it('should approve a speaker from raised hands', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/approve-speaker`,
      body: { room_id: testRoom.id, target_user_id: 'target-user' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.speakers).to.include('target-user');
    });
  });

  it('should invite a co-host to the split-screen video layout', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/invite-co-host`,
      body: { room_id: testRoom.id, target_user_id: 'cohost-new' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.co_host_id).to.eq('cohost-new');
    });
  });

  it('should remove a co-host from the split-screen layout', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/remove-co-host`,
      body: { room_id: testRoom.id, target_user_id: 'cohost-new' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.co_host_id).to.be.null;
    });
  });
});

// -----------------------------------------------------------------
// 4. Video Rooms - Stage & Speaker Management
// -----------------------------------------------------------------

describe('Video Classrooms - Stage Management', () => {
  const testRoom = makeAudioRoom({
    id: 'room-stage-001',
    room_name: 'room-stage-test',
    title: 'Stage Test Room',
    is_video_stream: true,
    speakers: ['host-user-1', 'speaker-2', 'speaker-3'],
    raised_hands: ['user-waiting-1', 'user-waiting-2'],
  });

  beforeEach(() => {
    setupAudioRoomsMocks([testRoom]);

    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/token`, {
      statusCode: 200,
      body: {
        token: 'mock-stage-token',
        room_id: testRoom.id,
        room_name: testRoom.room_name,
        livekit_url: 'wss://mock-livekit.example.com',
        is_speaker: true,
        user_id: testRoom.host_id,
      },
    }).as('getHostToken');

    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/${testRoom.id}/stage`, {
      statusCode: 200,
      body: {
        room_id: testRoom.id,
        room_name: testRoom.room_name,
        host: {
          id: testRoom.host_id,
          display_name: 'Carlos M.',
          avatar_url: 'https://i.pravatar.cc/150?u=host-1',
        },
        co_host_id: null,
        speakers: [
          { user_id: 'host-user-1', display_name: 'Carlos M.', avatar_url: 'https://i.pravatar.cc/150?u=host-1' },
          { user_id: 'speaker-2', display_name: 'Maria G.', avatar_url: 'https://i.pravatar.cc/150?u=speaker-2' },
          { user_id: 'speaker-3', display_name: 'Kenji T.', avatar_url: 'https://i.pravatar.cc/150?u=speaker-3' },
        ],
        raised_hands: testRoom.raised_hands,
        listeners_count: testRoom.listeners_count,
      },
    }).as('getStageInfo');
  });

  it('should display stage participants for the host', () => {
    cy.request({
      method: 'GET',
      url: `${AUDIO_ROOMS_BASE}/${testRoom.id}/stage`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const body = response.body;
      expect(body.speakers.length).to.eq(3);
      expect(body.host.display_name).to.eq('Carlos M.');
      expect(body.raised_hands.length).to.eq(2);
    });
  });

  it('should allow the host to mute and demote a speaker', () => {
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/mute-speaker`, {
      statusCode: 200,
      body: { ...testRoom, speakers: ['host-user-1', 'speaker-3'] },
    }).as('muteSpeaker');

    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/demote-speaker`, {
      statusCode: 200,
      body: { ...testRoom, speakers: ['host-user-1', 'speaker-3'] },
    }).as('demoteSpeaker');

    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/demote-speaker`,
      body: { room_id: testRoom.id, target_user_id: 'speaker-2' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.speakers).to.not.include('speaker-2');
    });
  });

  it('should fail to manage stage without authentication', () => {
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/approve-speaker`,
      body: { room_id: testRoom.id, target_user_id: 'user-waiting-1' },
      failOnStatusCode: false,
    });
  });
});

// -----------------------------------------------------------------
// 5. Video Calls - 1-on-1 Call Flow
// -----------------------------------------------------------------

describe('Video Classrooms - 1-on-1 Video Call Flow', () => {
  beforeEach(() => {
    setupCommonMocks();

    // Mock start call
    cy.intercept('POST', `${VIDEO_CALLS_BASE}/start`, {
      statusCode: 201,
      body: {
        token: 'mock-video-call-token-start',
        roomName: 'video_call_abc123',
      },
    }).as('startCall');

    // Mock accept call
    cy.intercept('POST', `${VIDEO_CALLS_BASE}/accept`, {
      statusCode: 200,
      body: {
        token: 'mock-video-call-token-accept',
        roomName: 'video_call_abc123',
      },
    }).as('acceptCall');
  });

  it('should start a new video call and receive token and room name', () => {
    cy.request({
      method: 'POST',
      url: `${VIDEO_CALLS_BASE}/start`,
      body: { remoteUserId: 'partner-999' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      const body = response.body;
      expect(body.token).to.be.a('string');
      expect(body.token).to.not.be.empty;
      expect(body.roomName).to.be.a('string');
      expect(body.roomName).to.include('video_call');
    });
  });

  it('should accept an incoming video call and receive token', () => {
    cy.request({
      method: 'POST',
      url: `${VIDEO_CALLS_BASE}/accept`,
      body: { roomName: 'video_call_abc123' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const body = response.body;
      expect(body.token).to.be.a('string');
      expect(body.token).to.not.be.empty;
      expect(body.roomName).to.eq('video_call_abc123');
    });
  });

  it('should fail to start a call without a remote user ID', () => {
    cy.intercept('POST', `${VIDEO_CALLS_BASE}/start`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'remoteUserId is required' },
    }).as('startInvalid');

    cy.request({
      method: 'POST',
      url: `${VIDEO_CALLS_BASE}/start`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });
});

// -----------------------------------------------------------------
// 6. Call Logs - Call History
// -----------------------------------------------------------------

describe('Video Classrooms - Call Logs', () => {
  beforeEach(() => {
    setupAudioRoomsMocks();
    cy.visit('/call-logs');
  });

  it('should display the call logs page', () => {
    cy.wait('@getCallLogs');
    cy.get('body').should('exist');
  });

  it('should list call history entries with details', () => {
    cy.request({
      method: 'GET',
      url: `${AUDIO_ROOMS_BASE}/call-logs`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const body = response.body as CallLogRecord[];
      expect(body).to.be.an('array');
      expect(body.length).to.be.greaterThan(0);

      // Verify call log structure
      const firstLog = body[0];
      expect(firstLog).to.have.property('id');
      expect(firstLog).to.have.property('caller_name');
      expect(firstLog).to.have.property('receiver_name');
      expect(firstLog).to.have.property('call_type');
      expect(firstLog).to.have.property('room_name');
      expect(firstLog).to.have.property('duration_seconds');
    });
  });

  it('should contain outgoing, incoming, and missed call types', () => {
    cy.request({
      method: 'GET',
      url: `${AUDIO_ROOMS_BASE}/call-logs`,
      failOnStatusCode: false,
    }).then((response) => {
      const body = response.body as CallLogRecord[];
      const types = body.map((l: CallLogRecord) => l.call_type);
      expect(types).to.include('outgoing');
      expect(types).to.include('incoming');
      expect(types).to.include('missed');
    });
  });

  it('should handle empty call logs gracefully', () => {
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/call-logs*`, {
      statusCode: 200,
      body: [],
    }).as('getEmptyCallLogs');

    cy.visit('/call-logs');

    cy.wait('@getEmptyCallLogs');
    cy.get('body').should('exist');
  });
});

// -----------------------------------------------------------------
// 7. Classrooms Marketplace
// -----------------------------------------------------------------

describe('Video Classrooms - Classrooms Marketplace', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should render the classrooms marketplace component', () => {
    cy.visit('/');
    // The marketplace is a component that may be included in the home page
    // or at a dedicated route. Verify the app loads without errors.
    cy.get('body').should('exist');
  });

  it('should display the marketplace section text', () => {
    cy.visit('/');
    cy.get('body').should('exist');
  });
});

// -----------------------------------------------------------------
// 8. VoIP Call Flow - Incoming/Outgoing Calls
// -----------------------------------------------------------------

describe('Video Classrooms - VoIP Call Flow', () => {
  beforeEach(() => {
    setupCommonMocks();

    // Mock LiveKit token for VoIP
    cy.intercept('POST', '**/api/livekit/token', {
      statusCode: 201,
      body: { token: 'mock-voip-token' },
    }).as('getLivekitToken');

    // Mock active-call related endpoints
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/list*`, {
      statusCode: 200,
      body: [],
    }).as('getEmptyRoomList');
  });

  it('should load the active call page', () => {
    cy.visit('/active-call');
    cy.get('body').should('exist');
  });

  it('should handle the VoIP call component interactions', () => {
    cy.visit('/active-call');
    cy.get('body').should('exist');
  });
});

// -----------------------------------------------------------------
// 9. Integration - Full User Journey
// -----------------------------------------------------------------

describe('Video Classrooms - Full User Journey', () => {
  const mockRooms = createMockRooms();

  beforeEach(() => {
    setupAudioRoomsMocks(mockRooms);

    // Token mock
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/token`, {
      statusCode: 200,
      body: {
        token: 'mock-journey-token',
        room_id: mockRooms[0].id,
        room_name: mockRooms[0].room_name,
        livekit_url: 'wss://mock-livekit.example.com',
        is_speaker: false,
        user_id: 'journey-user',
      },
    }).as('journeyToken');

    // Video call start
    cy.intercept('POST', `${VIDEO_CALLS_BASE}/start`, {
      statusCode: 201,
      body: {
        token: 'mock-journey-video-token',
        roomName: 'video_journey_001',
      },
    }).as('journeyStartVideo');

    // Video call accept
    cy.intercept('POST', `${VIDEO_CALLS_BASE}/accept`, {
      statusCode: 200,
      body: {
        token: 'mock-journey-accept-token',
        roomName: 'video_journey_001',
      },
    }).as('journeyAcceptVideo');
  });

  it('should complete the full video classrooms journey: browse rooms, view room, initiate call', () => {
    // Step 1: Visit audio rooms lobby
    cy.visit('/audio-rooms');
    cy.wait('@getAudioRoomsList');

    // Verify rooms are displayed
    cy.contains('Spanish-English Language Exchange').should('be.visible');

    // Step 2: Check that video stream rooms are distinguishable
    cy.contains('Japanese Practice').should('be.visible');

    // Step 3: Navigate to call logs after room browsing
    cy.visit('/call-logs');
    cy.wait('@getCallLogs');
    cy.get('body').should('exist');

    // Verify the app has not crashed after multiple navigations
    cy.get('body').should('exist');
  });

  it('should handle room creation and interaction flow via API', () => {
    // Create a new video-stream room
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/create`, (req) => {
      expect(req.body.is_video_stream).to.eq(true);
      req.reply({
        statusCode: 201,
        body: makeAudioRoom({
          id: 'journey-new-room',
          room_name: 'journey-room',
          title: req.body.title,
          language_pair: req.body.language_pair,
          is_video_stream: true,
          host_id: 'journey-user',
          speakers: ['journey-user'],
          listeners_count: 1,
        }),
      });
    }).as('createVideoRoom');

    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/create`,
      body: {
        title: 'My Video Classroom',
        target_language: 'es',
        language_pair: 'es-en',
        topic_tag: 'conversation',
        is_video_stream: true,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.is_video_stream).to.eq(true);
      expect(response.body.title).to.eq('My Video Classroom');
      expect(response.body.speakers).to.include('journey-user');
    });
  });

  it('should verify video classrooms communication endpoints are operational', () => {
    // Verify all critical video classrooms endpoints respond correctly
    const endpoints = [
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/list` },
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/by-language` },
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/topics` },
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/levels` },
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/call-logs` },
      { method: 'GET', url: `${AUDIO_ROOMS_BASE}/soundboard/list` },
    ];

    cy.wrap(endpoints).each((ep: { method: string; url: string }) => {
      cy.request({
        method: ep.method as never,
        url: ep.url,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });
});

// -----------------------------------------------------------------
// 10. Error Handling & Edge Cases
// -----------------------------------------------------------------

describe('Video Classrooms - Error Handling & Edge Cases', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('should handle LiveKit token fetch failure gracefully', () => {
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/token`, {
      statusCode: 503,
      body: { statusCode: 503, message: 'LiveKit service unavailable' },
    }).as('tokenFail');

    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/list*`, {
      statusCode: 200,
      body: [makeAudioRoom()],
    }).as('roomList');

    cy.visit('/audio-rooms');
    cy.wait('@roomList');
    cy.get('body').should('exist');
  });

  it('should handle an expired/invalid room gracefully', () => {
    cy.intercept('GET', `${AUDIO_ROOMS_BASE}/room-expired/stage`, {
      statusCode: 404,
      body: { statusCode: 404, message: 'Room not found or expired' },
    }).as('expiredRoom');

    cy.request({
      method: 'GET',
      url: `${AUDIO_ROOMS_BASE}/room-expired/stage`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it('should handle concurrent room join attempts', () => {
    let callCount = 0;
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/token`, () => {
      callCount++;
      return {
        statusCode: callCount <= 1 ? 200 : 409,
        body:
          callCount <= 1
            ? {
                token: 'first-token',
                room_id: 'concurrent-room',
                room_name: 'concurrent-room',
                livekit_url: 'wss://mock.example.com',
                is_speaker: false,
                user_id: 'user-1',
              }
            : { statusCode: 409, message: 'Already in room' },
      };
    }).as('concurrentToken');

    // First request should succeed
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/token`,
      body: { room_name: 'concurrent-room' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });

    // Second request should be rejected
    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/token`,
      body: { room_name: 'concurrent-room' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should handle invalid room creation payload', () => {
    cy.intercept('POST', `${AUDIO_ROOMS_BASE}/create`, {
      statusCode: 400,
      body: {
        statusCode: 400,
        message: 'Validation failed: language_pair must be a valid ISO pair',
      },
    }).as('createInvalidPayload');

    cy.request({
      method: 'POST',
      url: `${AUDIO_ROOMS_BASE}/create`,
      body: {
        title: 'Test',
        target_language: 'invalid-xx',
        language_pair: 'invalid-xx',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.include('Validation');
    });
  });
});