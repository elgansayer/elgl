import { PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageCropperComponent } from 'ngx-image-cropper';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoCropperComponent } from './cover-photo-cropper.component';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('CoverPhotoCropperComponent', () => {
  let component: CoverPhotoCropperComponent;
  let fixture: ComponentFixture<CoverPhotoCropperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoverPhotoCropperComponent, ImageCropperComponent],
      providers: [{ provide: TranslatePipe, useClass: MockTranslatePipe }],
    }).compileComponents();

    fixture = TestBed.createComponent(CoverPhotoCropperComponent);
    component = fixture.componentInstance;

    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    fixture.componentRef.setInput('imageFile', testFile);
    fixture.detectChanges();
  });

  it('should create with the Spartan dialog open', () => {
    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('open');
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

    component.onImageCropped({ blob: null });
    expect(component.croppedBlob()).toBe(testBlob);
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

  it('should emit cancellation when the Spartan dialog is dismissed', () => {
    const emitted = vi.fn();
    component.cancelCrop.subscribe(emitted);

    component.onDialogStateChanged('closed');

    expect(component.dialogState()).toBe('closed');
    expect(emitted).toHaveBeenCalledOnce();
  });
  it('should close and emit cancellation from the cancel action', () => {
    const emitted = vi.fn();
    component.cancelCrop.subscribe(emitted);

    component.cancel();

    expect(component.dialogState()).toBe('closed');
    expect(emitted).toHaveBeenCalledOnce();
  });

  it('should not emit duplicate cancellation after already closing', () => {
    const emitted = vi.fn();
    component.cancelCrop.subscribe(emitted);

    component.cancel();
    component.onDialogStateChanged('closed');
    component.cancel();

    expect(emitted).toHaveBeenCalledOnce();
  });

  it('should handle loadImageFailed gracefully', () => {
    expect(() => component.onLoadImageFailed()).not.toThrow();
  });
});
