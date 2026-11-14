import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationPreferences,
  NotificationPreferencesService,
} from '../../services/notification-preferences.service';
import { NotificationPreferencesComponent } from './notification-preferences.component';

const channel = { push: true, email: false, in_app: true, badges: true };

describe('NotificationPreferencesComponent', () => {
  let component: NotificationPreferencesComponent;
  let fixture: ComponentFixture<NotificationPreferencesComponent>;
  let service: {
    getPreferences: ReturnType<typeof vi.fn>;
    toggleCategoryChannel: ReturnType<typeof vi.fn>;
    toggleDoNotDisturb: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
  };

  const preferences: NotificationPreferences = {
    userId: 'user-1',
    new_message: channel,
    call_invite: channel,
    moment_like: { ...channel, push: false },
    moment_comment: channel,
    correction: channel,
    gift: channel,
    profile_view: { ...channel, push: false },
    study_reminder: { ...channel, email: true },
    friend_request: channel,
    audio_room_invite: channel,
    new_follower: channel,
    do_not_disturb: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    quiet_hours_timezone: 'Europe/London',
    updatedAt: '2026-11-14T00:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      getPreferences: vi.fn().mockResolvedValue(preferences),
      toggleCategoryChannel: vi.fn().mockResolvedValue(preferences),
      toggleDoNotDisturb: vi.fn().mockResolvedValue(preferences),
      resetToDefaults: vi.fn().mockResolvedValue(preferences),
      updatePreferences: vi.fn().mockResolvedValue(preferences),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationPreferencesComponent],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        {
          provide: I18nService,
          useValue: { translate: vi.fn((key: string) => key) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('reads every rich channel for a category', () => {
    expect(component.channels).toEqual(['push', 'email', 'in_app', 'badges']);
    expect(component.channelEnabled('new_message', 'push')).toBe(true);
    expect(component.channelEnabled('new_message', 'email')).toBe(false);
    expect(component.channelEnabled('new_message', 'in_app')).toBe(true);
    expect(component.channelEnabled('new_message', 'badges')).toBe(true);
    expect(component.channelEnabled('moment_like', 'push')).toBe(false);
  });

  it('renders all eleven event categories', () => {
    expect(component.categories()).toHaveLength(11);
    expect(component.categories()).toContain('moment_like');
    expect(component.categories()).toContain('audio_room_invite');
  });

  it('updates one channel through the rich preferences service', async () => {
    const updated = {
      ...preferences,
      new_message: { ...channel, badges: false },
    };
    service.toggleCategoryChannel.mockResolvedValue(updated);

    component.toggle('new_message', 'badges');
    await fixture.whenStable();

    expect(service.toggleCategoryChannel).toHaveBeenCalledWith(
      'new_message',
      'badges',
      false,
      preferences,
    );
    expect(component.channelEnabled('new_message', 'badges')).toBe(false);
  });

  it('persists edited quiet hours with the DND schedule', async () => {
    const updated = {
      ...preferences,
      do_not_disturb: true,
      quiet_hours_start: '23:15',
      quiet_hours_end: '06:45',
    };
    service.updatePreferences.mockResolvedValue(updated);
    component.doNotDisturb.set(true);
    component.quietStart.set('23:15');
    component.quietEnd.set('06:45');

    component.save();
    await fixture.whenStable();

    expect(service.updatePreferences).toHaveBeenCalledWith({
      do_not_disturb: true,
      quiet_hours_start: '23:15',
      quiet_hours_end: '06:45',
    });
    expect(component.doNotDisturb()).toBe(true);
  });

  it('resets through the dedicated reset action', async () => {
    component.reset();
    await fixture.whenStable();

    expect(service.resetToDefaults).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping preference mutations', async () => {
    let resolveUpdate!: (value: NotificationPreferences) => void;
    const pending = new Promise<NotificationPreferences>((resolve) => {
      resolveUpdate = resolve;
    });
    service.updatePreferences.mockReturnValue(pending);

    component.save();
    component.save();

    expect(component.mutationPending()).toBe(true);
    expect(service.updatePreferences).toHaveBeenCalledTimes(1);

    resolveUpdate(preferences);
    await fixture.whenStable();

    expect(component.mutationPending()).toBe(false);
  });

  it('surfaces load failures without inventing defaults', async () => {
    service.getPreferences.mockRejectedValue(new Error('unavailable'));

    component['prefsResource'].reload();
    await fixture.whenStable();

    expect(component.error()).toBe('common.error_generic');
    expect(component.channels).toHaveLength(4);
  });
});
