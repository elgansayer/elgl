import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppLockService } from '../../services/app-lock.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { DeviceLockComponent } from './device-lock.component';

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

class MockAppLockService {
  unlock = vi.fn().mockResolvedValue(false);
}

describe('DeviceLockComponent', () => {
  let component: DeviceLockComponent;
  let fixture: ComponentFixture<DeviceLockComponent>;
  let appLockService: MockAppLockService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    appLockService = new MockAppLockService();
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DeviceLockComponent, TranslatePipe],
      providers: [
        { provide: AppLockService, useValue: appLockService },
        { provide: I18nService, useClass: MockI18nService },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceLockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses the native Spartan touch button without custom keyboard semantics', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('size')).toBe('touch');
    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(button.hasAttribute('role')).toBe(false);
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

  it('uses mobile-first reflow and keeps the primary action reachable at narrow widths', () => {
    const shell: HTMLDivElement = fixture.nativeElement.querySelector('div');
    const content: HTMLDivElement = shell.querySelector('div')!;
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(shell.classList).toContain('min-h-full');
    expect(shell.classList).toContain('p-4');
    expect(shell.classList).toContain('sm:p-6');
    expect(content.classList).toContain('w-full');
    expect(content.classList).toContain('max-w-sm');
    expect(button.classList).toContain('w-full');
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
  });

  it('keeps the user locked and re-enables retry after a failed unlock', async () => {
    appLockService.unlock.mockResolvedValue(false);

    await component.unlock();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(navigate).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('clears pending state if the lock service throws unexpectedly', async () => {
    appLockService.unlock.mockRejectedValue(new Error('WebAuthn failed'));

    await expect(component.unlock()).rejects.toThrow('WebAuthn failed');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
