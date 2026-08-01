import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: jasmine.createSpy('translate').and.callFake((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
      ],
      declarations: [TranslatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the exact location visibility', () => {
    const initialVisibility = component.isExactLocationVisible();
    component.toggleExactLocationVisibility();
    expect(component.isExactLocationVisible()).toBe(!initialVisibility);
  });

  it('should display the correct translation key for the toggle label', () => {
    const toggleLabel = fixture.nativeElement.querySelector('.toggle-label');
    expect(toggleLabel.textContent.trim()).toBe('settings.toggleExactLocation');
  });
});
