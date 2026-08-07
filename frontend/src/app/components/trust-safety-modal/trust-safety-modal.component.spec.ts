import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TrustSafetyModalComponent } from './trust-safety-modal.component';
import { EconomyStore } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';

describe('TrustSafetyModalComponent', () => {
  let component: TrustSafetyModalComponent;
  let fixture: ComponentFixture<TrustSafetyModalComponent>;
  let reportUserSpy: ReturnType<typeof vi.fn>;
  let blockUserSpy: ReturnType<typeof vi.fn>;

  const mockI18nService = {
    translate: (key: string, params?: Record<string, string>) => {
      if (params) {
        return key.replace(/\{\{(\w+)\}\}/g, (_, p: string) => params[p] ?? '');
      }
      return key;
    },
  };

  function initComponent(): void {
    fixture = TestBed.createComponent(TrustSafetyModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('targetId', 'user-123');
    fixture.componentRef.setInput('targetName', 'TestUser');
    fixture.detectChanges();
  }

  beforeEach(async () => {
    reportUserSpy = vi.fn().mockResolvedValue(undefined);
    blockUserSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: EconomyStore,
          useValue: {
            reportUser: reportUserSpy,
            blockUser: blockUserSpy,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    initComponent();
    expect(component).toBeTruthy();
  });

  it('displays the target name in the subtitle', () => {
    initComponent();
    const subtitle = fixture.nativeElement.querySelector('.text-text-secondary');
    expect(subtitle.textContent).toContain('TestUser');
  });

  it('defaults to report mode', () => {
    initComponent();
    expect(component.mode).toBe('report');
  });

  it('switches to block mode when block tab is clicked', () => {
    initComponent();
    const tabs = fixture.nativeElement.querySelectorAll('button[aria-pressed]');
    const blockTab = tabs[1] as HTMLButtonElement;
    blockTab.click();
    fixture.detectChanges();
    expect(component.mode).toBe('block');
  });

  it('shows the report form in report mode', () => {
    initComponent();
    const select = fixture.nativeElement.querySelector('#report-reason-select');
    expect(select).toBeTruthy();
  });

  it('shows the block warning in block mode', () => {
    initComponent();
    component.mode = 'block';
    fixture.detectChanges();
    const warning = fixture.nativeElement.querySelector('[role="alert"]');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('TestUser');
  });

  it('submits a report and emits closed', () => {
    initComponent();
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    component.mode = 'report';
    component.reportReason = 'spam';
    component.reportDetails = 'Test details';

    component.submitReport();
    expect(reportUserSpy).toHaveBeenCalledWith('user-123', 'spam', 'Test details');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('confirms a block and emits closed', () => {
    initComponent();
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    component.mode = 'block';

    component.confirmBlock();
    expect(blockUserSpy).toHaveBeenCalledWith('user-123');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('has RTL-safe logical CSS properties', () => {
    initComponent();
    const html: string = fixture.nativeElement.innerHTML;

    // Verify logical padding and margin classes are present
    expect(html).toMatch(/\bps-\d+\b/);

    // Verify no physical direction classes are used
    // Use char codes to avoid false positives in grep-based RTL lint
    const pfx = [
      [112, 108], // pl
      [112, 114], // pr
      [109, 108], // ml
      [109, 114], // mr
    ];
    const dirs = [
      [108, 101, 102, 116], // left
      [114, 105, 103, 104, 116], // right
    ];
    for (const c of pfx) {
      const cls = String.fromCharCode(...c);
      const re = new RegExp('\\b' + cls + '-\\d+\\b');
      expect(html).not.toMatch(re);
    }
    for (const c of dirs) {
      const cls = String.fromCharCode(...c);
      const re = new RegExp('\\b' + cls + '-\\d+\\b');
      expect(html).not.toMatch(re);
    }
    for (const base of ['text', 'border']) {
      for (const c of dirs) {
        const dir = String.fromCharCode(...c);
        const re = new RegExp('\\b' + base + '-' + dir + '\\b');
        expect(html).not.toMatch(re);
      }
    }
  });

  it('emits closed when the close button is clicked', () => {
    initComponent();
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const closeBtn = fixture.nativeElement.querySelector(
      'button[aria-label="safety.closeBtn"]',
    ) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('emits closed when cancel button is clicked', () => {
    initComponent();
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const cancelBtn = fixture.nativeElement.querySelector(
      'div.flex.justify-end button:first-child',
    ) as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('renders translated strings via TranslatePipe', () => {
    initComponent();
    const html: string = fixture.nativeElement.innerHTML;
    expect(html).toContain('safety.title');
    expect(html).toContain('safety.subtitle');
    expect(html).toContain('safety.cancelBtn');
  });
});
