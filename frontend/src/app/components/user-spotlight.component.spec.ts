import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserSpotlightComponent } from './user-spotlight.component';
import { SupabaseService, UserProfile } from '../services/supabase.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('UserSpotlightComponent', () => {
  let component: UserSpotlightComponent;
  let fixture: ComponentFixture<UserSpotlightComponent>;
  let supabaseServiceMock: {
    getRecentlyJoinedNativeSpeakers: ReturnType<typeof vi.fn>;
  };

  const mockUsers: UserProfile[] = [
    {
      id: '1',
      display_name: 'John Doe',
      avatar_url: 'avatar1.jpg',
      native_languages: ['English'],
      target_languages: ['French'],
      audio_intro_url: null,
      is_vip: false,
      vip_tier: 'free',
      auto_download_preference: 'wifi',
    },
  ];

  beforeEach(async () => {
    supabaseServiceMock = {
      getRecentlyJoinedNativeSpeakers: vi.fn().mockResolvedValue(mockUsers),
    };

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [UserSpotlightComponent],
      providers: [{ provide: SupabaseService, useValue: supabaseServiceMock }],
    })
      .overrideComponent(UserSpotlightComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserSpotlightComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load recently joined users', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(supabaseServiceMock.getRecentlyJoinedNativeSpeakers).toHaveBeenCalledTimes(1);
    expect(component.users().length).toBe(1);
    expect(component.users()[0].display_name).toBe('John Doe');
  });

  it('defers repeated avatar work and reserves avatar dimensions', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(avatar).not.toBeNull();
    expect(avatar?.getAttribute('loading')).toBe('lazy');
    expect(avatar?.getAttribute('decoding')).toBe('async');
    expect(avatar?.getAttribute('width')).toBe('40');
    expect(avatar?.getAttribute('height')).toBe('40');
  });
});
