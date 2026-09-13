import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BlockedUsersService } from '../../../services/blocked-users.service';
import { I18nService } from '../../../services/i18n.service';
import {
  PresencePrivacyService,
  PresencePrivacySettings,
} from '../../../services/presence-privacy.service';
import { ProfileVisibilityService } from '../../../services/profile-visibility.service';
import { SafetyService } from '../../../services/safety.service';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe('PrivacySettingsComponent presence privacy', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;
  const getPresencePrivacy = vi.fn<() => Promise<PresencePrivacySettings>>();
  const updatePresencePrivacy = vi.fn<
    (update: Partial<PresencePrivacySettings>) => Promise<void>
  >();

  beforeEach(async () => {
    getPresencePrivacy.mockReset();
    updatePresencePrivacy.mockReset();
    getPresencePrivacy.mockResolvedValue({
      privacy_hide_online_status: true,
      privacy_hide_vip_status: false,
    });
    updatePresencePrivacy.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [
        provideRouter([]),
        {
          provide: SafetyService,
          useValue: {
            mutedWords: signal<string[]>([]),
            addMutedWord: vi.fn(),
            removeMutedWord: vi.fn(),
          },
        },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers: signal<unknown[]>([]),
            loadBlockedUsers: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProfileVisibilityService,
          useValue: {
            getProfileVisibility: vi.fn().mockResolvedValue('everyone'),
            updateProfileVisibility: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PresencePrivacyService,
          useValue: { getPresencePrivacy, updatePresencePrivacy },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads and renders both persisted privacy flags', () => {
    expect(getPresencePrivacy).toHaveBeenCalledOnce();
    expect(component.hideOnlineStatus()).toBe(true);
    expect(component.hideVipStatus()).toBe(false);

    const online = fixture.nativeElement.querySelector(
      'hlm-checkbox[name="hideOnlineStatus"]',
    ) as HTMLElement | null;
    const vip = fixture.nativeElement.querySelector(
      'hlm-checkbox[name="hideVipStatus"]',
    ) as HTMLElement | null;

    expect(online).not.toBeNull();
    expect(vip).not.toBeNull();
  });

  it('persists online-status privacy and reports success', async () => {
    await component.updatePresencePrivacy('privacy_hide_online_status', false);
    fixture.detectChanges();

    expect(updatePresencePrivacy).toHaveBeenCalledWith({
      privacy_hide_online_status: false,
    });
    expect(component.hideOnlineStatus()).toBe(false);
    expect(component.presencePrivacySaveSuccess()).toBe(true);
    expect(component.presencePrivacySaveError()).toBe(false);
  });

  it('persists VIP-status privacy independently', async () => {
    await component.updatePresencePrivacy('privacy_hide_vip_status', true);

    expect(updatePresencePrivacy).toHaveBeenCalledWith({
      privacy_hide_vip_status: true,
    });
    expect(component.hideVipStatus()).toBe(true);
    expect(component.hideOnlineStatus()).toBe(true);
  });

  it('rolls back a failed privacy update and exposes an error state', async () => {
    updatePresencePrivacy.mockRejectedValueOnce(new Error('offline'));

    await component.updatePresencePrivacy('privacy_hide_vip_status', true);
    fixture.detectChanges();

    expect(component.hideVipStatus()).toBe(false);
    expect(component.presencePrivacySaveError()).toBe(true);
    expect(component.presencePrivacySaveSuccess()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('common.error_generic');
  });

  it('serializes privacy mutations while a save is in flight', async () => {
    let resolveSave!: () => void;
    updatePresencePrivacy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const firstSave = component.updatePresencePrivacy('privacy_hide_online_status', false);
    await Promise.resolve();
    await component.updatePresencePrivacy('privacy_hide_vip_status', true);

    expect(updatePresencePrivacy).toHaveBeenCalledTimes(1);
    expect(component.hideVipStatus()).toBe(false);
    resolveSave();
    await firstSave;
  });
});
