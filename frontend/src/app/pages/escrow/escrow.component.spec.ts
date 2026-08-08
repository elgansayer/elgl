import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EscrowComponent } from './escrow.component';
import { EscrowService, EscrowTransaction } from '../../services/escrow.service';

const mockEscrow: EscrowTransaction = {
  id: 'e-1',
  sender_id: 'payer-abc',
  receiver_id: 'recipient-xyz',
  amount: 100,
  status: 'pending',
  description: 'Language exchange lesson',
  service_type: 'language_exchange',
  dispute_reason: null,
  dispute_evidence: null,
  admin_note: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
};

describe.skip('EscrowComponent', () => {
  let fixture: ComponentFixture<EscrowComponent>;
  let listEscrowsMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listEscrowsMock = vi.fn().mockResolvedValue([mockEscrow]);

    await TestBed.configureTestingModule({
      imports: [EscrowComponent],
      providers: [
        provideRouter([]),
        { provide: EscrowService, useValue: { listEscrows: listEscrowsMock } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EscrowComponent);
  });

  it('should show skeleton loaders while loading', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-skeleton-loader')).toBeTruthy();
  });

  it('should load escrows and render them', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Language exchange lesson');
    expect(text).toContain('100');
  });

  it('should show empty state when no escrows exist', async () => {
    listEscrowsMock.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should show empty state when filtering returns no results', async () => {
    listEscrowsMock.mockResolvedValue([mockEscrow]);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance['onFilterChange']('released');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should filter escrows by status', async () => {
    const pendingEscrow = { ...mockEscrow, id: 'e-1', status: 'pending' as const };
    const releasedEscrow = { ...mockEscrow, id: 'e-2', status: 'released' as const };
    listEscrowsMock.mockResolvedValue([pendingEscrow, releasedEscrow]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let cards = (fixture.nativeElement as HTMLElement).querySelectorAll('app-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    fixture.componentInstance['onFilterChange']('released');
    fixture.detectChanges();
    await fixture.whenStable();

    cards = (fixture.nativeElement as HTMLElement).querySelectorAll('app-card');
    expect(cards.length).toBe(1);
  });

  it('should handle error state', async () => {
    listEscrowsMock.mockRejectedValue(new Error('Network error'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('We could not load');
  });

  it('should show status filter pills', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should display status pill colours for varied statuses', async () => {
    const allStatuses: EscrowTransaction[] = [
      { ...mockEscrow, id: 'e-1', status: 'pending' },
      { ...mockEscrow, id: 'e-2', status: 'released' },
      { ...mockEscrow, id: 'e-3', status: 'disputed' },
      { ...mockEscrow, id: 'e-4', status: 'refunded' },
    ];
    listEscrowsMock.mockResolvedValue(allStatuses);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const pills = el.querySelectorAll('app-pill');
    expect(pills.length).toBe(4);
  });

  it('should render filter labels with counts', async () => {
    listEscrowsMock.mockResolvedValue([mockEscrow]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('All');
    expect(text).toContain('Pending');
    expect(text).toContain('Released');
    expect(text).toContain('Refunded');
    expect(text).toContain('Disputed');
  });

  it('should render app-card for each escrow', async () => {
    listEscrowsMock.mockResolvedValue([mockEscrow]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-card');
    expect(cards.length).toBe(1);
  });
});