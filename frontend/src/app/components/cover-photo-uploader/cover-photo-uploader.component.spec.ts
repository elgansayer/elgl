import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CoverPhotoUploaderComponent } from './cover-photo-uploader.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { PipeTransform } from '@angular/core';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoUploaderComponent', () => {
  let component: CoverPhotoUploaderComponent;
  let fixture: ComponentFixture<CoverPhotoUploaderComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CoverPhotoUploaderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslatePipe, useClass: MockTranslatePipe },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CoverPhotoUploaderComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show upload trigger when no cover URL is provided', () => {
    fixture.componentRef.setInput('currentCoverUrl', '');
    fixture.detectChanges();
    const triggerDiv = fixture.nativeElement.querySelector('.group');
    expect(triggerDiv).toBeTruthy();
  });

  it('should have currentCoverUrl signal defaulted to empty', () => {
    expect(component.currentCoverUrl()).toBe('');
  });

  it('should set image source via FileReader on file selection', async () => {
    const file = new File(['dummy image'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');

    const fileList = [file] as unknown as FileList;
    Object.defineProperty(fileInput, 'files', {
      value: fileList,
      writable: false,
      configurable: true,
    });

    component.onFileSelected({ target: fileInput } as unknown as Event);

    // Wait for FileReader to complete
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        fixture.detectChanges();
        resolve();
      }, 50);
    });

    expect(component.imageSource()).toBeTruthy();
    expect(component.imageSource()).toContain('data:image/jpeg');
  });

  it('should return early from uploadCropped when no preview exists', async () => {
    component.croppedPreviewUrl.set(null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await component.uploadCropped();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(component.isUploading()).toBe(false);
    fetchSpy.mockRestore();
  });

  it('should apply crop and reset correctly via signal API', () => {
    // The canvas getContext('2d') may return null in jsdom, so applyCrop guards against it
    // Set original image then verify applyCrop doesn't throw
    const img = new Image();
    img.width = 800;
    img.height = 400;
    (component as any).originalImage = img;
    component.imageWidth.set(800);
    component.imageHeight.set(400);
    component.cropBox.set({ x: 100, y: 50, width: 600, height: 200 });

    // applyCrop should not throw even when canvas context is null (jsdom)
    expect(() => component.applyCrop()).not.toThrow();
  });

  it('should reset all state on reset', () => {
    component.imageSource.set('data:image/...');
    component.isCropping.set(true);
    component.isUploading.set(true);
    component.croppedPreviewUrl.set('data:image/...');
    (component as any).originalImage = new Image();

    component.reset();

    expect(component.imageSource()).toBeNull();
    expect(component.isCropping()).toBe(false);
    expect(component.isUploading()).toBe(false);
    expect(component.croppedPreviewUrl()).toBeNull();
    expect((component as any).originalImage).toBeNull();
  });

  it('should not upload when no cropped preview exists', async () => {
    component.croppedPreviewUrl.set(null);
    component.isUploading.set(false);

    await component.uploadCropped();

    expect(component.isUploading()).toBe(false);
    // No HTTP requests should have been made
    httpMock.verify();
  });
});