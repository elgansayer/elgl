import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoUploaderComponent } from './cover-photo-uploader.component';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoUploaderComponent upload contract', () => {
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

  it('opens the dedicated 3:1 cropper only after a valid file is selected', () => {
    expect(component.isCropping()).toBe(false);

    const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' });
    component.selectedFile.set(file);
    component.startCropping();

    expect(component.isCropping()).toBe(true);
  });

  it('uploads the cropped JPEG through the authenticated presign and confirm contract', async () => {
    const croppedBlob = new Blob(['cropped'], { type: 'image/jpeg' });
    component.croppedBlob.set(croppedBlob);
    component.croppedPreviewUrl.set('blob:cropped-cover');
    const uploaded: string[] = [];
    component.coverPhotoUploaded.subscribe((url) => uploaded.push(url));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const uploadPromise = component.uploadCropped();

    const presign = httpMock.expectOne(`${environment.apiUrl}/media/cover/presigned-url`);
    expect(presign.request.method).toBe('POST');
    expect(presign.request.body).toMatchObject({
      contentType: 'image/jpeg',
      folder: 'cover-photos',
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
        body: croppedBlob,
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
    expect(component.croppedBlob()).toBeNull();
    expect(component.croppedPreviewUrl()).toBeNull();
  });

  it('does not emit a new cover URL when the direct upload fails', async () => {
    component.croppedBlob.set(new Blob(['cropped'], { type: 'image/jpeg' }));
    component.croppedPreviewUrl.set('blob:cropped-cover');
    const uploaded: string[] = [];
    component.coverPhotoUploaded.subscribe((url) => uploaded.push(url));
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
    expect(component.uploadError()).toBe(true);
    expect(component.croppedPreviewUrl()).toBeTruthy();
  });
});
