import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationSettingsComponent } from './notification-settings.component';
import { NotificationPreferencesService } from '../../../services/notification-preferences.service';
import { I18nService } from '../../../services/i18n.service';


describe('NotificationSettingsComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let component: NotificationSettingsComponent;
  let prefsService: jasmine.SpyObj<NotificationPreferencesService>;

  const mockPreferences = {
    userId: 'user-1',
    new_message: { push: true, email: false, in_app: true, badges: true },
    call_invite: { push: true, email: false, in_app: true, badges: false },
    moment_like: { push: false, email: false, in_app: true, badges: true },
    moment_comment: { push: true, email: false, in_app: true, badges: true },
    correction: { push: true, email: false, in_app: true, badges: true },
    gift: { push: true, email: false, in_app: true, badges: true },
    profile_view: { push: false, email: false, in_app: true, badges: false },
    study_reminder: { push: true, email: true, in_app: true, badges: true },
    friend_request: { push: true, email: false, in_app: true, badges: true },
    audio_room_invite: { push: true, email: false, in_app: true, badges: true },
    new_follower: { push: true, email: false, in_app: true, badges: false },
    do_not_disturb: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    prefsService = jasmine.createSpyObj<NotificationPreferencesService>(
      'NotificationPreferencesService',
      ['getPreferences', 'updatePreferences'],
    );
    prefsService.getPreferences.and.resolveTo(mockPreferences);
    prefsService.updatePreferences.and.callFake(
      (dto: Partial<typeof mockPreferences>) =>
        Promise.resolve({ ...mockPreferences, ...dto, updatedAt: new Date().toISOString() }),
    );

    await TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationPreferencesService, useValue: prefsService },
        {
          provide: I18nService,
          useValue: jasmine.createSpyObj('I18nService', ['translate']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load preferences on init', () => {
    expect(prefsService.getPreferences).toHaveBeenCalled();
    expect(component.settings().length).toBe(4);
  });

  it('should toggle push for an item', () => {
    const item = component.settings()[0];
    const initialPush = item.push;
    component.togglePush(item);
    expect(item.push).toBe(!initialPush);
  });

  it('should toggle badges for an item', () => {
    const item = component.settings()[0];
    const initialBadges = item.badges;
    component.toggleBadges(item);
    expect(item.badges).toBe(!initialBadges);
  });

  it('should save preferences', async () => {
    const item = component.settings()[0];
    component.togglePush(item);
    await component.savePreferences();
    expect(prefsService.updatePreferences).toHaveBeenCalled();
    expect(component.saved()).toBe(true);
  });

  it('should handle save error gracefully', async () => {
    prefsService.updatePreferences.and.rejectWith(new Error('Failed'));
    await component.savePreferences();
    expect(component.error()).toBeTruthy();
  });

  it('should load preferences on error gracefully', async () => {
    prefsService.getPreferences.and.rejectWith(new Error('Failed'));
    const fixture2 = TestBed.createComponent(NotificationSettingsComponent);
    const comp2 = fixture2.componentInstance;
    fixture2.detectChanges();
    expect(comp2.error()).toBeTruthy();
  });
});
