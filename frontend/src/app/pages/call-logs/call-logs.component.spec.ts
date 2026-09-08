import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CallLogsComponent } from './call-logs.component';
import { CallLogsService, CallLogRecord } from '../../services/call-logs.service';

describe('CallLogsComponent', () => {
  let fixture: ComponentFixture<CallLogsComponent>;
  let getCallLogsMock: ReturnType<typeof vi.fn>;

  const missedLog: CallLogRecord = {
    id: 'log-1',
    caller_id: 'user-1',
    caller_name: 'Alex',
    receiver_id: 'user-2',
    receiver_name: 'Sam',
    call_type: 'missed',
    room_name: 'room-1',
    started_at: '2026-08-01T10:00:00Z',
    ended_at: null,
    duration_seconds: null,
    created_at: '2026-08-01T10:00:00Z',
  };

  beforeEach(async () => {
    getCallLogsMock = vi.fn().mockResolvedValue([missedLog]);

    await TestBed.configureTestingModule({
      imports: [CallLogsComponent],
      providers: [
        provideRouter([]),
        { provide: CallLogsService, useValue: { getCallLogs: getCallLogsMock } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CallLogsComponent);
  });

  it('loads call logs on init and renders them', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getCallLogsMock).toHaveBeenCalledWith({ callType: undefined });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Alex');
    expect(text).toContain('Sam');
  });

  it('re-fetches with the selected call type filter', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.onFilterChange('missed');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getCallLogsMock).toHaveBeenCalledWith({ callType: 'missed' });
  });

  it('shows an empty state when there are no logs', async () => {
    getCallLogsMock.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('[data-slot="empty"]') as HTMLElement;
    const action = emptyState.querySelector('a[href="/discovery"]');

    expect(emptyState.textContent).toContain('No call logs');
    expect(emptyState.getAttribute('aria-labelledby')).toBe('call-logs-empty-title');
    expect(action?.textContent).toContain('Find a partner');
  });

  it('does not announce an empty history while call logs are loading', async () => {
    let resolveLogs!: (logs: CallLogRecord[]) => void;
    getCallLogsMock.mockReturnValue(
      new Promise<CallLogRecord[]>((resolve) => {
        resolveLogs = resolve;
      }),
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Loading...',
    );
    expect(fixture.nativeElement.querySelector('#call-logs-empty-title')).toBeNull();

    resolveLogs([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#call-logs-empty-title')).toBeTruthy();
  });

  it('offers a retry when call logs fail to load', async () => {
    getCallLogsMock.mockRejectedValueOnce(new Error('network unavailable'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('[data-slot="empty"]') as HTMLElement;
    expect(errorState.textContent).toContain('Unable to load call logs');

    (errorState.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getCallLogsMock).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Alex');
  });
});
