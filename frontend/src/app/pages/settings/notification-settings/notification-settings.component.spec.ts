import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { vi } from 'vitest';
import { NotificationSettingsComponent } from './notification-settings.component';
import { NotificationPreferencesService } from '../../../services/notification-preferences.service';
import { I18nService } from '../../../services/i18n.service';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let getLegacyPrefsSpy: ReturnType<typeof vi.fn>;
  let updateLegacyPrefsSpy: ReturnType<typeof vi.fn>;

  const mockLegacyPrefs = {
    userId: 'user-1',
    direct_messages: { push: true, badge: true },
    groups: { push: true, badge: false },
    likes: { push: false, badge: true },
    voice_rooms: { push: false, badge: false },
    do_not_disturb: false,
    updatedAt: new Date().toISOString(),
  };

  const mockI18nService = {
    translate: vi.fn((key: string) => key),
    currentLang: signal('en-GB'),
    direction: signal('ltr'),
  };

  beforeEach(async () => {
    getLegacyPrefsSpy = vi.fn().mockResolvedValue(mockLegacyPrefs);
    updateLegacyPrefsSpy = vi.fn().mockResolvedValue({
      success: true,
      preferences: mockLegacyPrefs,
    });

    await TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent],
      providers: [
        {
          provide: NotificationPreferencesService,
          useValue: {
            getLegacyPreferences: getLegacyPrefsSpy,
            updateLegacyPreferences: updateLegacyPrefsSpy,
            getPreferences: vi.fn(),
            updatePreferences: vi.fn(),
          },
        },
        { provide: I18nService, useValue: mockI18nService },
      ],
    })
      .overrideComponent(NotificationSettingsComponent, {
        remove: { imports: [] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads preferences on init', async () => {
    await fixture.whenStable();
    expect(getLegacyPrefsSpy).toHaveBeenCalled();
    expect(component.prefs()).toEqual(mockLegacyPrefs);
  });

  it('returns the persisted toggle value for every category and channel', async () => {
    await fixture.whenStable();
    expect(component.toggleValue('direct_messages', 'push')).toBe(true);
    expect(component.toggleValue('direct_messages', 'badge')).toBe(true);
    expect(component.toggleValue('groups', 'push')).toBe(true);
    expect(component.toggleValue('groups', 'badge')).toBe(false);
    expect(component.toggleValue('likes', 'push')).toBe(false);
    expect(component.toggleValue('likes', 'badge')).toBe(true);
    expect(component.toggleValue('voice_rooms', 'push')).toBe(false);
    expect(component.toggleValue('voice_rooms', 'badge')).toBe(false);
  });

  it('persists one complete category without optimistically mutating local state', async () => {
    await fixture.whenStable();
    const updatedPrefs = {
      ...mockLegacyPrefs,
      direct_messages: { push: false, badge: true },
    };
    updateLegacyPrefsSpy.mockResolvedValue({
      success: true,
      preferences: updatedPrefs,
    });

    const promise = component.toggle('direct_messages', 'push');
    expect(component.prefs()!.direct_messages.push).toBe(true);
    await promise;

    expect(updateLegacyPrefsSpy).toHaveBeenCalledWith({
      direct_messages: { push: false, badge: true },
    });
    expect(component.prefs()!.direct_messages.push).toBe(false);
    expect(component.saved()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('serializes rapid toggle mutations to prevent conflicting writes', async () => {
    await fixture.whenStable();

    let resolveUpdate!: (value: { success: boolean; preferences: typeof mockLegacyPrefs }) => void;
    const deferred = new Promise<{ success: boolean; preferences: typeof mockLegacyPrefs }>(
      (resolve) => {
        resolveUpdate = resolve;
      },
    );
    updateLegacyPrefsSpy.mockReturnValue(deferred);

    const first = component.toggle('groups', 'badge');
    const second = component.toggle('likes', 'push');

    expect(component.pendingToggle()).toBe('groups:badge');
    expect(updateLegacyPrefsSpy).toHaveBeenCalledTimes(1);

    resolveUpdate({ success: true, preferences: mockLegacyPrefs });
    await first;
    await second;
    expect(component.pendingToggle()).toBeNull();
  });

  it('retains server-confirmed preferences when a save fails so the action is retryable', async () => {
    await fixture.whenStable();
    updateLegacyPrefsSpy.mockRejectedValue(new Error('Network error'));

    await component.toggle('likes', 'push');

    expect(component.prefs()).toEqual(mockLegacyPrefs);
    expect(component.saved()).toBe(false);
    expect(component.error()).toBe('common.error_generic');
    expect(component.pendingToggle()).toBeNull();
  });

  it('clears private preference state and exposes retry when loading fails', async () => {
    getLegacyPrefsSpy.mockRejectedValue(new Error('Network error'));

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.prefs()).toBeNull();
    expect(component.loadError()).toBe('common.error_generic');

    getLegacyPrefsSpy.mockResolvedValue(mockLegacyPrefs);
    component.reload();
    await fixture.whenStable();

    expect(getLegacyPrefsSpy).toHaveBeenCalledTimes(2);
    expect(component.prefs()).toEqual(mockLegacyPrefs);
    expect(component.loadError()).toBeNull();
  });

  it('returns the localized channel keys', () => {
    expect(component.channelLabel('push')).toBe('notification_settings.channel.push');
    expect(component.channelLabel('badge')).toBe('notification_settings.channel.badge');
  });

  it('renders all four category rows with accessible push and badge switches', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const switches = element.querySelectorAll('[role="switch"]');

    expect(switches.length).toBe(8);
    for (const control of Array.from(switches)) {
      expect(control.getAttribute('aria-label')).toBeTruthy();
      expect(control.getAttribute('aria-checked')).toMatch(/true|false/);
    }
  });
});
