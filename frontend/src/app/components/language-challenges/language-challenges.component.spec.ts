import { TestBed } from '@angular/core/testing';
import { LanguageChallengesComponent } from './language-challenges.component';
import {
  LanguageChallenge,
  LanguageChallengesClient,
} from '../../services/language-challenges.service';

const challenge: LanguageChallenge = {
  id: '11111111-1111-4111-8111-111111111111',
  creator_id: '22222222-2222-4222-8222-222222222222',
  title: '7-day writing streak',
  description: 'Write every day',
  entry_fee_coins: 25,
  duration_days: 7,
  challenge_type: 'streak',
  prize_pool_coins: 50,
  status: 'open',
  starts_at: '2026-08-20T00:00:00.000Z',
  ends_at: '2099-08-27T00:00:00.000Z',
  completed_at: null,
  created_at: '2026-08-20T00:00:00.000Z',
  joined: false,
  participant_status: null,
  progress_days: 0,
  prize_coins: 0,
  ended: false,
};

describe('LanguageChallengesComponent', () => {
  const client = {
    list: vi.fn(),
    create: vi.fn(),
    join: vi.fn(),
    checkIn: vi.fn(),
    claim: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    client.list.mockResolvedValue([challenge]);
    await TestBed.configureTestingModule({
      imports: [LanguageChallengesComponent],
      providers: [{ provide: LanguageChallengesClient, useValue: client }],
    }).compileComponents();
  });

  it('loads challenges and renders coin stakes without exposing participant identities', async () => {
    const fixture = TestBed.createComponent(LanguageChallengesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(client.list).toHaveBeenCalledWith(50, 0);
    expect(fixture.nativeElement.textContent).toContain('7-day writing streak');
    expect(fixture.nativeElement.textContent).toContain('25 coins');
    expect(fixture.nativeElement.textContent).toContain('50 coins');
  });

  it('requires an explicit second confirmation before spending an entry fee', async () => {
    const fixture = TestBed.createComponent(LanguageChallengesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.pendingJoinId.set(challenge.id);
    fixture.detectChanges();

    expect(client.join).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Confirm spending 25 coins to join',
    );
  });

  it('refreshes canonical state after a successful idempotent join', async () => {
    const fixture = TestBed.createComponent(LanguageChallengesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    client.join.mockResolvedValue({
      joined: true,
      alreadyJoined: false,
      coinsRemaining: 75,
      prizePoolCoins: 75,
    });
    client.list.mockResolvedValue([{ ...challenge, joined: true, prize_pool_coins: 75 }]);

    await fixture.componentInstance.confirmJoin(challenge);

    expect(client.join).toHaveBeenCalledWith(challenge.id);
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.message()).toContain('75 coins remain');
  });

  it('keeps already loaded challenge data when a refresh fails', async () => {
    const fixture = TestBed.createComponent(LanguageChallengesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.challenges()).toHaveLength(1);

    client.list.mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.error()).toBe(true);
    expect(fixture.componentInstance.challenges()).toEqual([challenge]);
  });

  it('clamps malformed progress before rendering the progress bar', () => {
    const fixture = TestBed.createComponent(LanguageChallengesComponent);
    const component = fixture.componentInstance;

    expect(component.progressPercent({ ...challenge, progress_days: 99 })).toBe(100);
    expect(component.progressPercent({ ...challenge, progress_days: -5 })).toBe(0);
    expect(component.progressPercent({ ...challenge, duration_days: 0 })).toBe(0);
  });
});
