import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { vi } from 'vitest';
import { LottiePlayerComponent } from './lottie-player.component';

const loadAnimationMock = vi.fn((_options: unknown) => ({
  destroy: vi.fn(),
  setSpeed: vi.fn(),
  addEventListener: vi.fn(),
}));

vi.mock('lottie-web', () => ({
  default: {
    loadAnimation: (options: unknown) => loadAnimationMock(options),
  },
}));

@Component({
  template: `
    <app-lottie-player
      [animationData]="data()"
      [loop]="loop()"
      [autoplay]="autoplay()"
      [speed]="speed()"
      [playbackKey]="playbackKey()"
    />
  `,
  imports: [LottiePlayerComponent],
})
class TestHostComponent {
  data = signal<unknown>({ v: '5.5.0', layers: [] });
  loop = signal(true);
  autoplay = signal(true);
  speed = signal(1);
  playbackKey = signal('gift-1');
}

describe('LottiePlayerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    loadAnimationMock.mockClear();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LottiePlayerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('should create and render a host container', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('app-lottie-player > div');
    expect(el).toBeTruthy();
  });

  it('should load the animation with the provided data, loop, and autoplay inputs', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadAnimationMock).toHaveBeenCalledTimes(1);
    expect(loadAnimationMock.mock.calls[0]?.[0]).toMatchObject({
      loop: true,
      autoplay: true,
      renderer: 'svg',
    });
  });

  it('should not call loadAnimation when animationData is not provided', async () => {
    fixture.componentInstance.data.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadAnimationMock).not.toHaveBeenCalled();
  });

  it('should destroy the previous animation instance on component destroy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const instance = loadAnimationMock.mock.results[0].value as { destroy: () => void };
    const destroySpy = instance.destroy as ReturnType<typeof vi.fn>;

    fixture.destroy();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('should replace the animation when its data changes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const firstInstance = loadAnimationMock.mock.results[0].value as { destroy: () => void };
    const destroySpy = firstInstance.destroy as ReturnType<typeof vi.fn>;

    fixture.componentInstance.data.set({ v: '5.5.1', layers: [] });
    await fixture.whenStable();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(loadAnimationMock).toHaveBeenCalledTimes(2);
  });

  it('should restart unchanged animation data for a new playback key', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const firstInstance = loadAnimationMock.mock.results[0].value as { destroy: () => void };
    const destroySpy = firstInstance.destroy as ReturnType<typeof vi.fn>;

    fixture.componentInstance.playbackKey.set('gift-2');
    await fixture.whenStable();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(loadAnimationMock).toHaveBeenCalledTimes(2);
  });

  it('should fail safely when Lottie rejects animation data', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadAnimationMock.mockImplementationOnce(() => {
      throw new Error('Invalid animation');
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const player = fixture.debugElement.children[0].componentInstance as LottiePlayerComponent;
    expect(player.getAnimation()).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('Lottie SVG animation failed to render');
    consoleError.mockRestore();
  });
});
