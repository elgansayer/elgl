import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationPreferences,
  NotificationPreferencesService,
} from '../../services/notification-preferences.service';
import { NotificationPreferencesComponent } from './notification-preferences.component';

describe('NotificationPreferencesComponent', () => {
  let component: NotificationPreferencesComponent;
  let fixture: ComponentFixture<NotificationPreferencesComponent>;
  let service: {
    getPreferences: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
  };

  const category = (overrides: Partial<NotificationPreferences['new_message']> = {}) => ({
    push: true,
    email: false,
    in_app: true,
    badges: true,
    ...overrides,
  });

  const preferences: NotificationPreferences = {
    userId: 'user-1',
    new_message: category(),
    call_invite: category(),
    moment_like: category({ push: false }),
    moment_comment: category(),
    correction: category(),
    gift: category(),
    profile_view: category({ push: false }),
    study_reminder: category({ email: true }),
    friend_request: category(),
    audio_room_invite: category(),
    new_follower: category(),
    do_not_disturb: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    quiet_hours_timezone: 'Europe/London',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      getPreferences: vi.fn().mockResolvedValue(preferences),
      resetToDefaults: vi.fn().mockResolvedValue(preferences),
      updatePreferences: vi.fn().mockResolvedValue(preferences),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationPreferencesComponent],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('reads the canonical backend channels without the legacy badge contract', () => {
    expect(component.channelEnabled('new_message', 'push')).toBe(true);
    expect(component.channelEnabled('new_message', 'email')).toBe(false);
    expect(component.channelEnabled('new_message', 'in_app')).toBe(true);
    expect(component.channelEnabled('new_message', 'badges')).toBe(true);
    expect(component.channelEnabled('moment_like', 'push')).toBe(false);
  });

  it('keeps edits local until Save and persists the canonical channel', async () => {
    component.toggle('new_message', 'email');

    expect(component.dirty()).toBe(true);
    expect(component.channelEnabled('new_message', 'email')).toBe(true);
    expect(service.updatePreferences).not.toHaveBeenCalled();

    await component.save();

    expect(service.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        new_message: expect.objectContaining({ email: true }),
      }),
    );
  });

  it('persists edited quiet hours without requiring a DND toggle', async () => {
    const startInput = fixture.nativeElement.querySelector(
      '#quiet-hours-start',
    ) as HTMLInputElement;
    const endInput = fixture.nativeElement.querySelector('#quiet-hours-end') as HTMLInputElement;

    startInput.value = '21:30';
    startInput.dispatchEvent(new Event('input'));
    endInput.value = '06:45';
    endInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await component.save();

    expect(service.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        do_not_disturb: false,
        quiet_hours_start: '21:30',
        quiet_hours_end: '06:45',
        quiet_hours_timezone: expect.any(String),
      }),
    );
  });

  it('persists manual DND independently from scheduled quiet hours', async () => {
    component.toggleDnd();
    await component.save();

    expect(service.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        do_not_disturb: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
      }),
    );
  });

  it('rejects an unpaired quiet-hours edit before making a request', async () => {
    const endInput = fixture.nativeElement.querySelector('#quiet-hours-end') as HTMLInputElement;
    endInput.value = '';
    endInput.dispatchEvent(new Event('input'));

    await component.save();

    expect(component.actionError()).toBe(true);
    expect(service.updatePreferences).not.toHaveBeenCalled();
  });

  it('prevents duplicate submissions while a save is in flight', async () => {
    let resolveSave!: (value: NotificationPreferences) => void;
    service.updatePreferences.mockReturnValue(
      new Promise<NotificationPreferences>((resolve) => {
        resolveSave = resolve;
      }),
    );
    component.toggleDnd();

    const firstSave = component.save();
    const secondSave = component.save();

    expect(service.updatePreferences).toHaveBeenCalledTimes(1);
    resolveSave(preferences);
    await Promise.all([firstSave, secondSave]);
  });

  it('uses the server reset endpoint and clears pending edits', async () => {
    component.toggleDnd();
    expect(component.dirty()).toBe(true);

    await component.reset();

    expect(service.resetToDefaults).toHaveBeenCalledTimes(1);
    expect(component.dirty()).toBe(false);
    expect(component.statusMessage()).toBe('notification_settings.saved_message');
  });

  it('surfaces save failures without discarding unsaved edits', async () => {
    service.updatePreferences.mockRejectedValue(new Error('offline'));
    component.toggleDnd();

    await component.save();

    expect(component.actionError()).toBe(true);
    expect(component.dirty()).toBe(true);
  });

  it('preserves unsaved quiet hours while editing a category', () => {
    component.quietStart.set('23:15');
    component.quietEnd.set('06:45');

    component.toggle('new_message', 'email');

    expect(component.quietStart()).toBe('23:15');
    expect(component.quietEnd()).toBe('06:45');
    expect(component.channelEnabled('new_message', 'email')).toBe(true);
    expect(component.dirty()).toBe(true);
  });
});
