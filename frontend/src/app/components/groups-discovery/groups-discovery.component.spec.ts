import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { GroupsDiscoveryComponent } from './groups-discovery.component';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('GroupsDiscoveryComponent', () => {
  let fixture: ComponentFixture<GroupsDiscoveryComponent>;
  let component: GroupsDiscoveryComponent;
  let httpTesting: HttpTestingController;

  const mockGroups = [
    {
      id: 'g1',
      name: 'Spanish Learners',
      owner_id: 'u1',
      max_members: 10,
      member_count: 5,
      is_member: false,
      interest_id: 'interest-spanish',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'g2',
      name: 'Japanese Practice',
      owner_id: 'u2',
      max_members: 12,
      member_count: 7,
      is_member: true,
      interest_id: 'interest-japanese',
      created_at: '2026-01-02T00:00:00Z',
    },
  ];

  const mockInterests = [
    { id: 'interest-spanish', tag: 'spanish', name: 'Spanish' },
    { id: 'interest-japanese', tag: 'japanese', name: 'Japanese' },
  ];

  beforeEach(async () => {
    const mockI18n = {
      currentLang: signal('en-GB'),
      translations: signal({}),
      translate: vi.fn((key: string) => key),
      direction: signal('ltr'),
    };

    await TestBed.configureTestingModule({
      imports: [GroupsDiscoveryComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupsDiscoveryComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function loadDiscovery(): Promise<void> {
    fixture.detectChanges();

    const interestsReq = httpTesting.expectOne((request) => request.url.includes('/interests'));
    expect(interestsReq.request.method).toBe('GET');
    expect(interestsReq.request.urlWithParams).toContain('language=en-GB');
    expect(interestsReq.request.urlWithParams).toContain('includeEmpty=true');
    interestsReq.flush(mockInterests);

    const groupsReq = httpTesting.expectOne((request) =>
      request.url.includes('/groups/discoverable'),
    );
    expect(groupsReq.request.method).toBe('GET');
    groupsReq.flush(mockGroups);

    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads discoverable groups and localized topic metadata', async () => {
    await loadDiscovery();

    expect(component).toBeDefined();
    expect((component as any).items()).toEqual(mockGroups);
    expect((component as any).interestPills()).toEqual(mockInterests);
  });

  it('filters loaded groups by the selected topic without issuing another group request', async () => {
    await loadDiscovery();

    (component as any).selectedInterest.set('interest-spanish');
    fixture.detectChanges();

    expect((component as any).filteredGroups()).toEqual([mockGroups[0]]);
    httpTesting.expectNone((request) => request.url.includes('/groups/discoverable'));
  });

  it('shows all groups again when the topic filter is cleared', async () => {
    await loadDiscovery();

    (component as any).selectedInterest.set('interest-japanese');
    expect((component as any).filteredGroups()).toEqual([mockGroups[1]]);

    (component as any).selectedInterest.set(null);
    expect((component as any).filteredGroups()).toEqual(mockGroups);
  });

  it('joins a selected group through the authenticated groups API and refreshes discovery', async () => {
    await loadDiscovery();
    const reload = vi.spyOn((component as any).groupsResource, 'reload').mockReturnValue(true);

    const joinPromise = component.joinGroup('g1');
    expect((component as any).joiningId()).toBe('g1');

    const joinReq = httpTesting.expectOne((request) => request.url.includes('/groups/g1/join'));
    expect(joinReq.request.method).toBe('POST');
    expect(joinReq.request.body).toEqual({});
    joinReq.flush({ success: true });

    await joinPromise;

    expect(reload).toHaveBeenCalledTimes(1);
    expect((component as any).joiningId()).toBeNull();
  });

  it('keeps join failures retryable and does not refresh a failed mutation', async () => {
    await loadDiscovery();
    const reload = vi.spyOn((component as any).groupsResource, 'reload').mockReturnValue(true);

    const joinPromise = component.joinGroup('g1');
    const joinReq = httpTesting.expectOne((request) => request.url.includes('/groups/g1/join'));
    joinReq.flush(
      { message: 'temporarily unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    await joinPromise;

    expect(reload).not.toHaveBeenCalled();
    expect((component as any).joiningId()).toBeNull();
    expect((component as any).error()).not.toBe('');
  });

  it('surfaces discovery load failure instead of fabricating groups', async () => {
    fixture.detectChanges();

    const interestsReq = httpTesting.expectOne((request) => request.url.includes('/interests'));
    interestsReq.flush([]);

    const groupsReq = httpTesting.expectOne((request) =>
      request.url.includes('/groups/discoverable'),
    );
    groupsReq.error(new ProgressEvent('network error'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect((component as any).items()).toEqual([]);
    expect((component as any).error()).toBe('Failed to load groups');
  });
});
