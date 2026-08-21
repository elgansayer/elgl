import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { EscrowDetailComponent } from './escrow-detail.component';
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

describe.skip('EscrowDetailComponent', () => {
  let fixture: ComponentFixture<EscrowDetailComponent>;
  let getEscrowMock: ReturnType<typeof vi.fn>;

  const createActivatedRoute = (id: string) => ({
    snapshot: { paramMap: { get: () => id } },
    paramMap: of({ get: () => id }),
  });

  beforeEach(async () => {
    getEscrowMock = vi.fn().mockResolvedValue(mockEscrow);

    await TestBed.configureTestingModule({
      imports: [EscrowDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: EscrowService,
          useValue: {
            getEscrow: getEscrowMock,
            releaseEscrow: vi.fn(),
            refundEscrow: vi.fn(),
            disputeEscrow: vi.fn(),
          },
        },
        { provide: ActivatedRoute, useValue: createActivatedRoute('e-1') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EscrowDetailComponent);
  });

  it('should show skeleton loader while loading', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-skeleton-loader')).toBeTruthy();
  });

  it('should load escrow detail and render it', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Language exchange lesson');
    expect(text).toContain('100');
  });

  it('should show error state on load failure', async () => {
    getEscrowMock.mockRejectedValue(new Error('Network error'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('We could not load');
  });

  it('should show empty state when escrow is null', async () => {
    getEscrowMock.mockResolvedValue(null);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should display dispute reason when present', async () => {
    const disputedEscrow = {
      ...mockEscrow,
      status: 'disputed' as const,
      dispute_reason: 'Service not delivered as described',
    };
    getEscrowMock.mockResolvedValue(disputedEscrow);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Service not delivered as described');
  });

  it('should display admin note when present', async () => {
    const escrowWithNote = {
      ...mockEscrow,
      admin_note: 'Resolution approved by admin',
    };
    getEscrowMock.mockResolvedValue(escrowWithNote);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Resolution approved by admin');
  });

  it('should show action buttons for pending escrows', async () => {
    getEscrowMock.mockResolvedValue(mockEscrow);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Release Funds');
    expect(text).toContain('Refund');
    expect(text).toContain('Report Dispute');
  });

  it('should not show action buttons for released escrows', async () => {
    getEscrowMock.mockResolvedValue({ ...mockEscrow, status: 'released' as const });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Release Funds');
    expect(text).not.toContain('Refund');
  });
});