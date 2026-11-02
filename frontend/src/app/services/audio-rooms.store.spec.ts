import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import {
  AudioRoomsStore,
  HostTipPayload,
  getTipErrorKey,
  parseHostTipPayload,
} from './audio-rooms.store';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { I18nService } from './i18n.service';

describe('parseHostTipPayload', () => {
  it('accepts the typed host-tip event contract', () => {
    expect(
      parseHostTipPayload({
        tip_id: 'tip-1',
        amount_coins: 100,
        sender_user_id: 'user-1',
        sender_name: 'Alice',
        receiver_user_id: 'host-1',
        receiver_name: 'Host User',
      }),
    ).toEqual({
      tip_id: 'tip-1',
      amount_coins: 100,
      sender_user_id: 'user-1',
      sender_name: 'Alice',
      receiver_user_id: 'host-1',
      receiver_name: 'Host User',
    });
  });

  it.each([
    null,
    {},
    {
      tip_id: 'tip-1',
      amount_coins: 0,
      sender_user_id: 'user-1',
      receiver_user_id: 'host-1',
    },
    {
      tip_id: 'tip-1',
      amount_coins: 1.5,
      sender_user_id: 'user-1',
      receiver_user_id: 'host-1',
    },
    {
      tip_id: 'tip-1',
      amount_coins: 10,
      sender_user_id: 42,
      receiver_user_id: 'host-1',
    },
  ])('rejects malformed realtime payload %j', (payload) => {
    expect(parseHostTipPayload(payload)).toBeNull();
  });
});

describe('getTipErrorKey', () => {
  it('preserves a recognised server translation key for partial delivery failure', () => {
    const error = new HttpErrorResponse({
      status: 503,
      error: { message: 'audioRoom.tipDeliveryError' },
    });

    expect(getTipErrorKey(error)).toBe('audioRoom.tipDeliveryError');
  });

  it('falls back for untrusted provider error content', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { message: 'database host and user details' },
    });

    expect(getTipErrorKey(error)).toBe('audioRoom.tipError');
  });
});

describe('AudioRoomsStore host tips', () => {
  let store: AudioRoomsStore;
  let http: HttpTestingController;
  const coinsBalance = signal(120);
  const triggerPublicGiftAnimation = vi.fn();
  const currentUser = vi.fn(() => ({ id: 'user-1', display_name: 'Alice' }));

  beforeEach(() => {
    coinsBalance.set(120);
    triggerPublicGiftAnimation.mockReset();
    currentUser.mockClear();
    TestBed.configureTestingModule({
      providers: [
        AudioRoomsStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser, getAccessToken: () => 'access-token' },
        },
        {
          provide: CentrifugeService,
          useValue: {
            connect: vi.fn(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
            publish: vi.fn(),
          },
        },
        {
          provide: EconomyStore,
          useValue: { coinsBalance, triggerPublicGiftAnimation },
        },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              if (key === 'audioRoom.tipName') return `${params?.['amount']} Coins`;
              if (key === 'common.languagePartner') return 'Language Partner';
              if (key === 'audioRoom.hostFallback') return 'Room Host';
              return key;
            },
          },
        },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: signal(false),
            isCentrifugoDegraded: signal(false),
            isSupabaseDegraded: signal(false),
            isFullyOperational: signal(true),
            degradationSummary: signal(''),
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(AudioRoomsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the retry key, trusts the committed balance and starts the sender animation', async () => {
    store.currentRoom.set({
      id: 'room-1',
      room_name: 'room-one',
      title: 'Room',
      target_language: 'es',
      host_id: 'host-1',
      is_active: true,
      speakers: [],
      raised_hands: [],
      listeners_count: 1,
      created_at: '2026-11-02T00:00:00.000Z',
      host: { id: 'host-1', display_name: 'Host User' },
    });

    const resultPromise = store.tipHost('room-1', 50, '7a28776a-93f9-4c0e-b1bc-d47d02a9ca12');
    const request = http.expectOne(`${environment.apiUrl}/audio-rooms/room-1/tip`);
    expect(request.request.body).toEqual({
      room_id: 'room-1',
      amount_coins: 50,
      idempotency_key: '7a28776a-93f9-4c0e-b1bc-d47d02a9ca12',
    });
    request.flush({
      tip_id: 'tip-1',
      amount_coins: 50,
      receiver_id: 'host-1',
      sender_new_balance: 70,
      receiver_new_balance: 80,
    });

    await expect(resultPromise).resolves.toBe(true);
    expect(coinsBalance()).toBe(70);
    expect(triggerPublicGiftAnimation).toHaveBeenCalledWith({
      giftId: 'tip_tip-1',
      giftName: '50 Coins',
      giftIcon: '💝',
      animationType: 'hearts',
      animationUrl: undefined,
      senderName: 'Alice',
      receiverName: 'Host User',
      coinValue: 50,
    });
  });

  it('renders a viewer event once and ignores the sender echo', () => {
    const handleHostTipEvent = (
      store as unknown as { handleHostTipEvent: (tip: HostTipPayload) => void }
    ).handleHostTipEvent.bind(store);
    const viewerTip: HostTipPayload = {
      tip_id: 'tip-2',
      amount_coins: 500,
      sender_user_id: 'user-2',
      sender_name: 'Bea',
      receiver_user_id: 'host-1',
      receiver_name: 'Host User',
    };

    handleHostTipEvent(viewerTip);
    handleHostTipEvent(viewerTip);
    handleHostTipEvent({ ...viewerTip, tip_id: 'tip-3', sender_user_id: 'user-1' });

    expect(triggerPublicGiftAnimation).toHaveBeenCalledOnce();
    expect(triggerPublicGiftAnimation).toHaveBeenCalledWith(
      expect.objectContaining({
        giftId: 'tip_tip-2',
        giftName: '500 Coins',
        animationType: 'premium',
        senderName: 'Bea',
        receiverName: 'Host User',
      }),
    );
  });
});
