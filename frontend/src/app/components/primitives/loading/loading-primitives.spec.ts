import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadingIndicatorComponent } from './loading-indicator.component';
import { LoadingStateKind, LoadingStatePanelComponent } from './loading-state-panel.component';
import { ProgressBarComponent } from './progress-bar.component';
import { RelaySkeletonComponent, SkeletonShape } from './skeleton.component';

@Component({
  standalone: true,
  imports: [RelaySkeletonComponent],
  template: `
    <app-skeleton [count]="count()" [shape]="shape()" [width]="width()" [height]="height()" />
  `,
})
class SkeletonHostComponent {
  readonly count = signal<number | string>(50);
  readonly shape = signal<SkeletonShape>('circle');
  readonly width = signal('2rem');
  readonly height = signal('2rem');
}

@Component({
  standalone: true,
  imports: [LoadingIndicatorComponent],
  template: ` <app-loading-indicator [label]="label()" [showLabel]="showLabel()" /> `,
})
class IndicatorHostComponent {
  readonly label = signal('Loading profile');
  readonly showLabel = signal(false);
}

@Component({
  standalone: true,
  imports: [ProgressBarComponent],
  template: ` <app-progress-bar [label]="label()" [value]="value()" [max]="max()" /> `,
})
class ProgressHostComponent {
  readonly label = signal('Uploading recording');
  readonly value = signal<number | null>(140);
  readonly max = signal(100);
}

@Component({
  standalone: true,
  imports: [LoadingStatePanelComponent],
  template: ` <app-loading-state-panel [state]="state()" [title]="title()" /> `,
})
class StatePanelHostComponent {
  readonly state = signal<LoadingStateKind>('unavailable');
  readonly title = signal('Profile unavailable');
}

describe('Relay loading primitives', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SkeletonHostComponent,
        IndicatorHostComponent,
        ProgressHostComponent,
        StatePanelHostComponent,
        LoadingIndicatorComponent,
        LoadingStatePanelComponent,
        ProgressBarComponent,
        RelaySkeletonComponent,
      ],
    }).compileComponents();
  });

  it('renders bounded decorative skeletons outside the accessibility tree', async () => {
    const fixture = TestBed.createComponent(SkeletonHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const skeletonGroup = host.querySelector('app-skeleton') as HTMLElement;
    expect(skeletonGroup.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.relay-skeleton')).toHaveLength(20);
    expect(host.querySelector('.relay-skeleton--circle')).not.toBeNull();
  });

  it('labels an indeterminate loading indicator without announcing decoration', () => {
    const fixture = TestBed.createComponent(IndicatorHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const indicator = host.querySelector('app-loading-indicator') as HTMLElement;
    expect(indicator.getAttribute('role')).toBe('status');
    expect(indicator.getAttribute('aria-label')).toBe('Loading profile');
    expect(
      host.querySelector('.relay-loading-indicator__spinner')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('exposes real determinate progress and clamps invalid values', () => {
    const fixture = TestBed.createComponent(ProgressHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const progress = host.querySelector('app-progress-bar') as HTMLElement;
    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect((host.querySelector('.relay-progress__value') as HTMLElement).style.inlineSize).toBe(
      '100%',
    );
  });

  it('omits a fabricated percentage for indeterminate progress', () => {
    const fixture = TestBed.createComponent(ProgressHostComponent);
    fixture.componentInstance.label.set('Processing media');
    fixture.componentInstance.value.set(null);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const progress = host.querySelector('app-progress-bar') as HTMLElement;
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
    expect(host.querySelector('.relay-progress__value--indeterminate')).not.toBeNull();
  });

  it('uses an assertive alert only for unavailable and error states', () => {
    const fixture = TestBed.createComponent(StatePanelHostComponent);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('app-loading-state-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('alert');
    expect(panel.getAttribute('aria-live')).toBe('assertive');
    expect(panel.hasAttribute('aria-busy')).toBe(false);

    fixture.componentInstance.state.set('loading');
    fixture.componentInstance.title.set('Loading profile');
    fixture.detectChanges();

    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.getAttribute('aria-busy')).toBe('true');
  });
});
