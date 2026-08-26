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
    toggleCategoryChannel: ReturnType<typeof vi.fn>;
    toggleDoNotDisturb: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
  };

  const preferences: NotificationPreferences = {
    userId: 'user-1',
    direct_messages: { push: true, badge: true, email: false, in_app: true, badges: false },
    groups: { push: true, badge: true, email: false, in_app: true, badges: false },
    likes: { push: true, badge: true, email: false, in_app: true, badges: false },
    voice_rooms: { push: true, badge: true, email: false, in_app: true, badges: false },
    new_message: { push: true, badge: false },
    call_invite: { push: true, badge: true },
    moment_like: { push: false, badge: true },
    moment_comment: { push: true, badge: false },
    correction: { push: true, badge: true },
    gift: { push: true, badge: true },
    profile_view: { push: false, badge: true },
    study_reminder: { push: true, badge: false },
    friend_request: { push: true, badge: true },
    audio_room_invite: { push: true, badge: false },
    new_follower: { push: false, badge: true },
    do_not_disturb: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    updatedAt: '2026-08-18T00:00:00.000Z',
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
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('reads category channels without unsafe preference casts', () => {
    expect(component.channelEnabled('direct_messages', 'push')).toBe(true);
    expect(component.channelEnabled('new_message', 'push')).toBe(true);
    expect(component.channelEnabled('new_message', 'badge')).toBe(false);
    expect(component.channelEnabled('moment_like', 'push')).toBe(false);
    expect(component.channelEnabled('moment_like', 'badge')).toBe(true);
  });

  it('updates the selected category through the preferences service', async () => {
    const updated = {
      ...preferences,
      new_message: { push: true, badge: true },
    };
    service.toggleCategoryChannel.mockResolvedValue(updated);

    component.toggle('new_message', 'badge');
    await fixture.whenStable();

    expect(service.toggleCategoryChannel).toHaveBeenCalledWith(
      'new_message',
      'badge',
      true,
      preferences,
    );
    expect(component.channelEnabled('new_message', 'badge')).toBe(true);
  });

  it('persists edited quiet hours when saving the DND schedule', async () => {
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
    expect(component.quietStart()).toBe('23:15');
    expect(component.quietEnd()).toBe('06:45');
  });
});
