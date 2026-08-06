import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FontScaleService } from '../../../services/font-scale.service';
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AppearanceSettingsComponent', () => {
  let component: AppearanceSettingsComponent;
  let fixture: ComponentFixture<AppearanceSettingsComponent>;

  beforeEach(async () => {
    const fontScaleServiceMock = {
      scaleFactor: signal(1),
      setScale: vi.fn(),
    };

    const userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({ is_vip: true, primary_accent_color: '#e11d48' }),
      updateMyProfile: vi.fn().mockResolvedValue(true),
    };

    const i18nServiceMock = {
      translate: vi.fn().mockReturnValue('mock translation'),
    };

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
