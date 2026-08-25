import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    expect(trigger.getAttribute('tabindex')).toBeNull();
    expect(trigger.classList.contains('focus-visible:opacity-100')).toBe(true);
    expect(trigger.classList.contains('motion-reduce:transition-none')).toBe(true);
    expect(trigger.classList.contains('whitespace-normal')).toBe(true);
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

  it('stores the selected file, reads a local preview, and moves focus to Crop', async () => {
    const file = new File(['dummy image'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file] as unknown as FileList,
    });

    component.onFileSelected({ target: fileInput } as unknown as Event);
    await vi.waitFor(() => expect(component.imageSource()).toContain('data:image/jpeg'));
    fixture.detectChanges();
    await fixture.whenStable();

    const cropButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('common.crop'),
    ) as HTMLButtonElement | undefined;

    expect(component.selectedFile()).toBe(file);
    expect(component.isCropping()).toBe(false);
    expect(component.croppedBlob()).toBeNull();
    expect(cropButton).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(cropButton));
  });

  it('rejects unsupported file types with an accessible error and recoverable picker state', async () => {
    const file = new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file] as unknown as FileList,
    });

    component.onFileSelected({ target: input } as unknown as Event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedFile()).toBeNull();
    expect(component.imageSource()).toBeNull();
    expect(component.uploadError()).toBe(true);
    expect(input.value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'common.error',
    );

    const trigger = fixture.nativeElement.querySelector('.group button') as HTMLButtonElement;
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
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

  it('keeps editor actions touch-sized, wrap-safe, and direction-neutral at high zoom', () => {
    component.selectedFile.set(new File(['image'], 'cover.png', { type: 'image/png' }));
    component.imageSource.set('data:image/png;base64,AA==');
    fixture.detectChanges();

    const actionRow = fixture.nativeElement.querySelector('.mt-4') as HTMLElement;
    const buttons = Array.from(actionRow.querySelectorAll('button')) as HTMLButtonElement[];

    expect(actionRow.classList.contains('min-w-0')).toBe(true);
    expect(actionRow.classList.contains('sm:flex-wrap')).toBe(true);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.classList.contains('min-h-11')).toBe(true);
      expect(button.classList.contains('max-w-full')).toBe(true);
      expect(button.classList.contains('whitespace-normal')).toBe(true);
      expect(button.classList.contains('break-words')).toBe(true);
      expect(button.className).not.toMatch(/(?:^|\s)(?:ml|mr|left|right)-/);
    }
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
    await fixture.whenStable();

    expect(component.croppedBlob()).toBe(blob);
    expect(component.croppedPreviewUrl()).toBe('blob:cover-preview');
    expect(component.uploadError()).toBe(true);
    expect(component.isUploading()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'common.error',
    );

    const upload = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('common.upload'),
    ) as HTMLButtonElement | undefined;
    await vi.waitFor(() => expect(document.activeElement).toBe(upload));
    fetchSpy.mockRestore();
  });

  it('restores focus to the file trigger when the editor is reset', async () => {
    component.imageSource.set('data:image/webp;base64,AA==');
    component.selectedFile.set(new File(['image'], 'cover.webp', { type: 'image/webp' }));
    fixture.detectChanges();

    const cancel = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('common.cancel'),
    ) as HTMLButtonElement;
    cancel.focus();

    component.reset();
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector('.group button') as HTMLButtonElement;
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
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

  it('keeps upload progress in a polite atomic live region', () => {
    component.selectedFile.set(new File(['image'], 'cover.png', { type: 'image/png' }));
    component.imageSource.set('data:image/png;base64,AA==');
    fixture.detectChanges();

    const region = fixture.nativeElement.querySelector('[aria-live="polite"]') as HTMLElement;

    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });
});
