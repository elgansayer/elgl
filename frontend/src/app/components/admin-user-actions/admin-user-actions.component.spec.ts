import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AdminUserActionsComponent } from './admin-user-actions.component';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { toastsSignal } from '../../services/toast.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('AdminUserActionsComponent', () => {
  let component: AdminUserActionsComponent;
  let fixture: ComponentFixture<AdminUserActionsComponent>;
  let mockAdminService: {
    banUser: ReturnType<typeof vi.fn>;
    warnUser: ReturnType<typeof vi.fn>;
  };
  let mockI18n: {
    translate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    toastsSignal.set([]);

    mockAdminService = {
      banUser: vi.fn().mockResolvedValue({ message: 'User banned' }),
      warnUser: vi.fn().mockResolvedValue({ message: 'Warning issued' }),
    };

    mockI18n = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUserActionsComponent],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: I18nService, useValue: mockI18n },
      ],
    })
      .overrideComponent(AdminUserActionsComponent, {
        set: { imports: [HlmButton, MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminUserActionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'target-user-123');
    fixture.detectChanges();
  });

  afterEach(() => {
    toastsSignal.set([]);
  });

  it('renders Ban and Warn buttons with translation keys and Relay tokens', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(compiled.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);

    const [banBtn, warnBtn] = buttons;
    expect(banBtn.textContent?.trim()).toBe('admin.banBtn');
    expect(warnBtn.textContent?.trim()).toBe('admin.warnBtn');

    expect(banBtn.classList.contains('bg-danger')).toBe(true);
    expect(banBtn.classList.contains('text-on-fill')).toBe(true);
    expect(banBtn.classList.contains('btn-danger')).toBe(false);

    expect(warnBtn.classList.contains('bg-warning')).toBe(true);
    expect(warnBtn.classList.contains('text-on-fill')).toBe(true);
    expect(warnBtn.classList.contains('btn-warning')).toBe(false);

    expect(banBtn.classList.contains('min-h-11')).toBe(true);
    expect(warnBtn.classList.contains('min-h-11')).toBe(true);
  });

  it('handles ban successfully and updates feedback state', async () => {
    const emitted: string[] = [];
    component.userBanned.subscribe((id) => emitted.push(id));

    const banBtn = fixture.nativeElement.querySelectorAll('button')[0] as HTMLButtonElement;
    banBtn.click();
    fixture.detectChanges();

    expect(component.isBanning()).toBe(true);
    expect(component.isBusy()).toBe(true);
    expect(banBtn.getAttribute('aria-busy')).toBe('true');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockAdminService.banUser).toHaveBeenCalledWith('target-user-123');
    expect(component.isBanning()).toBe(false);
    expect(component.isBusy()).toBe(false);
    expect(component.feedback()).toEqual({ type: 'success', messageKey: 'admin.userBanned' });
    expect(emitted).toEqual(['target-user-123']);

    const feedbackEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(feedbackEl).toBeTruthy();
    expect(feedbackEl?.textContent?.trim()).toBe('admin.userBanned');
    expect(feedbackEl?.classList.contains('text-success')).toBe(true);
  });

  it('handles ban error and shows error feedback', async () => {
    mockAdminService.banUser.mockRejectedValue(new Error('Ban error'));

    const banBtn = fixture.nativeElement.querySelectorAll('button')[0] as HTMLButtonElement;
    banBtn.click();
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.isBanning()).toBe(false);
    expect(component.feedback()).toEqual({ type: 'error', messageKey: 'admin.banFailed' });

    const feedbackEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(feedbackEl?.textContent?.trim()).toBe('admin.banFailed');
    expect(feedbackEl?.classList.contains('text-danger-ink')).toBe(true);
  });

  it('handles warn successfully and updates feedback state', async () => {
    const emitted: string[] = [];
    component.userWarned.subscribe((id) => emitted.push(id));

    const warnBtn = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    warnBtn.click();
    fixture.detectChanges();

    expect(component.isWarning()).toBe(true);
    expect(component.isBusy()).toBe(true);
    expect(warnBtn.getAttribute('aria-busy')).toBe('true');

    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockAdminService.warnUser).toHaveBeenCalledWith('target-user-123');
    expect(component.isWarning()).toBe(false);
    expect(component.isBusy()).toBe(false);
    expect(component.feedback()).toEqual({ type: 'success', messageKey: 'admin.warningIssued' });
    expect(emitted).toEqual(['target-user-123']);

    const feedbackEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(feedbackEl).toBeTruthy();
    expect(feedbackEl?.textContent?.trim()).toBe('admin.warningIssued');
    expect(feedbackEl?.classList.contains('text-success')).toBe(true);
  });

  it('handles warn error and shows error feedback', async () => {
    mockAdminService.warnUser.mockRejectedValue(new Error('Warn error'));

    const warnBtn = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    warnBtn.click();
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.isWarning()).toBe(false);
    expect(component.feedback()).toEqual({ type: 'error', messageKey: 'admin.warningFailed' });

    const feedbackEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(feedbackEl?.textContent?.trim()).toBe('admin.warningFailed');
    expect(feedbackEl?.classList.contains('text-danger-ink')).toBe(true);
  });
});
