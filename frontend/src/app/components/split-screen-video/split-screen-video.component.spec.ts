import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SplitScreenVideoComponent } from './split-screen-video.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  readonly currentLang = signal('en');
  readonly fallbackLang = signal('en');
  translate(key: string): string {
    return key;
  }
}

describe('SplitScreenVideoComponent', () => {
  let fixture: ComponentFixture<SplitScreenVideoComponent>;
  let component: SplitScreenVideoComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitScreenVideoComponent, TranslatePipe],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SplitScreenVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have signal inputs with correct defaults', () => {
    expect(component.hostVideoUrl()).toBe('');
    expect(component.coHostVideoUrl()).toBe('');
    expect(component.hostName()).toBe('Host');
    expect(component.coHostName()).toBe('Co-Host');
    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(false);
  });

  it('should compute hasCoHost as false by default when coHostVideoUrl is empty', () => {
    expect(component.hasCoHost()).toBe(false);
  });

  it('should compute hasCoHost as true when coHostVideoUrl is set', () => {
    fixture.componentRef.setInput('coHostVideoUrl', 'https://example.com/cohost.mp4');
    expect(component.hasCoHost()).toBe(true);
  });

  it('should allow explicit hasCoHostOverride input when coHostVideoUrl is empty', () => {
    fixture.componentRef.setInput('hasCoHostOverride', true);
    expect(component.hasCoHost()).toBe(true);
  });

  it('should render the host placeholder by default when not loading and hostVideoUrl is empty', () => {
    const videos = fixture.nativeElement.querySelectorAll('video');
    expect(videos.length).toBe(0);

    const waitingText = fixture.nativeElement.querySelector('p');
    expect(waitingText?.textContent?.trim()).toContain('videoRoom.waitingForHost');
  });

  it('should render the host video element when hostVideoUrl is set', () => {
    fixture.componentRef.setInput('hostVideoUrl', 'https://example.com/host.mp4');
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe('https://example.com/host.mp4');
    expect(video?.getAttribute('aria-label')).toBe('splitScreen.hostVideoAria');
  });

  it('should render the host skeleton loader when isLoading is true', () => {
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const skeleton = fixture.nativeElement.querySelector('app-skeleton-loader');
    expect(skeleton).toBeTruthy();

    const loadingText = fixture.nativeElement.querySelector('p[aria-live="polite"]');
    expect(loadingText?.textContent?.trim()).toContain('splitScreen.loadingHost');
  });

  it('should render the host badge with hostName and translated hostBadge', () => {
    fixture.componentRef.setInput('hostName', 'Professor Chen');
    fixture.detectChanges();

    const statuses = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(statuses[0]?.textContent).toContain('Professor Chen');
    expect(statuses[0]?.textContent).toContain('splitScreen.hostBadge');
  });

  it('should render the invite button when coHost is false', () => {
    const inviteBtn = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    expect(inviteBtn).toBeTruthy();
    expect(inviteBtn?.getAttribute('type')).toBe('button');
    expect(inviteBtn?.getAttribute('aria-label')).toBe('splitScreen.inviteCoHostAria');
    expect(inviteBtn?.textContent?.trim()).toContain('splitScreen.inviteCoHostBtn');
  });

  it('should emit invite when the invite button is clicked', () => {
    let invited = false;
    component.invite.subscribe(() => {
      invited = true;
    });

    const inviteBtn = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    inviteBtn?.click();
    expect(invited).toBe(true);
  });

  it('should render the SVG plus icon inside the invite button with aria-hidden', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render co-host video and badge in split-screen when coHostVideoUrl is present', () => {
    fixture.componentRef.setInput('hostVideoUrl', 'https://example.com/host.mp4');
    fixture.componentRef.setInput('coHostVideoUrl', 'https://example.com/cohost.mp4');
    fixture.componentRef.setInput('coHostName', 'Dr. Maria');
    fixture.detectChanges();

    const regions = fixture.nativeElement.querySelectorAll('[role="region"]');
    expect(regions.length).toBe(2);

    const videos = fixture.nativeElement.querySelectorAll('video');
    expect(videos.length).toBe(2);
    expect(videos[1].getAttribute('src')).toBe('https://example.com/cohost.mp4');
    expect(videos[1].getAttribute('aria-label')).toBe('splitScreen.coHostVideoAria');

    const statuses = fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(statuses.length).toBe(2);
    expect(statuses[1].textContent).toContain('Dr. Maria');
    expect(statuses[1].textContent).toContain('splitScreen.coHostBadge');
  });

  it('should not render duplicate co-host tiles when co-host video is present', () => {
    fixture.componentRef.setInput('coHostVideoUrl', 'https://example.com/cohost.mp4');
    fixture.detectChanges();

    const coHostRegions = Array.from(
      fixture.nativeElement.querySelectorAll('[role="region"]') as NodeListOf<HTMLElement>,
    ).filter((el) => el.getAttribute('aria-label') === 'splitScreen.coHostVideoAria');

    expect(coHostRegions.length).toBe(1);
  });

  it('should render co-host waiting state when coHost is true but coHostVideoUrl is empty', () => {
    fixture.componentRef.setInput('hasCoHostOverride', true);
    fixture.componentRef.setInput('coHostVideoUrl', '');
    fixture.detectChanges();

    const paragraphs = Array.from(
      fixture.nativeElement.querySelectorAll('p') as NodeListOf<HTMLElement>,
    );
    const coHostWaiting = paragraphs.find((p) =>
      p.textContent?.includes('videoRoom.waitingForCoHost'),
    );
    expect(coHostWaiting).toBeTruthy();
  });

  it('should render co-host skeleton loader when coHost is true and isLoading is true', () => {
    fixture.componentRef.setInput('hasCoHostOverride', true);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const loadingTexts = Array.from(
      fixture.nativeElement.querySelectorAll(
        'p[aria-live="polite"]',
      ) as NodeListOf<HTMLElement>,
    );
    const coHostLoading = loadingTexts.find((p) =>
      p.textContent?.includes('splitScreen.loadingCoHost'),
    );
    expect(coHostLoading).toBeTruthy();
  });

  it('should render error state with retry action when hasError is true', () => {
    fixture.componentRef.setInput('hasError', true);
    fixture.detectChanges();

    const errorRegion = fixture.nativeElement.querySelector('[role="region"]') as HTMLElement | null;
    expect(errorRegion?.getAttribute('aria-label')).toBe('splitScreen.streamErrorAria');

    let retried = false;
    component.retry.subscribe(() => {
      retried = true;
    });

    component.onRetryClick();
    expect(retried).toBe(true);
  });

  it('should use responsive flex-col on mobile and md:flex-row on desktop with accessible group label', () => {
    const group = fixture.nativeElement.querySelector('[role="group"]') as HTMLElement | null;
    expect(group).toBeTruthy();
    expect(group?.classList.contains('flex-col')).toBe(true);
    expect(group?.classList.contains('md:flex-row')).toBe(true);
    expect(group?.getAttribute('aria-label')).toBe('splitScreen.splitScreenVideoAria');
  });
});
