import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationSettingsComponent } from './notification-settings.component';

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 setting rows', () => {
    expect(component.rows.length).toBe(4);
  });

  it('should start in loading state', () => {
    expect(component.loading()).toBe(true);
  });

  it('should have push enabled return false when prefs not loaded', () => {
    expect(component.pushEnabled('direct_messages')).toBe(false);
    expect(component.pushEnabled('groups')).toBe(false);
    expect(component.pushEnabled('likes')).toBe(false);
    expect(component.pushEnabled('voice_rooms')).toBe(false);
  });

  it('should have badges enabled return false when prefs not loaded', () => {
    expect(component.badgesEnabled('direct_messages')).toBe(false);
    expect(component.badgesEnabled('groups')).toBe(false);
    expect(component.badgesEnabled('likes')).toBe(false);
    expect(component.badgesEnabled('voice_rooms')).toBe(false);
  });

  it('should return label key for each row', () => {
    for (const row of component.rows) {
      const key = component.rowLabelKey(row);
      expect(key).toBe(row.labelKey);
    }
  });
});
