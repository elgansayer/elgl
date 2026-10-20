import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { DataStorageComponent } from './data-storage.component';
import { DataStorageService } from '../../services/data-storage.service';
import { CacheService } from '../../services/cache.service';
import { I18nService } from '../../services/i18n.service';

describe('DataStorageComponent', () => {
  let component: DataStorageComponent;
  let fixture: ComponentFixture<DataStorageComponent>;
  let dataStorageServiceMock: Partial<DataStorageService>;
  let cacheServiceMock: Partial<CacheService>;
  let locationMock: Partial<Location>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    dataStorageServiceMock = {
      cellularAutoDownload: signal(true),
      toggleCellularAutoDownload: vi.fn(),
      estimateCacheSize: vi.fn().mockResolvedValue(2048),
    };

    cacheServiceMock = {
      clearCache: vi.fn().mockResolvedValue({
        localEntriesRemoved: 1,
        cacheStoresRemoved: 1,
        databasesRemoved: 3,
      }),
      deleteOldMedia: vi.fn().mockResolvedValue(undefined),
    };

    locationMock = {
      back: vi.fn(),
    };

    i18nServiceMock = {
      translate: vi.fn((key: string) => key),
      currentLang: signal('en-GB'),
    };

    await TestBed.configureTestingModule({
      imports: [DataStorageComponent],
      providers: [
        { provide: DataStorageService, useValue: dataStorageServiceMock },
        { provide: CacheService, useValue: cacheServiceMock },
        { provide: Location, useValue: locationMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataStorageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('creates and computes cache size on init', () => {
    expect(component).toBeTruthy();
    expect(dataStorageServiceMock.estimateCacheSize).toHaveBeenCalled();
    expect(component.cacheSize()).toBe(2048);
  });

  it('navigates back', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('toggles cellular auto-download through the storage service', () => {
    component.toggleCellular();
    expect(dataStorageServiceMock.toggleCellularAutoDownload).toHaveBeenCalledTimes(1);
  });

  it('formats cache sizes without exposing an invented value while unavailable', () => {
    component.cacheSize.set(500);
    expect(component.formattedCacheSize()).toBe('500 B');

    component.cacheSize.set(1536);
    expect(component.formattedCacheSize()).toBe('1.5 KB');

    component.cacheSize.set(2_500_000);
    expect(component.formattedCacheSize()).toBe('2.4 MB');

    component.cacheSize.set(null);
    expect(component.formattedCacheSize()).toBe('');
  });

  it('requires an explicit confirmation before clearing cache', async () => {
    await component.clearCache();
    expect(cacheServiceMock.clearCache).not.toHaveBeenCalled();

    component.requestClearCache();
    expect(component.confirmClearCache()).toBe(true);
    expect(cacheServiceMock.clearCache).not.toHaveBeenCalled();

    await component.clearCache();
    expect(cacheServiceMock.clearCache).toHaveBeenCalledTimes(1);
    expect(component.confirmClearCache()).toBe(false);
    expect(component.successMessage()).toBe('dataStorage.cacheCleared');
    expect(component.isClearingCache()).toBe(false);
  });

  it('allows a pending cache clear to be cancelled without mutation', () => {
    component.requestClearCache();
    component.cancelClearCache();

    expect(component.confirmClearCache()).toBe(false);
    expect(cacheServiceMock.clearCache).not.toHaveBeenCalled();
  });

  it('reports partial cache-clear failure and leaves confirmation available for retry', async () => {
    (cacheServiceMock.clearCache as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('partial failure'),
    );
    component.requestClearCache();

    await component.clearCache();

    expect(component.errorMessage()).toContain('Failed to clear');
    expect(component.confirmClearCache()).toBe(true);
    expect(component.isClearingCache()).toBe(false);
    expect(dataStorageServiceMock.estimateCacheSize).toHaveBeenCalledTimes(2);
  });

  it('deletes old media and refreshes the cache estimate', async () => {
    await component.deleteOldMedia();

    expect(cacheServiceMock.deleteOldMedia).toHaveBeenCalledTimes(1);
    expect(component.successMessage()).toBe('dataStorage.oldMediaDeleted');
    expect(component.isDeletingOldMedia()).toBe(false);
    expect(dataStorageServiceMock.estimateCacheSize).toHaveBeenCalledTimes(2);
  });

  it('handles old-media deletion failure', async () => {
    (cacheServiceMock.deleteOldMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('failure'),
    );

    await component.deleteOldMedia();

    expect(component.errorMessage()).toContain('Failed to delete old media');
    expect(component.isDeletingOldMedia()).toBe(false);
  });

  it('keeps cache size unavailable when estimation fails', async () => {
    (dataStorageServiceMock.estimateCacheSize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('storage denied'),
    );

    await component.computeCacheSize();

    expect(component.cacheSize()).toBeNull();
    expect(component.isComputingSize()).toBe(false);
  });
});
