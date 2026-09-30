import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PipeTransform } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoUploaderComponent } from './cover-photo-uploader.component';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoUploaderComponent', () => {
  let component: CoverPhotoUploaderComponent;
  let fixture: ComponentFixture<CoverPhotoUploaderComponent>;
  let httpMock: HttpTestingController;
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createObjectUrl = vi.fn(() => 'blob:cover-preview');
    revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });

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

  it('creates with an empty cover input', () => {
    expect(component).toBeTruthy();
    expect(component.currentCoverUrl()).toBe('');
  });

  it('uses a native Spartan button for the visible file-selection action', () => {
    const frame = fixture.nativeElement.querySelector('.group') as HTMLElement;
    const trigger = frame.querySelector('button') as HTMLButtonElement;
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(fileInput, 'click');

    expect(trigger).toBeTruthy();
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.type).toBe('button');
    expect(trigger.getAttribute('role')).toBeNull();
    expect(trigger.classList.contains('focus-visible:opacity-100')).toBe(true);
    expect(frame.classList.contains('rounded-card')).toBe(true);
    expect(frame.classList.contains('bg-surface-200')).toBe(true);

    trigger.click();

    expect(click).toHaveBeenCalledOnce();
  });

  it('keeps the visible trigger labelled by translated product copy', () => {
    fixture.componentRef.setInput('currentCoverUrl', 'https://cdn.example.test/cover.webp');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.group button') as HTMLButtonElement;
    const image = fixture.nativeElement.querySelector('.group img') as HTMLImageElement;

    expect(trigger.textContent).toContain('coverPhoto.changeCover');
    expect(image.alt).toBe('coverPhoto.previewAlt');
  });

  it('stores the selected file and reads a local preview without starting crop mode', async () => {
    const file = new File(['dummy image'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file] as unknown as FileList,
    });

    component.onFileSelected({ target: fileInput } as unknown as Event);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(component.selectedFile()).toBe(file);
    expect(component.imageSource()).toContain('data:image/jpeg');
    expect(component.isCropping()).toBe(false);
    expect(component.croppedBlob()).toBeNull();
  });

  it('rejects unsupported file types before editor state changes', () => {
    const file = new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file] as unknown as FileList,
    });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.selectedFile()).toBeNull();
    expect(component.imageSource()).toBeNull();
  });

  it('delegates cropping to the shared cover photo cropper', () => {
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    component.selectedFile.set(file);
    component.imageSource.set('data:image/png;base64,AA==');

    component.startCropping();
    fixture.detectChanges();

    expect(component.isCropping()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-cover-photo-cropper')).toBeTruthy();
  });

  it('accepts the shared cropper result and enables a recoverable upload preview', () => {
    const blob = new Blob(['cropped'], { type: 'image/webp' });
    component.isCropping.set(true);

    component.onCropSaved(blob);
    fixture.detectChanges();

    expect(component.croppedBlob()).toBe(blob);
    expect(component.croppedPreviewUrl()).toBe('blob:cover-preview');
    expect(component.isCropping()).toBe(false);
    expect(component.uploadError()).toBe(false);
    expect(createObjectUrl).toHaveBeenCalledWith(blob);
  });

  it('keeps upload disabled until a valid crop result exists', () => {
    component.selectedFile.set(new File(['image'], 'cover.png', { type: 'image/png' }));
    component.imageSource.set('data:image/png;base64,AA==');
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const upload = buttons.find((button) => button.textContent?.includes('common.upload'));

    expect(upload).toBeTruthy();
    expect(upload?.disabled).toBe(true);
  });

  it('preserves the presign, R2 PUT, confirm and output sequence', async () => {
    const blob = new Blob(['cropped'], { type: 'image/webp' });
    component.onCropSaved(blob);
    component.imageSource.set('data:image/webp;base64,AA==');
    component.selectedFile.set(new File(['image'], 'cover.webp', { type: 'image/webp' }));
    const emitted = vi.fn();
    component.coverPhotoUploaded.subscribe(emitted);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const uploadPromise = component.uploadCropped();
    const presign = httpMock.expectOne((request) => request.url.endsWith('/media/cover/presigned-url'));
    expect(presign.request.method).toBe('POST');
    expect(presign.request.body).toMatchObject({
      contentType: 'image/webp',
      folder: 'cover-photos',
    });
    expect(presign.request.body.filename).toMatch(/^cover-\d+\.webp$/);
    presign.flush({
      uploadUrl: 'https://upload.example.test/cover',
      mediaUrl: 'https://cdn.example.test/pending.webp',
      objectKey: 'covers/user/cover.webp',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledWith('https://upload.example.test/cover', {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/webp' },
    });

    const confirm = httpMock.expectOne((request) => request.url.endsWith('/media/cover/confirm'));
    expect(confirm.request.method).toBe('POST');
    expect(confirm.request.body).toEqual({ objectKey: 'covers/user/cover.webp' });
    confirm.flush({ coverUrl: 'https://cdn.example.test/final.webp' });

    await uploadPromise;

    expect(emitted).toHaveBeenCalledWith('https://cdn.example.test/final.webp');
    expect(component.imageSource()).toBeNull();
    expect(component.selectedFile()).toBeNull();
    expect(component.croppedBlob()).toBeNull();
    expect(component.isUploading()).toBe(false);
    fetchSpy.mockRestore();
  });

  it('keeps the crop available for retry when the object upload fails', async () => {
    const blob = new Blob(['cropped'], { type: 'image/webp' });
    component.onCropSaved(blob);
    component.imageSource.set('data:image/webp;base64,AA==');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);

    const uploadPromise = component.uploadCropped();
    const presign = httpMock.expectOne((request) => request.url.endsWith('/media/cover/presigned-url'));
    presign.flush({
      uploadUrl: 'https://upload.example.test/cover',
      mediaUrl: 'https://cdn.example.test/pending.webp',
      objectKey: 'covers/user/cover.webp',
    });

    await uploadPromise;
    fixture.detectChanges();

    expect(component.croppedBlob()).toBe(blob);
    expect(component.croppedPreviewUrl()).toBe('blob:cover-preview');
    expect(component.uploadError()).toBe(true);
    expect(component.isUploading()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'common.error',
    );
    fetchSpy.mockRestore();
  });

  it('revokes generated preview URLs when resetting', () => {
    component.imageSource.set('data:image/webp;base64,AA==');
    component.selectedFile.set(new File(['image'], 'cover.webp', { type: 'image/webp' }));
    component.onCropSaved(new Blob(['cropped'], { type: 'image/webp' }));

    component.reset();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cover-preview');
    expect(component.imageSource()).toBeNull();
    expect(component.selectedFile()).toBeNull();
    expect(component.croppedBlob()).toBeNull();
    expect(component.croppedPreviewUrl()).toBeNull();
    expect(component.uploadError()).toBe(false);
  });
});
