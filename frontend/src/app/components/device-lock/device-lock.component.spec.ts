import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppLockService } from '../../services/app-lock.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { DeviceLockComponent } from './device-lock.component';

class MockI18nService {
  translations: Record<string, string> = {};

  translate(key: string): string {
    return this.translations[key] ?? key;
  }
}

class MockAppLockService {
  unlock = vi.fn().mockResolvedValue(false);
}

describe('DeviceLockComponent', () => {
  let component: DeviceLockComponent;
  let fixture: ComponentFixture<DeviceLockComponent>;
  let appLockService: MockAppLockService;
  let i18n: MockI18nService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    appLockService = new MockAppLockService();
    i18n = new MockI18nService();
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DeviceLockComponent, TranslatePipe],
      providers: [
        { provide: AppLockService, useValue: appLockService },
        { provide: I18nService, useValue: i18n },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceLockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  it('uses the native Spartan touch button without custom keyboard semantics', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('size')).toBe('touch');
    expect(button.getAttribute('aria-describedby')).toBe('device-lock-status');
    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(button.hasAttribute('role')).toBe(false);
    expect(button.onkeydown).toBeNull();
  });

  it('uses Relay semantic surface and text roles instead of dark-only colours', () => {
    const shell: HTMLDivElement = fixture.nativeElement.querySelector('div');
    const heading: HTMLHeadingElement = fixture.nativeElement.querySelector('h1');
    const message: HTMLParagraphElement = fixture.nativeElement.querySelector('p');

    expect(shell.classList).toContain('bg-surface-500');
    expect(shell.classList).toContain('text-text-primary');
    expect(shell.classList).not.toContain('bg-surface-900');
    expect(shell.classList).not.toContain('text-white');
    expect(heading.classList).toContain('text-text-primary');
    expect(message.classList).toContain('text-text-secondary');
    expect(message.classList).not.toContain('text-white/60');
  });

  it('uses mobile-first reflow and keeps long content reachable at high zoom', () => {
    const shell: HTMLDivElement = fixture.nativeElement.querySelector('div');
    const content: HTMLDivElement = shell.querySelector('div')!;
    const heading: HTMLHeadingElement = fixture.nativeElement.querySelector('h1');
    const message: HTMLParagraphElement = fixture.nativeElement.querySelector('p');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(shell.classList).toContain('min-h-full');
    expect(shell.classList).toContain('p-4');
    expect(shell.classList).toContain('sm:p-6');
    expect(shell.classList).not.toContain('overflow-hidden');
    expect(content.classList).toContain('w-full');
    expect(content.classList).toContain('max-w-sm');
    expect(heading.classList).toContain('break-words');
    expect(message.classList).toContain('break-words');
    expect(button.classList).toContain('w-full');
    expect(button.classList).toContain('max-w-full');
    expect(button.classList).toContain('whitespace-normal');
    expect(button.classList).toContain('break-words');
    expect(button.classList).toContain('sm:w-auto');
  });

  it('prevents duplicate unlock attempts and exposes the pending state', async () => {
    let resolveUnlock: ((value: boolean) => void) | undefined;
    appLockService.unlock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveUnlock = resolve;
        }),
    );

    const firstAttempt = component.unlock();
    const duplicateAttempt = component.unlock();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(appLockService.unlock).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    if (!resolveUnlock) throw new Error('Unlock resolver was not initialised');
    resolveUnlock(false);
    await Promise.all([firstAttempt, duplicateAttempt]);
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('navigates exactly to home after a successful unlock', async () => {
    appLockService.unlock.mockResolvedValue(true);

    await component.unlock();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/home']);
    expect(component.unlockFailed()).toBe(false);
  });

  it('announces a generic retry message and keeps focus on the retry control after a failed unlock', async () => {
    appLockService.unlock.mockResolvedValue(false);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.focus();

    await component.unlock();
    fixture.detectChanges();

    const status: HTMLParagraphElement = fixture.nativeElement.querySelector('#device-lock-status');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.unlockFailed()).toBe(true);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(status.textContent?.trim()).toBe('common.error_generic');
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('fails closed to generic retry feedback when the lock service throws unexpectedly', async () => {
    appLockService.unlock.mockRejectedValue(new Error('WebAuthn failed'));

    await expect(component.unlock()).resolves.toBeUndefined();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const status: HTMLParagraphElement = fixture.nativeElement.querySelector('#device-lock-status');
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(status.textContent?.trim()).toBe('common.error_generic');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears previous failure feedback when a retry starts', async () => {
    appLockService.unlock.mockResolvedValueOnce(false);
    await component.unlock();
    fixture.detectChanges();
    expect(component.unlockFailed()).toBe(true);

    let resolveRetry: ((value: boolean) => void) | undefined;
    appLockService.unlock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    const retry = component.unlock();
    fixture.detectChanges();

    const status: HTMLParagraphElement = fixture.nativeElement.querySelector('#device-lock-status');
    expect(component.unlockFailed()).toBe(false);
    expect(status.textContent?.trim()).toBe('deviceLock.message');

    if (!resolveRetry) throw new Error('Retry resolver was not initialised');
    resolveRetry(false);
    await retry;
  });

  it('remains direction-neutral and wraps long RTL translations without physical-direction utilities', () => {
    const longArabic = 'هذا نص عربي طويل لاختبار إعادة التدفق والوصول عند التكبير '.repeat(8).trim();
    i18n.translations = {
      'deviceLock.title': longArabic,
      'deviceLock.message': longArabic,
      'deviceLock.unlock': `${longArabic} فتح`,
    };
    document.documentElement.dir = 'rtl';
    fixture.detectChanges();

    const shell: HTMLDivElement = fixture.nativeElement.querySelector('div');
    const heading: HTMLHeadingElement = fixture.nativeElement.querySelector('h1');
    const status: HTMLParagraphElement = fixture.nativeElement.querySelector('#device-lock-status');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const classes = [shell.className, heading.className, status.className, button.className].join(' ');

    expect(document.documentElement.dir).toBe('rtl');
    expect(heading.dir).toBe('auto');
    expect(status.dir).toBe('auto');
    expect(heading.textContent?.trim()).toBe(longArabic);
    expect(status.textContent?.trim()).toBe(longArabic);
    expect(button.textContent?.trim()).toContain('فتح');
    expect(classes).not.toMatch(/(?:^|\s)(?:ml|mr|pl|pr|left|right)-/);
  });

  it('introduces no component-level motion that bypasses reduced-motion preferences', () => {
    const markup = fixture.nativeElement.innerHTML as string;

    expect(markup).not.toMatch(/\banimate-/);
    expect(markup).not.toMatch(/\btransition(?:-|\b)/);
    expect(markup).not.toMatch(/\bduration-/);
  });
});
