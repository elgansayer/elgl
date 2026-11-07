import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioStage } from './audio-stage';

describe('AudioStage', () => {
  let component: AudioStage;
  let fixture: ComponentFixture<AudioStage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioStage],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioStage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders no copy of its own until issue #5955 builds the standalone stage', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
