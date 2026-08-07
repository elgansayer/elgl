import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      clearLocalCache: vi.fn(),
      toggleCellularAutoDownload: vi.fn(),
      estimateCacheSize: vi.fn().mockResolvedValue(2048),
    };

    cacheServiceMock = {
      clearCache: vi.fn().mockResolvedValue(undefined),
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate back', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('should toggle cellular auto-download', () => {
    component.toggleCellular();
    expect(dataStorageServiceMock.toggleCellularAutoDownload).toHaveBeenCalled();
  });

  it('should have cellularAutoDownload signal from service', () => {
    expect(component.cellularAutoDownload()).toBe(true);
  });

  it('should format cache size as bytes', () => {
    component['cacheSize'].set(500);
    expect(component.formattedCacheSize()).toBe('500 B');
  });

  it('should format cache size as KB', () => {
    component['cacheSize'].set(1536);
    expect(component.formattedCacheSize()).toBe('1.5 KB');
  });

  it('should format cache size as MB', () => {
    component['cacheSize'].set(2_500_000);
    expect(component.formattedCacheSize()).toBe('2.4 MB');
  });

  it('should return empty string when cache size is null', () => {
    component['cacheSize'].set(null);
    expect(component.formattedCacheSize()).toBe('');
  });

  it('should compute cache size on init', async () => {
    expect(dataStorageServiceMock.estimateCacheSize).toHaveBeenCalled();
  });

  it('should clear cache and show success', async () => {
    await component.clearCache();
    expect(dataStorageServiceMock.clearLocalCache).toHaveBeenCalled();
    expect(cacheServiceMock.clearCache).toHaveBeenCalled();
    expect(component.successMessage()).toBe('dataStorage.cacheCleared');
    expect(component.isClearingCache()).toBe(false);
  });

  it('should handle clear cache error', async () => {
    (cacheServiceMock.clearCache as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    await component.clearCache();
    expect(component.errorMessage()).toBe('Failed to clear cache');
    expect(component.isClearingCache()).toBe(false);
  });

  it('should delete old media and show success', async () => {
    await component.deleteOldMedia();
    expect(cacheServiceMock.deleteOldMedia).toHaveBeenCalled();
    expect(component.successMessage()).toBe('dataStorage.oldMediaDeleted');
    expect(component.isDeletingOldMedia()).toBe(false);
  });

  it('should handle delete old media error', async () => {
    (cacheServiceMock.deleteOldMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    await component.deleteOldMedia();
    expect(component.errorMessage()).toBe('Failed to delete old media');
    expect(component.isDeletingOldMedia()).toBe(false);
  });
});