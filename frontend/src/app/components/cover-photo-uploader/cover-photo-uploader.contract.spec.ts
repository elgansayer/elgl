import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PipeTransform } from '@angular/core';

import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoUploaderComponent } from './cover-photo-uploader.component';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoUploaderComponent upload and positioning contract', () => {
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

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('centres a 3:1 crop window inside the selected image', () => {
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: 1200 });
    Object.defineProperty(image, 'naturalHeight', { value: 400 });

    component.onImageLoad({ target: image } as unknown as Event);

    const crop = component.cropBox();
    expect(crop.width).toBe(800);
    expect(crop.height).toBeCloseTo(800 / 3);
    expect(crop.width / crop.height).toBeCloseTo(3);
    expect(crop.x).toBeCloseTo((1200 - crop.width) / 2);
    expect(crop.y).toBeCloseTo((400 - crop.height) / 2);
  });

  it('keeps the initial 3:1 crop inside short images', () => {
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: 1200 });
    Object.defineProperty(image, 'naturalHeight', { value: 180 });

    component.onImageLoad({ target: image } as unknown as Event);

    const crop = component.cropBox();
    expect(crop.width / crop.height).toBeCloseTo(3);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1200);
    expect(crop.y + crop.height).toBeLessThanOrEqual(180);
  });

  it('uploads the cropped JPEG through the authenticated presign and confirm contract', async () => {
    component.croppedPreviewUrl.set('data:image/jpeg;base64,aGVsbG8=');
    const uploaded: string[] = [];
    component.coverPhotoUploaded.subscribe((url) => uploaded.push(url));

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    const uploadPromise = component.uploadCropped();

    const presign = httpMock.expectOne(`${environment.apiUrl}/media/cover/presigned-url`);
    expect(presign.request.method).toBe('POST');
    expect(presign.request.body).toMatchObject({
      contentType: 'image/jpeg',
      folder: 'covers',
    });
    expect(presign.request.body.filename).toMatch(/^cover-\d+\.jpg$/);
    presign.flush({
      uploadUrl: 'https://uploads.example.test/signed-cover',
      mediaUrl: 'https://media.example.test/covers/cover.jpg',
      objectKey: 'covers/user/cover.jpg',
    });

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://uploads.example.test/signed-cover',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );

    const confirm = httpMock.expectOne(`${environment.apiUrl}/media/cover/confirm`);
    expect(confirm.request.method).toBe('POST');
    expect(confirm.request.body).toEqual({ objectKey: 'covers/user/cover.jpg' });
    confirm.flush({ coverUrl: 'https://media.example.test/covers/cover.jpg' });

    await uploadPromise;

    expect(uploaded).toEqual(['https://media.example.test/covers/cover.jpg']);
    expect(component.isUploading()).toBe(false);
    expect(component.imageSource()).toBeNull();
    expect(component.croppedPreviewUrl()).toBeNull();
  });

  it('does not emit a new cover URL when the direct upload fails', async () => {
    component.croppedPreviewUrl.set('data:image/jpeg;base64,aGVsbG8=');
    const uploaded: string[] = [];
    component.coverPhotoUploaded.subscribe((url) => uploaded.push(url));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);

    const uploadPromise = component.uploadCropped();
    const presign = httpMock.expectOne(`${environment.apiUrl}/media/cover/presigned-url`);
    presign.flush({
      uploadUrl: 'https://uploads.example.test/signed-cover',
      mediaUrl: 'https://media.example.test/covers/cover.jpg',
      objectKey: 'covers/user/cover.jpg',
    });

    await uploadPromise;

    expect(uploaded).toEqual([]);
    expect(component.isUploading()).toBe(false);
    expect(component.croppedPreviewUrl()).toBeTruthy();
  });
});
