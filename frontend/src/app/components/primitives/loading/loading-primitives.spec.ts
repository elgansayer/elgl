import { TestBed } from '@angular/core/testing';
import { LoadingIndicatorComponent } from './loading-indicator.component';
import { LoadingStatePanelComponent } from './loading-state-panel.component';
import { ProgressBarComponent } from './progress-bar.component';
import { RelaySkeletonComponent } from './skeleton.component';

describe('Relay loading primitives', () => {
  it('renders bounded decorative skeletons outside the accessibility tree', async () => {
    const fixture = TestBed.createComponent(RelaySkeletonComponent);
    fixture.componentRef.setInput('count', 50);
    fixture.componentRef.setInput('shape', 'circle');
    fixture.componentRef.setInput('width', '2rem');
    fixture.componentRef.setInput('height', '2rem');
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.relay-skeleton')).toHaveLength(20);
    expect(
      host.querySelector('.relay-skeleton--circle'),
    ).not.toBeNull();
  });

  it('labels an indeterminate loading indicator without announcing decoration', () => {
    const fixture = TestBed.createComponent(LoadingIndicatorComponent);
    fixture.componentRef.setInput('label', 'Loading profile');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-label')).toBe('Loading profile');
    expect(
      host.querySelector('.relay-loading-indicator__spinner')?.getAttribute(
        'aria-hidden',
      ),
    ).toBe('true');
  });

  it('exposes real determinate progress and clamps invalid values', () => {
    const fixture = TestBed.createComponent(ProgressBarComponent);
    fixture.componentRef.setInput('label', 'Uploading recording');
    fixture.componentRef.setInput('value', 140);
    fixture.componentRef.setInput('max', 100);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('role')).toBe('progressbar');
    expect(host.getAttribute('aria-valuenow')).toBe('100');
    expect(host.getAttribute('aria-valuemax')).toBe('100');
    expect(
      (host.querySelector('.relay-progress__value') as HTMLElement).style
        .inlineSize,
    ).toBe('100%');
  });

  it('omits a fabricated percentage for indeterminate progress', () => {
    const fixture = TestBed.createComponent(ProgressBarComponent);
    fixture.componentRef.setInput('label', 'Processing media');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.hasAttribute('aria-valuenow')).toBe(false);
    expect(
      host.querySelector('.relay-progress__value--indeterminate'),
    ).not.toBeNull();
  });

  it('uses an assertive alert only for unavailable and error states', () => {
    const unavailable = TestBed.createComponent(LoadingStatePanelComponent);
    unavailable.componentRef.setInput('state', 'unavailable');
    unavailable.componentRef.setInput('title', 'Profile unavailable');
    unavailable.detectChanges();

    expect(
      (unavailable.nativeElement as HTMLElement).getAttribute('role'),
    ).toBe('alert');
    expect(
      (unavailable.nativeElement as HTMLElement).getAttribute('aria-live'),
    ).toBe('assertive');
    expect(
      (unavailable.nativeElement as HTMLElement).hasAttribute('aria-busy'),
    ).toBe(false);

    const loading = TestBed.createComponent(LoadingStatePanelComponent);
    loading.componentRef.setInput('state', 'loading');
    loading.componentRef.setInput('title', 'Loading profile');
    loading.detectChanges();

    expect((loading.nativeElement as HTMLElement).getAttribute('role')).toBe(
      'status',
    );
    expect(
      (loading.nativeElement as HTMLElement).getAttribute('aria-busy'),
    ).toBe('true');
  });
});
