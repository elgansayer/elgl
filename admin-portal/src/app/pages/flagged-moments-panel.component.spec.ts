import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthContextService } from '../admin-auth-context.service';
import {
  AdminFlaggedMomentsService,
  FlaggedMomentItem,
  ModerationActionError,
} from '../admin-flagged-moments.service';
import { FlaggedMomentsPanelComponent } from './flagged-moments-panel.component';

const item: FlaggedMomentItem = {
  reportId: 'report-1',
  status: 'pending',
  reasonCategory: 'harassment',
  reportDescription: 'rude',
  createdAt: '2026-11-09T10:00:00.000Z',
  reporter: { id: 'reporter-1', displayName: 'Reporter' },
  author: { id: 'author-1', displayName: 'Author', activeSuspension: null },
  moment: {
    id: 'moment-1',
    excerpt: 'flagged words',
    available: true,
    postType: 'moment',
    targetLanguage: 'es',
    mediaType: 'image',
    mediaUrls: ['https://cdn.example.test/a.png'],
  },
};

describe('FlaggedMomentsPanelComponent', () => {
  const list = vi.fn();
  const resolve = vi.fn();
  const suspend = vi.fn();
  const lift = vi.fn();
  let canManage: boolean;
  let fixture: ComponentFixture<FlaggedMomentsPanelComponent>;
  let component: FlaggedMomentsPanelComponent;

  const page = (items: FlaggedMomentItem[], total = items.length) => ({
    items,
    total,
    page: 1,
    pageSize: 10,
  });

  const create = async (items: FlaggedMomentItem[] = [item], total?: number) => {
    list.mockReturnValue(of(page(items, total)));
    TestBed.configureTestingModule({
      imports: [FlaggedMomentsPanelComponent],
      providers: [
        provideRouter([]),
        { provide: AdminFlaggedMomentsService, useValue: { list, resolve, suspend, lift } },
        {
          provide: AdminAuthContextService,
          useValue: { hasCapability: (capability: string) => canManage && capability === 'moderation.cases.manage' },
        },
      ],
    });
    fixture = TestBed.createComponent(FlaggedMomentsPanelComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const host = (): HTMLElement => fixture.nativeElement;
  const buttonText = (): string[] =>
    Array.from(host().querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');
  const click = async (label: string) => {
    const button = Array.from(host().querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    );
    expect(button, `button "${label}"`).toBeTruthy();
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const submit = async () => {
    host().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    list.mockReset();
    resolve.mockReset();
    suspend.mockReset();
    lift.mockReset();
    canManage = true;
    TestBed.resetTestingModule();
  });

  it('loads the first pending page and renders the evidence snapshot', async () => {
    await create();

    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'pending' });
    expect(host().textContent).toContain('flagged words');
    expect(host().textContent).toContain('Awaiting review');
    const media = host().querySelector<HTMLAnchorElement>('.media a');
    expect(media?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(media?.getAttribute('target')).toBe('_blank');
    expect(host().querySelector('[role="status"]')?.textContent).toContain('1 flagged Moment');
  });

  it('explains when the author deleted the Moment but keeps the snapshot', async () => {
    await create([{ ...item, moment: { ...item.moment, available: false, mediaUrls: [] } }]);

    expect(host().textContent).toContain('The author has since deleted this Moment');
    expect(host().textContent).toContain('flagged words');
  });

  it('shows the empty state and no actions when nothing is flagged', async () => {
    await create([]);

    expect(host().textContent).toContain('No flagged Moments match this filter.');
    expect(buttonText()).toEqual([]);
  });

  it('offers no enforcement controls without the manage capability', async () => {
    canManage = false;
    await create();

    expect(buttonText().some((label) => /Dismiss|Uphold|suspend/i.test(label))).toBe(false);
    component.open(item, 'dismiss');
    expect(component.review()).toBeNull();
  });

  it('reports a failed load as an alert, never as an empty queue', async () => {
    list.mockReturnValue(throwError(() => new ModerationActionError('unavailable')));
    TestBed.configureTestingModule({
      imports: [FlaggedMomentsPanelComponent],
      providers: [
        provideRouter([]),
        { provide: AdminFlaggedMomentsService, useValue: { list } },
        { provide: AdminAuthContextService, useValue: { hasCapability: () => true } },
      ],
    });
    fixture = TestBed.createComponent(FlaggedMomentsPanelComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host().querySelector('[role="alert"]')?.textContent).toContain(
      'The moderation service is unavailable',
    );
    expect(host().textContent).not.toContain('No flagged Moments match');
  });

  it('requires an explicit confirmation, with consequence text, before dismissing', async () => {
    await create();
    resolve.mockReturnValue(of({ reportId: 'report-1', status: 'approved', replayed: false }));

    await click('Dismiss report');

    expect(resolve).not.toHaveBeenCalled();
    expect(host().querySelector('form')?.textContent).toContain('The Moment stays visible');

    component.operatorNote = '  looks fine  ';
    await submit();

    expect(resolve).toHaveBeenCalledWith('report-1', {
      decision: 'dismiss',
      reasonCode: 'other_reviewed',
      operatorNote: 'looks fine',
    });
    expect(component.feedback()).toBe('Report dismissed.');
    expect(component.review()).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('states that upholding alone does not restrict the author', async () => {
    await create();

    await click('Uphold report');

    expect(host().querySelector('.consequence')?.textContent).toContain(
      'does not remove the Moment or restrict the author',
    );
  });

  it('suspends the author with a bounded expiry, the report and a stable idempotency key', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    try {
      await create();
      suspend.mockReturnValueOnce(
        throwError(() => new ModerationActionError('unavailable')),
      );
      suspend.mockReturnValueOnce(
        of({ suspensionId: 's1', expiresAt: '2026-11-16T10:00:00.000Z', replayed: false }),
      );

      await click('Uphold and suspend author');
      expect(host().querySelector('.consequence')?.textContent).toContain('blocked from the app');
      component.durationDays = 7;
      component.reasonCode = 'fraud_or_abuse';
      await submit();

      // The first attempt failed: the form stays open, the error is announced, nothing is lost.
      expect(component.review()).not.toBeNull();
      expect(host().querySelector('form [role="alert"]')?.textContent).toContain(
        'moderation service is unavailable',
      );

      await submit();

      expect(suspend).toHaveBeenCalledTimes(2);
      const [userId, first] = suspend.mock.calls[0];
      const second = suspend.mock.calls[1][1];
      expect(userId).toBe('author-1');
      expect(first).toMatchObject({
        expiresAt: '2026-11-16T10:00:00.000Z',
        reasonCode: 'fraud_or_abuse',
        reportId: 'report-1',
      });
      expect(first.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
      // A retry of the same request reuses the key so a second suspension cannot be issued.
      expect(second.idempotencyKey).toBe(first.idempotencyKey);
      expect(component.feedback()).toContain('Author suspended until');
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts a new request when the operator changes the length after a failure', async () => {
    await create();
    suspend.mockReturnValue(throwError(() => new ModerationActionError('unavailable')));

    await click('Uphold and suspend author');
    component.durationDays = 1;
    await submit();
    component.durationDays = 30;
    await submit();

    expect(suspend.mock.calls[0][1].idempotencyKey).not.toBe(suspend.mock.calls[1][1].idempotencyKey);
  });

  it('surfaces a conflict decided by another reviewer without closing the form', async () => {
    await create();
    resolve.mockReturnValue(throwError(() => new ModerationActionError('conflict')));

    await click('Uphold report');
    await submit();

    expect(host().querySelector('form [role="alert"]')?.textContent).toContain(
      'Another reviewer already decided this case',
    );
    expect(component.review()).not.toBeNull();
  });

  it('shows an active suspension and lifts it on confirmation', async () => {
    await create([
      {
        ...item,
        author: {
          ...item.author,
          activeSuspension: { id: 'susp-1', expiresAt: '2026-11-20T00:00:00.000Z' },
        },
      },
    ]);
    lift.mockReturnValue(of({ suspensionId: 'susp-1', replayed: false }));

    expect(host().querySelector('.suspended')?.textContent).toContain('Author suspended');
    expect(buttonText().some((label) => label.includes('Uphold and suspend'))).toBe(false);

    await click('Lift suspension');
    await submit();

    expect(lift).toHaveBeenCalledWith('susp-1', {
      reasonCode: 'policy_violation',
      operatorNote: undefined,
    });
    expect(component.feedback()).toBe('Suspension lifted.');
  });

  it('cancels without calling the API', async () => {
    await create();

    await click('Dismiss report');
    await click('Cancel');

    expect(component.review()).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('reloads the first page when the status filter changes', async () => {
    await create();

    await component.changeStatus('rejected');

    expect(list).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: 'rejected' });
  });

  it('pages through a bounded queue', async () => {
    await create([item], 25);

    expect(component.totalPages()).toBe(3);
    component.nextPage();
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, status: 'pending' });
  });
});
