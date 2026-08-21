import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { NotificationSettingsComponent } from './notification-settings.component';
import { NotificationPreferencesService } from '../../../services/notification-preferences.service';
import { I18nService } from '../../../services/i18n.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

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

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load legacy preferences on init', async () => {
    await fixture.whenStable();
    expect(getLegacyPrefsSpy).toHaveBeenCalled();
    expect(component.prefs()).toEqual(mockLegacyPrefs);
  });

  it('should return correct toggle value for a category and channel', async () => {
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

  it('should toggle a channel and call updateLegacyPreferences', async () => {
    await fixture.whenStable();
    const updatedPrefs = {
      ...mockLegacyPrefs,
      direct_messages: { push: false, badge: true },
    };
    updateLegacyPrefsSpy.mockResolvedValue({
      success: true,
      preferences: updatedPrefs,
    });

    await component.toggle('direct_messages', 'push');
    expect(updateLegacyPrefsSpy).toHaveBeenCalledWith({
      direct_messages: { push: false, badge: true },
    });
    expect(component.prefs()!.direct_messages.push).toBe(false);
    expect(component.saved()).toBe(true);
  });

  it('should display load error when getLegacyPreferences fails', async () => {
    getLegacyPrefsSpy.mockRejectedValue(new Error('Network error'));

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.loadError()).toBeTruthy();
  });

  it('should return correct channel label', () => {
    expect(component.channelLabel('push')).toBe('notification_settings.channel.push');
    expect(component.channelLabel('badge')).toBe('notification_settings.channel.badge');
  });

  it('should render all four category rows', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('[role="switch"]');
    expect(rows.length).toBe(8); // 4 categories * 2 channels
  });
});
