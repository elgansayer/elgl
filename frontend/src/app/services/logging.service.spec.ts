import { TestBed } from '@angular/core/testing';
import { LoggingService } from './logging.service';
import { CrashReportService } from './crash-report.service';

describe('LoggingService', () => {
  let service: LoggingService;
  let crashReportSpy: jasmine.SpyObj<CrashReportService>;

  beforeEach(() => {
    crashReportSpy = jasmine.createSpyObj('CrashReportService', ['reportCrash']);
    crashReportSpy.reportCrash.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [LoggingService, { provide: CrashReportService, useValue: crashReportSpy }],
    });

    service = TestBed.inject(LoggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose all severity methods', () => {
    expect(typeof service.debug).toBe('function');
    expect(typeof service.info).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.error).toBe('function');
    expect(typeof service.fatal).toBe('function');
  });

  it('should forward ERROR-level logs to crash reporting', () => {
    service.error('Test error', 'TestContext');
    expect(crashReportSpy.reportCrash).toHaveBeenCalled();
  });

  it('should forward FATAL-level logs to crash reporting', () => {
    service.fatal('Critical failure', 'FatalContext');
    expect(crashReportSpy.reportCrash).toHaveBeenCalled();
  });

  it('should not forward DEBUG-level logs to crash reporting', () => {
    service.debug('Debug message', 'DebugContext');
    expect(crashReportSpy.reportCrash).not.toHaveBeenCalled();
  });

  it('should not forward INFO-level logs to crash reporting', () => {
    service.info('Info message', 'InfoContext');
    expect(crashReportSpy.reportCrash).not.toHaveBeenCalled();
  });

  it('should not forward WARN-level logs to crash reporting', () => {
    service.warn('Warning message', 'WarnContext');
    expect(crashReportSpy.reportCrash).not.toHaveBeenCalled();
  });

  it('should include context in crash report', () => {
    service.error('Failure occurred', 'ChatService');

    const reportedError = crashReportSpy.reportCrash.calls.mostRecent().args[0] as Error;
    const reportedContext = crashReportSpy.reportCrash.calls.mostRecent().args[1];

    expect(reportedError.message).toBe('Failure occurred');
    expect(reportedError.name).toBe('ChatService');
    expect(reportedContext.component).toBe('ChatService');
  });

  it('should handle crash reporting failure gracefully', async () => {
    crashReportSpy.reportCrash.and.returnValue(Promise.reject(new Error('Network failure')));

    // Should not throw
    expect(() => service.error('Test error')).not.toThrow();
  });
});
