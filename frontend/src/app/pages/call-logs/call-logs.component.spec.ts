import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No call logs yet.');
  });
});
