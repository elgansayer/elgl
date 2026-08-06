import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TrustSafetyModalComponent } from './trust-safety-modal.component';
import { SafetyService } from '../../services/safety.service';
import { I18nService } from '../../services/i18n.service';

describe('TrustSafetyModalComponent', () => {
  let component: TrustSafetyModalComponent;
  let fixture: ComponentFixture<TrustSafetyModalComponent>;
  let safetyServiceMock: Partial<SafetyService>;

  const mockI18nService = {
    translate: (key: string, params?: Record<string, unknown>) => {
      if (params && (params as Record<string, string>)['name']) {
        return key.replace('{{name}}', (params as Record<string, string>)['name']);
      }
      return key;
    },
  };

  beforeEach(async () => {
    safetyServiceMock = {
      reportUserAsync: vi.fn().mockResolvedValue({ success: true, message: '' }),
      blockUserAsync: vi.fn().mockResolvedValue({ success: true, blocked_id: '' }),
    };

    await TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: SafetyService, useValue: safetyServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrustSafetyModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('targetId', 'user-123');
    fixture.componentRef.setInput('targetName', 'TestUser');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render as a dialog with proper ARIA attributes', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heading = dialog.querySelector(`h2#${component.titleId}`);
    expect(heading).toBeTruthy();
    expect(dialog.getAttribute('aria-labelledby')).toBe(component.titleId);
  });

  it('should render tablist with proper ARIA roles', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('should switch to block tabpanel when block tab is clicked', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    const blockTab = tabs[1];
    blockTab.click();
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');

    const blockPanel = fixture.nativeElement.querySelector(`#${component.blockPanelId}`);
    expect(blockPanel).toBeTruthy();
    expect(blockPanel.getAttribute('role')).toBe('tabpanel');
  });

  it('should show report panel with select and textarea by default', () => {
    const reportPanel = fixture.nativeElement.querySelector(`#${component.reportPanelId}`);
    expect(reportPanel).toBeTruthy();
    const select = reportPanel.querySelector('select');
    expect(select).toBeTruthy();
    const textarea = reportPanel.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('should call safetyService.reportUserAsync and emit closed on submit', async () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component.reportReason = 'spam';
    component.reportDetails = 'test details';
    await component.submitReport();

    expect(safetyServiceMock.reportUserAsync).toHaveBeenCalledWith({
      reported_id: 'user-123',
      reason_category: 'spam',
      description: 'test details',
    });
    expect(closedSpy).toHaveBeenCalled();
  });

  it('should call safetyService.blockUserAsync and emit closed on block', async () => {
    // Switch to block mode
    component.mode.set('block');
    fixture.detectChanges();

    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    await component.confirmBlock();

    expect(safetyServiceMock.blockUserAsync).toHaveBeenCalledWith('user-123');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('should close on backdrop click', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.click();

    expect(closedSpy).toHaveBeenCalled();
  });

  it('should close on Escape keydown', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    backdrop.dispatchEvent(escapeEvent);

    expect(closedSpy).toHaveBeenCalled();
  });

  it('should not close when clicking inside the dialog', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    dialog.click();

    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('should disable submit buttons while submitting', () => {
    component.isSubmitting.set(true);
    fixture.detectChanges();

    const actionButtons = fixture.nativeElement.querySelectorAll('[disabled]');
    expect(actionButtons.length).toBeGreaterThan(0);
  });
});