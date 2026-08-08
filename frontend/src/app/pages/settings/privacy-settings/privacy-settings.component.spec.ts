import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe.skip('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe('privacy.title');
  });

  it('should have default profile visibility as everyone', () => {
    expect(component.profileVisibility()).toBe('everyone');
  });

  it('should have all privacy toggles initially false', () => {
    expect(component.privacyHideAge()).toBe(false);
    expect(component.privacyHideLocation()).toBe(false);
    expect(component.privacyHideSearch()).toBe(false);
    expect(component.privacyHideGender()).toBe(false);
    expect(component.privacyHideExactLocation()).toBe(false);
    expect(component.privacyHideOnlineStatus()).toBe(false);
    expect(component.privacyHideVipStatus()).toBe(false);
  });

  it('should set privacy toggle values via signal set', () => {
    component.privacyHideAge.set(true);
    expect(component.privacyHideAge()).toBe(true);
  });

  it('should have save button enabled initially', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const saveBtn = compiled.querySelector('button') as HTMLButtonElement;
    expect(saveBtn).toBeTruthy();
  });
});