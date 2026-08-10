import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CoverPhotoCropperComponent } from './cover-photo-cropper.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { PipeTransform } from '@angular/core';
import { ImageCropperComponent } from 'ngx-image-cropper';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoCropperComponent', () => {
  let component: CoverPhotoCropperComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoverPhotoCropperComponent, ImageCropperComponent],
      providers: [{ provide: TranslatePipe, useClass: MockTranslatePipe }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CoverPhotoCropperComponent);
    component = fixture.componentInstance;

    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fixture.componentRef.setInput('imageFile', testFile);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should store cropped blob on imageCropped event', () => {
    const testBlob = new Blob(['cropped data'], { type: 'image/jpeg' });
    component.onImageCropped({ blob: testBlob });
    expect(component.croppedBlob()).toBe(testBlob);
  });

  it('should not update stored blob when null is passed', () => {
    const testBlob = new Blob(['cropped'], { type: 'image/jpeg' });
    component.onImageCropped({ blob: testBlob });
    expect(component.croppedBlob()).toBe(testBlob);

    // When blob is null, the guard `if (event.blob)` prevents update, so old value persists
    component.onImageCropped({ blob: null });
    expect(component.croppedBlob()).not.toBeNull();
  });

  it('should emit saveCover when save is called with a blob', () => {
    const emitted = vi.fn();
    component.saveCover.subscribe(emitted);

    const testBlob = new Blob(['data'], { type: 'image/jpeg' });
    component.croppedBlob.set(testBlob);

    component.save();
    expect(emitted).toHaveBeenCalledWith(testBlob);
  });

  it('should not emit saveCover when save is called without a blob', () => {
    const emitted = vi.fn();
    component.saveCover.subscribe(emitted);

    component.croppedBlob.set(null);

    component.save();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('should handle loadImageFailed gracefully', () => {
    expect(() => component.onLoadImageFailed()).not.toThrow();
  });

  it('should emit cancelCrop directly', () => {
    const emitted = vi.fn();
    component.cancelCrop.subscribe(emitted);

    component.cancelCrop.emit();
    expect(emitted).toHaveBeenCalled();
  });
});
