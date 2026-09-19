import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../services/chat.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';
import { CreateGroupComponent } from './create-group.component';

const componentDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(componentDirectory, '../../../..');

const mockUser: UserProfile = {
  id: 'user-a',
  display_name: 'Alice',
  native_languages: ['English'],
  target_languages: ['French'],
  avatar_url: '',
  is_vip: false,
  vip_tier: '',
  coins_balance: 0,
  study_streak_days: 0,
  correction_ratio: 0,
  is_serious_learner: false,
  privacy_hide_age: false,
  privacy_hide_location: false,
  privacy_hide_from_search: false,
  privacy_hide_gender: false,
  created_at: '2026-01-01',
};

describe('CreateGroupComponent completion contract', () => {
  let component: CreateGroupComponent;
  let fixture: ComponentFixture<CreateGroupComponent>;
  let chatService: { createGroup: ReturnType<typeof vi.fn> };
  let discoveryService: { findPartners: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    chatService = {
      createGroup: vi.fn().mockResolvedValue({
        id: 'group-123',
        name: 'Study Buddies',
        created_at: '2026-01-01',
      }),
    };
    discoveryService = {
      findPartners: vi.fn().mockResolvedValue([]),
    };
    router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [CreateGroupComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: DiscoveryService, useValue: discoveryService },
        { provide: Router, useValue: router },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('trims the group name and submits the selected member ids before navigating', async () => {
    component.groupName = '  Study Buddies  ';
    component.selectedMembers.set([mockUser]);

    await component.createGroup();

    expect(chatService.createGroup).toHaveBeenCalledWith('Study Buddies', ['user-a']);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.success()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('excludes selected members and bounds matching search results to twenty', async () => {
    const users = Array.from({ length: 22 }, (_, index) => ({
      ...mockUser,
      id: `user-${index}`,
      display_name: `English Partner ${index}`,
    }));
    component.selectedMembers.set([users[0]]);
    discoveryService.findPartners.mockResolvedValue(users);
    component.searchQuery = 'English';

    await component.searchUsers();

    expect(discoveryService.findPartners).toHaveBeenCalledWith({
      native_languages: 'English',
      target_language: 'English',
    });
    expect(component.searchResults()).toHaveLength(20);
    expect(component.searchResults().some((user) => user.id === users[0].id)).toBe(false);
  });

  it('fails closed when partner discovery fails and always clears the busy state', async () => {
    component.searchResults.set([mockUser]);
    discoveryService.findPartners.mockRejectedValue(new Error('offline'));
    component.searchQuery = 'English';

    await component.searchUsers();

    expect(component.searchResults()).toEqual([]);
    expect(component.isSearching()).toBe(false);
  });
});

describe('Create group Relay and design-preview contract', () => {
  const styles = readFileSync(resolve(componentDirectory, 'create-group.component.scss'), 'utf8');
  const preview = readFileSync(
    resolve(frontendRoot, 'design-preview/components/component-system.html'),
    'utf8',
  );

  it('keeps the runtime surface on Relay semantic tokens and logical direction properties', () => {
    expect(styles).toContain('rgb(var(--surface-500-rgb))');
    expect(styles).toContain('rgb(var(--text-primary-rgb))');
    expect(styles).toContain('rgb(var(--color-primary-rgb))');
    expect(styles).toContain('rgb(var(--on-fill-rgb))');
    expect(styles).toContain('inset-inline-start');
    expect(styles).toContain('margin-inline-start');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('locks the mobile-first and wider primary-action layout', () => {
    expect(styles).toMatch(/\.create-btn\s*\{[\s\S]*?width:\s*100%/);
    expect(styles).toMatch(
      /@media \(min-width: 40rem\)[\s\S]*?\.create-btn\s*\{[\s\S]*?width:\s*auto/,
    );
  });

  it('keeps explicit light-mobile and dark-wide Create Group states in the design preview', () => {
    expect(preview).toContain('class="create-group-preview light"');
    expect(preview).toContain('aria-label="Create group light mobile preview"');
    expect(preview).toContain('class="create-group-preview dark wide"');
    expect(preview).toContain('aria-label="Create group dark wide preview"');
    expect(preview).toContain('.create-group-preview.light');
    expect(preview).toContain('.create-group-preview.dark');
    expect(preview).toContain('.create-group-preview.wide .create-action');
  });
});
