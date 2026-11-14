import { TestBed } from '@angular/core/testing';
import { SocialLoginButtonsComponent } from './social-login-buttons.component';
import { I18nService } from '../../services/i18n.service';

describe('SocialLoginButtonsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialLoginButtonsComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  it('emits the Google provider', () => {
    const fixture = TestBed.createComponent(SocialLoginButtonsComponent);
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.loginProvider.subscribe((provider: string) =>
      emitted.push(provider),
    );

    const googleButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('auth.login_google'),
    ) as HTMLButtonElement | undefined;

    expect(googleButton).toBeDefined();
    googleButton?.click();

    expect(emitted).toEqual(['google']);
  });

  it('emits the Apple provider', () => {
    const fixture = TestBed.createComponent(SocialLoginButtonsComponent);
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.loginProvider.subscribe((provider: string) =>
      emitted.push(provider),
    );

    const appleButton = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('auth.login_apple'),
    ) as HTMLButtonElement | undefined;

    expect(appleButton).toBeDefined();
    appleButton?.click();

    expect(emitted).toEqual(['apple']);
  });

  it('keeps provider icons decorative and buttons labelled by text', () => {
    const fixture = TestBed.createComponent(SocialLoginButtonsComponent);
    fixture.detectChanges();

    for (const svg of fixture.nativeElement.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    for (const button of fixture.nativeElement.querySelectorAll('button')) {
      expect((button as HTMLButtonElement).textContent?.trim()).not.toBe('');
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});
