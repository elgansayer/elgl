import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe('PrivacySettingsComponent', () => {
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

  it('should render the hub title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('privacy.hub.title');
  });

  it('should have navigation items', () => {
    expect(component.hubNavItems.length).toBeGreaterThan(0);
    expect(component.hubNavItems[0].route).toBeTruthy();
  });

  it('should have muted word input initially empty', () => {
    expect(component.mutedWordInput()).toBe('');
  });

  it('should provide muted words from safety service', () => {
    expect(component.mutedWords).toBeDefined();
    expect(Array.isArray(component.mutedWords())).toBe(true);
  });

  it('should render hub navigation links', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('a[href]');
    expect(links.length).toBeGreaterThan(0);
  });

  it('should render muted words input', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
  });
});
