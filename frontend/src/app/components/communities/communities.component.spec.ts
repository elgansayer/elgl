import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommunitiesComponent } from './communities.component';
import {
  CommunitiesService,
  Community,
  CreateCommunityPayload,
} from '../../services/communities.service';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

const community: Community = {
  id: 'community-1',
  name: 'Language Exchange',
  description: 'Weekly practice',
  owner_id: 'owner-1',
  created_at: '2026-08-17T00:00:00Z',
};

const listMine = vi.fn(async () => [community]);
const createCommunity = vi.fn(async (_payload: CreateCommunityPayload) => community);
const removeCommunity = vi.fn(async (_id: string) => undefined);

describe('CommunitiesComponent', () => {
  let fixture: ComponentFixture<CommunitiesComponent>;
  let component: CommunitiesComponent;

  beforeEach(async () => {
    listMine.mockReset();
    listMine.mockResolvedValue([community]);
    createCommunity.mockReset();
    createCommunity.mockResolvedValue(community);
    removeCommunity.mockReset();
    removeCommunity.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [CommunitiesComponent],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        {
          provide: CommunitiesService,
          useValue: {
            listMine,
            create: createCommunity,
            remove: removeCommunity,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give both Spartan inputs persistent translated labels', () => {
    const nameLabel = fixture.nativeElement.querySelector('label[for="community-name"]');
    const descriptionLabel = fixture.nativeElement.querySelector(
      'label[for="community-description"]',
    );
    const nameInput = fixture.nativeElement.querySelector('#community-name');
    const descriptionInput = fixture.nativeElement.querySelector('#community-description');

    expect(nameLabel?.textContent).toContain('communities.nameLabel');
    expect(descriptionLabel?.textContent).toContain('communities.descriptionLabel');
    expect(nameInput).toBeTruthy();
    expect(descriptionInput).toBeTruthy();
  });

  it('should keep delete actions contextual without changing visible translated copy', () => {
    const deleteButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'li button',
    );

    expect(deleteButton).toBeTruthy();
    expect(deleteButton?.textContent).toContain('communities.delete');
    expect(deleteButton?.textContent).toContain(community.name);
    expect(deleteButton?.querySelector('.sr-only')?.textContent).toContain(community.name);
  });

  it('should trim create input and prevent duplicate mutations while pending', async () => {
    let finishCreate: (() => void) | undefined;
    const pendingCreate = new Promise<Community>((resolve) => {
      finishCreate = () => resolve(community);
    });
    createCommunity.mockReturnValueOnce(pendingCreate);

    component.newName.set('  Language Exchange  ');
    component.newDescription.set('  Weekly practice  ');

    const firstCreate = component.create();
    const duplicateCreate = component.create();

    expect(component.creating()).toBe(true);
    expect(component.mutationPending()).toBe(true);
    expect(createCommunity).toHaveBeenCalledTimes(1);
    expect(createCommunity).toHaveBeenCalledWith({
      name: 'Language Exchange',
      description: 'Weekly practice',
    });

    finishCreate?.();
    await Promise.all([firstCreate, duplicateCreate]);

    expect(component.creating()).toBe(false);
    expect(component.mutationPending()).toBe(false);
    expect(component.newName()).toBe('');
    expect(component.newDescription()).toBe('');
  });

  it('should release the pending create state when the service rejects', async () => {
    createCommunity.mockRejectedValueOnce(new Error('create failed'));
    component.newName.set('Language Exchange');

    await expect(component.create()).rejects.toThrow('create failed');

    expect(component.creating()).toBe(false);
    expect(component.mutationPending()).toBe(false);
  });

  it('should prevent overlapping delete mutations and restore controls afterwards', async () => {
    let finishDelete: (() => void) | undefined;
    const pendingDelete = new Promise<void>((resolve) => {
      finishDelete = resolve;
    });
    removeCommunity.mockReturnValueOnce(pendingDelete);

    const firstDelete = component.delete('community-1');
    const duplicateDelete = component.delete('community-2');

    expect(component.deletingId()).toBe('community-1');
    expect(component.mutationPending()).toBe(true);
    expect(removeCommunity).toHaveBeenCalledTimes(1);
    expect(removeCommunity).toHaveBeenCalledWith('community-1');

    finishDelete?.();
    await Promise.all([firstDelete, duplicateDelete]);

    expect(component.deletingId()).toBeNull();
    expect(component.mutationPending()).toBe(false);
  });

  it('should render valid list children for loaded communities', () => {
    const list = fixture.nativeElement.querySelector('ul');
    const children = Array.from(list?.children ?? []);

    expect(children.length).toBeGreaterThan(0);
    expect(children.every((child) => child.tagName === 'LI')).toBe(true);
  });
});
