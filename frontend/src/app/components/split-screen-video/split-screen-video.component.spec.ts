import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SplitScreenVideoComponent } from './split-screen-video.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

// Minimal mock for I18nService signals used by TranslatePipe
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
  });

  it('should compute hasCoHost as false by default (empty coHostVideoUrl)', () => {
    expect(component.hasCoHost()).toBe(false);
  });

  it('should render the host placeholder by default', () => {
    const videos = fixture.nativeElement.querySelectorAll('video');
    expect(videos.length).toBe(0);
  });

  it('should render the invite button when coHostVideoUrl is empty', () => {
    const inviteBtn = fixture.nativeElement.querySelector('button');
    expect(inviteBtn).toBeTruthy();
    expect(inviteBtn.textContent?.trim()).toContain('splitScreen.inviteCoHostBtn');
  });

  it('should render the host badge with the default host name', () => {
    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Host');
  });

  it('should emit invite when the invite button is clicked', () => {
    let invited = false;
    component.invite.subscribe(() => { invited = true; });

    const inviteBtn = fixture.nativeElement.querySelector('button');
    inviteBtn!.click();
    expect(invited).toBe(true);
  });

  it('should use flex-col on mobile and md:flex-row on desktop for responsive layout', () => {
    const group = fixture.nativeElement.querySelector('[role="group"]');
    expect(group.classList.contains('flex-col')).toBe(true);
    expect(group.classList.contains('md:flex-row')).toBe(true);
  });

  it('should render the SVG plus icon inside the invite button', () => {
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
