import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VideoClassroomErrorBoundaryComponent,
  VideoClassroomErrorContext,
} from './video-classroom-error-boundary.component';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { AuthService } from '../../services/auth.service';

describe.skip('VideoClassroomErrorBoundaryComponent', () => {
  let fixture: ComponentFixture<VideoClassroomErrorBoundaryComponent>;
  let component: VideoClassroomErrorBoundaryComponent;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      imports: [VideoClassroomErrorBoundaryComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VideoClassroomErrorBoundaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeDefined();
  });

  it('should render children when no error has occurred', () => {
    const el = fixture.nativeElement as HTMLElement;
    // No h2 fallback heading should appear when there is no error
    expect(el.querySelector('h3')).toBeNull();
  });

  it('should display fallback UI when an error is captured', () => {
    component.captureError(new Error('LiveKit connection failed'));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent).toContain('videoClassroomErrorBoundary.title');
    expect(el.textContent).toContain('LiveKit connection failed');
  });

  it('should reset error state when resetError is called', () => {
    component.captureError(new Error('Temporary rendering error'));
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
  });

  it('should POST crash report to analytics endpoint on captureError', () => {
    const ctx: VideoClassroomErrorContext = {
      component: 'VideoRoom',
      operation: 'connect',
      roomId: 'room-abc',
      roomName: 'Spanish Classroom',
      isHost: true,
      livekitConnected: false,
    };

    fixture.componentRef.setInput('context', ctx);
    fixture.detectChanges();

    component.captureError(new Error('SFU connection refused'));

    // Should post to the analytics endpoint via the error handler service
    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('SFU connection refused');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('video-classroom');
    expect(metadata['roomId']).toBe('room-abc');
    expect(metadata['renderingError']).toBe(true);
    expect(metadata['boundaryContext']).toBe('VideoRoom');
    req.flush({ status: 'logged' });
  });

  it('should emit retry output when resetError is called', () => {
    const onRetry = vi.fn();
    component.retry.subscribe(onRetry);

    component.captureError(new Error('Test error'));
    component.resetError();

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should show reported message after manual crash report', () => {
    component.captureError(new Error('Screen share crash'));
    fixture.detectChanges();

    const reportButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button:last-of-type',
    ) as HTMLButtonElement;
    reportButton?.click();
    fixture.detectChanges();

    expect(component.reportedMessage()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('videoClassroomErrorBoundary.reportedMessage');

    // Flush 2 POST requests: captureError + manual report
    httpTesting.expectOne('/api/analytics/client-error').flush({ status: 'logged' });
    httpTesting.expectOne('/api/analytics/client-error').flush({ status: 'logged' });
  });

  it('should increment error count on repeated errors', () => {
    component.captureError(new Error('First error'));
    component.captureError(new Error('Second error'));
    component.captureError(new Error('Third error'));

    expect(component.errorCount()).toBe(3);
    expect(component.errorDetailHint()).toContain('Error count: 3');

    // Flush all POST requests
    httpTesting.match('/api/analytics/client-error').forEach((req) => {
      req.flush({ status: 'logged' });
    });
  });

  it('buildCrashPayload should produce structured crash payload', () => {
    const error = new Error('Video stream consumer disconnected');
    Object.defineProperty(error, 'stack', {
      value:
        'Error: Video stream consumer disconnected\n    at consumer.onDisconnect (video-room.ts:156:12)',
    });

    const ctx: VideoClassroomErrorContext = {
      component: 'VideoRoom',
      operation: 'subscribeTrack',
      roomId: 'room-xyz',
      livekitConnected: true,
    };

    const payload = VideoClassroomErrorBoundaryComponent.buildCrashPayload(error, ctx);

    expect(payload.errorName).toBe('Error');
    expect(payload.errorMessage).toBe('Video stream consumer disconnected');
    expect(payload.component).toBe('VideoRoom');
    expect(payload.operation).toBe('subscribeTrack');
    expect(payload.context.roomId).toBe('room-xyz');
    expect(payload.stackFrames).toHaveLength(1);
    expect(payload.stackFrames![0]).toEqual(
      expect.objectContaining({
        functionName: 'consumer.onDisconnect',
        fileName: 'video-room.ts',
        lineNumber: 156,
        columnNumber: 12,
      }),
    );
  });
});