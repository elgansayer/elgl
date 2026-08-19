import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewTransitionService } from './view-transition.service';

function transition() {
  return {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
  };
}

describe('ViewTransitionService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('runs immediately when the API is unsupported', async () => {
    const documentMock = {
      defaultView: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
    } as unknown as Document;
    TestBed.configureTestingModule({
      providers: [
        ViewTransitionService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(ViewTransitionService);
    const update = vi.fn();

    await service.run(update);

    expect(update).toHaveBeenCalledOnce();
    expect(service.isSupported()).toBe(false);
  });

  it('does not create snapshots when reduced motion is requested', async () => {
    const startViewTransition = vi.fn();
    const documentMock = {
      defaultView: {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      },
      startViewTransition,
    } as unknown as Document;
    TestBed.configureTestingModule({
      providers: [
        ViewTransitionService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(ViewTransitionService);
    const update = vi.fn();

    await service.run(update);

    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('uses the native API and waits for the update and visual transition', async () => {
    const nativeTransition = transition();
    const update = vi.fn();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return nativeTransition;
    });
    const documentMock = {
      defaultView: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      startViewTransition,
    } as unknown as Document;
    TestBed.configureTestingModule({
      providers: [
        ViewTransitionService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(ViewTransitionService);

    await service.run(update);

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(nativeTransition.skipTransition).not.toHaveBeenCalled();
  });

  it('skips a previous active transition before replacing it', async () => {
    let resolveFirst: (() => void) | undefined;
    const first = {
      ...transition(),
      finished: new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }),
    };
    const second = transition();
    const transitions = [first, second];
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return transitions.shift()!;
    });
    const documentMock = {
      defaultView: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      startViewTransition,
    } as unknown as Document;
    TestBed.configureTestingModule({
      providers: [
        ViewTransitionService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(ViewTransitionService);

    const firstRun = service.run(() => undefined);
    await Promise.resolve();
    await service.run(() => undefined);

    expect(first.skipTransition).toHaveBeenCalledOnce();
    if (resolveFirst) {
      (resolveFirst as () => void)();
    }
    await firstRun;
  });

  it('can disable snapshots for sensitive content explicitly', async () => {
    const startViewTransition = vi.fn();
    const documentMock = {
      defaultView: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      startViewTransition,
    } as unknown as Document;
    TestBed.configureTestingModule({
      providers: [
        ViewTransitionService,
        { provide: DOCUMENT, useValue: documentMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = TestBed.inject(ViewTransitionService);
    const update = vi.fn();

    await service.run(update, { disabled: true });

    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});
