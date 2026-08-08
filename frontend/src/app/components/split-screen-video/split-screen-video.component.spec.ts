import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SplitScreenVideoComponent } from './split-screen-video.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

describe('SplitScreenVideoComponent', () => {
  let component: SplitScreenVideoComponent;
  let fixture: ComponentFixture<SplitScreenVideoComponent>;

  beforeEach(async () => {
    const mockI18n = jasmine.createSpyObj<I18nService>('I18nService', ['translate', 'currentLocale']);
    (mockI18n.translate as jasmine.Spy).and.callFake((key: string) => key);
    (mockI18n.currentLocale as jasmine.Spy).and.returnValue('en');

    await TestBed.configureTestingModule({
      imports: [SplitScreenVideoComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SplitScreenVideoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hostVideoUrl', 'https://example.com/host.mp4');
    fixture.componentRef.setInput('coHostVideoUrl', '');
    fixture.componentRef.setInput('hostName', 'Alice');
    fixture.componentRef.setInput('coHostName', 'Co-Host');
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should accept hostVideoUrl input', () => {
    expect(component.hostVideoUrl()).toBe('https://example.com/host.mp4');
  });

  it('should accept coHostVideoUrl input', () => {
    expect(component.coHostVideoUrl()).toBe('');
  });

  it('should accept hostName input', () => {
    expect(component.hostName()).toBe('Alice');
  });

  it('should accept coHostName input', () => {
    expect(component.coHostName()).toBe('Co-Host');
  });

  it('should compute hasCoHost as false when coHostVideoUrl is empty', () => {
    fixture.componentRef.setInput('coHostVideoUrl', '');
    fixture.detectChanges();
    expect(component.hasCoHost()).toBeFalse();
  });

  it('should compute hasCoHost as true when coHostVideoUrl is set', () => {
    fixture.componentRef.setInput('coHostVideoUrl', 'https://example.com/cohost.mp4');
    fixture.detectChanges();
    expect(component.hasCoHost()).toBeTrue();
  });

  it('should emit invite event when onInviteClick is called', () => {
    let emitted = false;
    component.invite.subscribe(() => {
      emitted = true;
    });
    component.onInviteClick();
    expect(emitted).toBeTrue();
  });

  it('should render host video element', () => {
    const hostVideo = fixture.nativeElement.querySelector('video[src="https://example.com/host.mp4"]');
    expect(hostVideo).toBeTruthy();
  });

  it('should render invite placeholder when no co-host', () => {
    fixture.componentRef.setInput('coHostVideoUrl', '');
    fixture.detectChanges();
    const inviteBtn = fixture.nativeElement.querySelector('button');
    expect(inviteBtn).toBeTruthy();
    expect(inviteBtn.textContent).toContain('splitScreen.inviteCoHostBtn');
  });

  it('should render co-host video when present', () => {
    fixture.componentRef.setInput('coHostVideoUrl', 'https://example.com/cohost.mp4');
    fixture.detectChanges();
    const coHostVideo = fixture.nativeElement.querySelector('video[src="https://example.com/cohost.mp4"]');
    expect(coHostVideo).toBeTruthy();
  });

  it('should display host name with host label', () => {
    fixture.componentRef.setInput('hostName', 'Alice');
    fixture.detectChanges();
    const statusEls = fixture.nativeElement.querySelectorAll('[role="status"]');
    const hostStatus = Array.from(statusEls).find((el: Element) =>
      el.textContent?.includes('Alice'),
    ) as HTMLElement | undefined;
    expect(hostStatus).toBeTruthy();
    expect(hostStatus!.textContent).toContain('splitScreen.hostLabel');
  });

  it('should have proper ARIA roles for accessibility', () => {
    const regions = fixture.nativeElement.querySelectorAll('[role="region"]');
    expect(regions.length).toBeGreaterThanOrEqual(2);
    const group = fixture.nativeElement.querySelector('[role="group"]');
    expect(group).toBeTruthy();
    expect(group.getAttribute('aria-label')).toBe('splitScreen.hostVideoAria');
  });
});