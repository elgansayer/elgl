import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { DeviceTransferComponent } from './device-transfer.component';

class MockAuthService {
  generateDeviceLink = vi.fn().mockResolvedValue('https://example.test/device-transfer?token=temporary');
}

describe('DeviceTransferComponent', () => {
  let fixture: ComponentFixture<DeviceTransferComponent>;
  let component: DeviceTransferComponent;
  let authService: MockAuthService;
  let clipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    authService = new MockAuthService();

    await TestBed.configureTestingModule({
      imports: [DeviceTransferComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(null) } } },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: HttpClient, useValue: { post: vi.fn() } },
        { provide: AuthService, useValue: authService },
        { provide: SupabaseService, useValue: { getClient: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  function setClipboard(writeText: (value: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  }

  it('uses a native Spartan touch button without custom keyboard semantics', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('size')).toBe('touch');
    expect(button.hasAttribute('role')).toBe(false);
    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(button.hasAttribute('keydown')).toBe(false);
  });

  it('exposes generated, copied and failure states through semantic live regions', () => {
    expect(component.status()).toBe('ready');

    const main: HTMLElement = fixture.nativeElement.querySelector('main');
    const heading: HTMLHeadingElement = fixture.nativeElement.querySelector('h1');
    const liveRegion: HTMLParagraphElement = fixture.nativeElement.querySelector('p[aria-live="polite"]');

    expect(main.getAttribute('aria-labelledby')).toBe('device-transfer-title');
    expect(heading.id).toBe('device-transfer-title');
    expect(liveRegion.getAttribute('role')).toBe('status');
  });

  it('prevents duplicate clipboard writes while an interaction is pending', async () => {
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    setClipboard(writeText);

    const first = component.copyLink();
    const duplicate = component.copyLink();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(component.deviceLink());
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    if (!resolveWrite) throw new Error('Clipboard resolver was not initialised');
    resolveWrite();
    await Promise.all([first, duplicate]);
    fixture.detectChanges();

    expect(component.copyStatus()).toBe('copied');
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Device transfer link copied to clipboard.');
  });

  it('keeps copy failures retryable and does not expose clipboard errors', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('sensitive browser failure')));

    await component.copyLink();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(component.copyStatus()).toBe('error');
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Could not copy the link. Select the link above and copy it manually.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('sensitive browser failure');
  });

  it('ignores programmatic copy attempts unless a ready transfer link exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    component.status.set('generating');

    await component.copyLink();

    expect(writeText).not.toHaveBeenCalled();
    expect(component.copyStatus()).toBe('idle');
  });
});
