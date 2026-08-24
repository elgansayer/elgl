import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { QuickPollService } from './quick-poll.service';

describe('QuickPollService', () => {
  const getAccessToken = vi.fn();
  const fetchMock = vi.fn();
  let service: QuickPollService;

  beforeEach(() => {
    getAccessToken.mockReturnValue('test-token');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [
        QuickPollService,
        {
          provide: AuthService,
          useValue: { getAccessToken },
        },
      ],
    });

    service = TestBed.inject(QuickPollService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates a normalised poll through the authenticated room endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ poll_id: 'poll-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.createPoll('room/one', '  Next topic?  ', [' Travel ', ' Food ']),
    ).resolves.toEqual({ poll_id: 'poll-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/audio-rooms/room%2Fone/polls', {
      method: 'POST',
      body: JSON.stringify({ question: 'Next topic?', options: ['Travel', 'Food'] }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('accepts the empty 201 response returned by a successful vote', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    await expect(service.submitVote('poll-1', 2)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/audio-rooms/polls/vote', {
      method: 'POST',
      body: JSON.stringify({ pollId: 'poll-1', optionIndex: 2 }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('fails closed when no authenticated token is available', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.getPollResults('room-1', 'poll-1')).rejects.toThrow(
      'Authentication required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid or duplicate options before sending a request', async () => {
    await expect(service.createPoll('room-1', 'Question?', ['Same', ' same '])).rejects.toThrow(
      'Invalid quick poll',
    );
    await expect(
      service.createPoll('room-1', 'Question?', ['1', '2', '3', '4', '5', '6', '7']),
    ).rejects.toThrow('Invalid quick poll');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves only known actionable API errors', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'You have already voted on this poll' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.submitVote('poll-1', 0)).rejects.toThrow(
      'You have already voted on this poll',
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'database.internal_secret: relation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.submitVote('poll-1', 0)).rejects.toThrow('Quick poll request failed');
  });

  it('validates vote indexes before sending a request', async () => {
    await expect(service.submitVote('poll-1', -1)).rejects.toThrow('Invalid quick poll vote');
    await expect(service.submitVote('poll-1', 1.5)).rejects.toThrow('Invalid quick poll vote');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
