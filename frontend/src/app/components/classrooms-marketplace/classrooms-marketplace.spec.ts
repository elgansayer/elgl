import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { OfflineClassroomService, ClassroomListing } from '../../services/offline-classroom.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let offlineModeSignal: ReturnType<typeof signal<boolean>>;
  let pendingActionCountSignal: ReturnType<typeof signal<number>>;
  let lastSyncTimestampSignal: ReturnType<typeof signal<number | null>>;
  let getCachedListingsMock: ReturnType<typeof vi.fn>;
  let enqueueActionMock: ReturnType<typeof vi.fn>;
  let resolveListings: (listings: ClassroomListing[]) => void;

  const mockListing: ClassroomListing = {
    id: 'room-1',
    title: 'English Conversation',
    description: 'Practice English with native speakers',
    host_id: 'user-1',
    host_name: 'Alice',
    host_avatar_url: null,
    language: 'English',
    level: 'intermediate',
    participant_count: 3,
    max_participants: 8,
    is_live: true,
    scheduled_at: null,
    tags: ['conversation', 'speaking'],
    thumbnail_url: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    onlineSignal = signal<boolean>(true);
    offlineModeSignal = signal<boolean>(false);
    pendingActionCountSignal = signal<number>(0);
    lastSyncTimestampSignal = signal<number | null>(null);

    getCachedListingsMock = vi.fn(
      () =>
        new Promise<ClassroomListing[]>((resolve) => {
          resolveListings = resolve;
        }),
    );
    enqueueActionMock = vi.fn(() => Promise.resolve('pending-id'));

    const networkStatusMock: Partial<NetworkStatusService> = {
      isOnline: onlineSignal.asReadonly(),
    };

    const offlineClassroomMock: Partial<OfflineClassroomService> = {
      isOfflineMode: offlineModeSignal.asReadonly(),
      pendingActionCount: pendingActionCountSignal.asReadonly(),
      lastSyncTimestamp: lastSyncTimestampSignal.asReadonly(),
      isCacheFresh: vi.fn(() => false),
      getCachedListings: getCachedListingsMock,
      enqueueAction: enqueueActionMock,
      cacheListings: vi.fn(() => Promise.resolve()),
      clearAll: vi.fn(() => Promise.resolve()),
      getCachedListingById: vi.fn(() => Promise.resolve(null)),
      clearListingCache: vi.fn(() => Promise.resolve()),
      getPendingActions: vi.fn(() => Promise.resolve([])),
      removePendingAction: vi.fn(() => Promise.resolve()),
      clearPendingActions: vi.fn(() => Promise.resolve()),
      flushPendingActions: vi.fn(() => Promise.resolve()),
    };

    const i18nMock = {
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params && Object.keys(params).length > 0) return `${key} ${JSON.stringify(params)}`;
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace, TranslatePipe],
      providers: [
        { provide: NetworkStatusService, useValue: networkStatusMock },
        { provide: OfflineClassroomService, useValue: offlineClassroomMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassroomsMarketplace);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show loading state initially', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('should show offline indicator badge when offline', () => {
    offlineModeSignal.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('classroom.offlineIndicator');
  });

  it('should not show offline indicator badge when online', () => {
    onlineSignal.set(true);
    offlineModeSignal.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('classroom.offlineIndicator');
  });

  it('should show empty state after loading resolves with no listings', async () => {
    fixture.detectChanges();
    resolveListings([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.showEmptyState()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('classroom.emptyTitle');
  });

  it('should show listings after loading resolves with data', async () => {
    fixture.detectChanges();
    resolveListings([mockListing]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.listings()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('English Conversation');
  });

  it('should disable join button when offline', async () => {
    onlineSignal.set(false);
    offlineModeSignal.set(true);
    fixture.detectChanges();
    resolveListings([mockListing]);
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const joinBtn = Array.from(buttons).find(
      (b: Element) => (b as HTMLButtonElement).textContent?.includes('classroom.joinOfflineBtn'),
    ) as HTMLButtonElement | undefined;
    expect(joinBtn).toBeTruthy();
    expect(joinBtn?.disabled).toBe(true);
  });

  it('should call handleJoinClassroom which enqueues action when offline', async () => {
    onlineSignal.set(false);
    offlineModeSignal.set(true);
    fixture.detectChanges();
    resolveListings([]);
    await fixture.whenStable();

    await component.handleJoinClassroom('room-1');
    expect(enqueueActionMock).toHaveBeenCalledWith('join', 'room-1');
  });

  it('should call handleLeaveClassroom which enqueues action when offline', async () => {
    onlineSignal.set(false);
    offlineModeSignal.set(true);
    fixture.detectChanges();
    resolveListings([]);
    await fixture.whenStable();

    await component.handleLeaveClassroom('room-2');
    expect(enqueueActionMock).toHaveBeenCalledWith('leave', 'room-2');
  });

  it('should show cached data banner when offline with listings', async () => {
    onlineSignal.set(false);
    offlineModeSignal.set(true);
    lastSyncTimestampSignal.set(Date.now());
    fixture.detectChanges();
    resolveListings([mockListing]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('classroom.cachedDataMessage');
  });

  it('should show pending actions count', async () => {
    onlineSignal.set(false);
    offlineModeSignal.set(true);
    lastSyncTimestampSignal.set(Date.now());
    pendingActionCountSignal.set(3);
    fixture.detectChanges();
    resolveListings([mockListing]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('classroom.pendingActionsCount');
  });
});