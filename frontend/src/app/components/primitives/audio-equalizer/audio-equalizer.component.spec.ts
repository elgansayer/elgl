import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioEqualizerComponent } from './audio-equalizer.component';

describe('AudioEqualizerComponent', () => {
  let fixture: ComponentFixture<AudioEqualizerComponent>;
  let component: AudioEqualizerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioEqualizerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioEqualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render 4 bars with default barCount', () => {
    const bars = fixture.nativeElement.querySelector('.flex')?.children;
    expect(bars?.length).toBe(4);
  });

  it('should render each bar at 4px height when inactive (default)', () => {
    const bars = fixture.nativeElement.querySelectorAll('.flex > div');
    expect(bars.length).toBe(4);
    bars.forEach((bar: HTMLElement) => {
      expect(bar.style.height).toBe('4px');
    });
  });

  it('should not apply animate-eq class when isActive is false (default)', () => {
    const animatedBars = fixture.nativeElement.querySelectorAll('.animate-eq');
    expect(animatedBars.length).toBe(0);
  });

  it('should compute bars with correct count from component API', () => {
    expect(component.barCount()).toBe(4);
    expect(component.bars().length).toBe(4);
  });

  it('should default isActive to false', () => {
    expect(component.isActive()).toBe(false);
  });

  it('should default customClass to empty string', () => {
    expect(component.customClass()).toBe('');
  });
});