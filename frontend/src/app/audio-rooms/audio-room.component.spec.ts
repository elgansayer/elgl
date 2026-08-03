import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AudioRoomComponent } from './audio-room.component';

describe('AudioRoomComponent', () => {
  let component: AudioRoomComponent;
  let fixture: ComponentFixture<AudioRoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioRoomComponent, RouterTestingModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AudioRoomComponent);
    fixture.componentRef.setInput('roomId', 'test-room');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render audience sections', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('section').length).toBeGreaterThanOrEqual(2);
  });
});
