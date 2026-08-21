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

  it('uses Relay surface tokens and mobile-first visibility for the upload trigger', () => {
    const frame = fixture.nativeElement.querySelector('.group') as HTMLElement;
    const trigger = frame.querySelector('[role="button"]') as HTMLElement;

    expect(frame.classList.contains('rounded-card')).toBe(true);
    expect(frame.classList.contains('border-surface-100')).toBe(true);
    expect(frame.classList.contains('bg-surface-200')).toBe(true);
    expect(frame.classList.contains('shadow-card')).toBe(true);
    expect(frame.classList.contains('h-40')).toBe(true);
    expect(frame.classList.contains('sm:h-48')).toBe(true);
    expect(frame.classList.contains('md:h-64')).toBe(true);

    expect(trigger.classList.contains('bg-surface-500/90')).toBe(true);
    expect(trigger.classList.contains('text-text-primary')).toBe(true);
    expect(trigger.classList.contains('opacity-100')).toBe(true);
    expect(trigger.classList.contains('sm:opacity-0')).toBe(true);
    expect(trigger.className).not.toContain('bg-black');
    expect(trigger.className).not.toContain('text-white');
  });

  it('uses Relay crop tokens and stacks Spartan actions at the mobile baseline', () => {
    component.imageSource.set('data:image/jpeg;base64,AA==');
    component.imageWidth.set(300);
    component.imageHeight.set(100);
    component.cropBox.set({ x: 30, y: 10, width: 240, height: 80 });
    component.isCropping.set(true);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img[alt="Image to crop"]') as HTMLElement;
    const cropSurface = image.parentElement as HTMLElement;
    const maskedRect = fixture.nativeElement.querySelector('svg rect[mask]') as SVGRectElement;
    const cropBox = fixture.nativeElement.querySelector('.border-primary') as HTMLElement;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    const actionRow = buttons[0].parentElement as HTMLElement;

    expect(cropSurface.classList.contains('rounded-card')).toBe(true);
    expect(cropSurface.classList.contains('border-surface-100')).toBe(true);
    expect(cropSurface.classList.contains('bg-surface-200')).toBe(true);
    expect(cropSurface.classList.contains('shadow-card')).toBe(true);
    expect(maskedRect.getAttribute('fill')).toBe('rgb(var(--surface-900-rgb) / 0.55)');
    expect(cropBox).toBeTruthy();

    expect(actionRow.classList.contains('flex-col')).toBe(true);
    expect(actionRow.classList.contains('sm:flex-row')).toBe(true);
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button.classList.contains('w-full')).toBe(true);
      expect(button.classList.contains('sm:w-auto')).toBe(true);
    }
  });

  it('should have currentCoverUrl signal defaulted to empty', () => {
    expect(component.currentCoverUrl()).toBe('');
  });

  it('should open the file picker from the keyboard with Space', () => {
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
    const click = vi.spyOn(fileInput, 'click');
    const trigger = fixture.nativeElement.querySelector('[role="button"]');
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });

    trigger.dispatchEvent(event);

    expect(click).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
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
