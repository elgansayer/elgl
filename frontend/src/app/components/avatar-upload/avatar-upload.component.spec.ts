import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarUploadComponent } from './avatar-upload.component';
import { I18nService } from '../../services/i18n.service';
import { MediaService } from '../../services/media.service';
import { SupabaseService } from '../../services/supabase.service';

class MockI18nService {
  translate(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

class MockMediaService {}

class MockSupabaseService {
  async uploadAvatar(_file: File): Promise<string> {
    return 'https://example.com/avatar.png';
  }
}

type SignalRef<T> = {
  (): T;
  set: (value: T) => void;
};

type ComponentWithPrivates = {
  naturalWidth: SignalRef<number>;
  naturalHeight: SignalRef<number>;
  displayWidth: SignalRef<number>;
  displayHeight: SignalRef<number>;
  cropX: SignalRef<number>;
  cropY: SignalRef<number>;
  cropSize: SignalRef<number>;
};

type CanvasMock = {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
};

describe('AvatarUploadComponent', () => {
  let fixture: ComponentFixture<AvatarUploadComponent>;
  let component: AvatarUploadComponent;
  let supabaseInstance: MockSupabaseService;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarUploadComponent],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: MediaService, useClass: MockMediaService },
        { provide: SupabaseService, useClass: MockSupabaseService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    supabaseInstance = TestBed.inject(SupabaseService) as MockSupabaseService;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load image preview and natural dimensions when a file is selected', async () => {
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:preview');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    class FakeImage {
      naturalWidth = 320;
      naturalHeight = 240;
      onload: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const file = new File([new Uint8Array([1, 2, 3])], 'test.png', {
      type: 'image/png',
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    const event = { target: input } as unknown as Event;

    await component.onFileSelected(event);

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(component.previewUrl()).toBe('blob:preview');
    expect(component.naturalWidth()).toBe(320);
    expect((component as unknown as ComponentWithPrivates).naturalHeight()).toBe(240);
  });

  it('should compute initial centred crop when image is loaded on screen', () => {
    const img = new Image();
    Object.defineProperty(img, 'clientWidth', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(img, 'clientHeight', {
      value: 120,
      configurable: true,
    });

    component.onImageLoad({ target: img } as unknown as Event);

    expect((component as unknown as ComponentWithPrivates).displayWidth()).toBe(200);
    expect((component as unknown as ComponentWithPrivates).displayHeight()).toBe(120);
    expect(component.cropX()).toBe(40);
    expect(component.cropY()).toBe(0);
    expect(component.cropSize()).toBe(120);
  });

  it('should update crop rectangle while dragging', () => {
    const target = document.createElement('div');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 120,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
    } as DOMRect);

    const firstEvent = {
      clientX: 50,
      clientY: 40,
      currentTarget: target,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;
    component.onImageMouseDown(firstEvent);

    expect((component as unknown as { isDragging: boolean }).isDragging).toBe(true);

    const moveEvent = {
      clientX: 150,
      clientY: 80,
      currentTarget: target,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;
    component.onImageMouseMove(moveEvent);

    expect(component.cropX()).toBe(50);
    expect(component.cropY()).toBe(40);
    expect(component.cropSize()).toBe(40);
  });

  it('should crop the image, upload it, and emit the resulting URL', async () => {
    // Prepare internal signals
    const privates = component as unknown as ComponentWithPrivates;
    privates.naturalWidth.set(400);
    privates.naturalHeight.set(300);
    privates.displayWidth.set(200);
    privates.displayHeight.set(150);
    privates.cropX.set(50);
    privates.cropY.set(40);
    privates.cropSize.set(80);

    // Provide a fake image element so drawImage can accept it
    const fakeImage = { naturalWidth: 400, naturalHeight: 300 } as HTMLImageElement;
    (component as unknown as { imageElement: HTMLImageElement }).imageElement =
      fakeImage;

    // Mock the canvas creation
    const drawImageMock = vi.fn();
    const canvasMock: CanvasMock = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: drawImageMock })),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(['cropped'], { type: 'image/png' }));
      }),
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return canvasMock as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });

    // Spy on the supabase upload call
    const uploadSpy = vi
      .spyOn(supabaseInstance, 'uploadAvatar')
      .mockResolvedValue('https://example.com/uploaded.png');

    const emittedValues: string[] = [];
    const sub = component.avatarUrl.subscribe((url) => emittedValues.push(url));

    await component.confirmCrop();

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const uploadedFile = uploadSpy.mock.calls[0][0] as File;
    expect(uploadedFile.name).toBe('avatar-cropped.png');
    expect(uploadedFile.type).toBe('image/png');
    expect(emittedValues).toEqual(['https://example.com/uploaded.png']);

    sub.unsubscribe();
    createElementSpy.mockRestore();
  });

  it('should handle upload errors and reset uploading state', async () => {
    const privates = component as unknown as ComponentWithPrivates;
    privates.naturalWidth.set(400);
    privates.naturalHeight.set(300);
    privates.displayWidth.set(200);
    privates.displayHeight.set(150);
    privates.cropX.set(50);
    privates.cropY.set(40);
    privates.cropSize.set(80);

    const fakeImage = { naturalWidth: 400, naturalHeight: 300 } as HTMLImageElement;
    (component as unknown as { imageElement: HTMLImageElement }).imageElement =
      fakeImage;

    const canvasMock: CanvasMock = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toBlob: vi.fn((callback: BlobCallback) =>
        callback(new Blob(['fail'], { type: 'image/png' })),
      ),
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return canvasMock as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    });

    vi.spyOn(supabaseInstance, 'uploadAvatar').mockRejectedValue(
      new Error('upload failed'),
    );

    await component.confirmCrop();

    expect(component.uploading()).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
