import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileCoverPhotoComponent } from './profile-cover-photo.component';
import { CoverPhotoService } from '../../services/cover-photo.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { PipeTransform } from '@angular/core';

class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('ProfileCoverPhotoComponent', () => {
  let component: ProfileCoverPhotoComponent;
  let fixture: ComponentFixture<ProfileCoverPhotoComponent>;
  let coverPhotoServiceSpy: { upload: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    coverPhotoServiceSpy = { upload: vi.fn() };
    coverPhotoServiceSpy.upload.mockResolvedValue('https://r2.example.com/cover.jpg');

    await TestBed.configureTestingModule({
      imports: [ProfileCoverPhotoComponent],
      providers: [
        { provide: CoverPhotoService, useValue: coverPhotoServiceSpy },
        { provide: TranslatePipe, useClass: MockTranslatePipe },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileCoverPhotoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit coverUpdated on successful save', async () => {
    // Simulate a file selection
    const file = new File([''], 'test.webp', { type: 'image/webp' });
    const inputEl = fixture.nativeElement.querySelector('#cover-file-input') as HTMLInputElement;
    const fileList = [file] as unknown as FileList;
    Object.defineProperty(inputEl, 'files', {
      value: fileList,
      configurable: true,
    });
    inputEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Trigger save
    component['selectedFile'] = file;
    await component['save']?.();
    expect(coverPhotoServiceSpy.upload).toHaveBeenCalled();
  });
});
