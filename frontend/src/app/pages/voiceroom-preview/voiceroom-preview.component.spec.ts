import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { VoiceroomPreviewComponent } from './voiceroom-preview.component';

describe.skip('VoiceroomPreviewComponent', () => {
  let component: VoiceroomPreviewComponent;
  let fixture: ComponentFixture<VoiceroomPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoiceroomPreviewComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        Title,
        Meta,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceroomPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'room-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have roomResource defined', () => {
    expect(component.roomResource).toBeDefined();
  });

  it('should render placeholder content while resource is loading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe(
      'Live Audio Room',
    );
  });

  it('should render Join Room link', () => {
    const joinLink = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(joinLink).toBeTruthy();
    expect(joinLink.textContent).toContain('Join Room');
  });

  it('should render the microphone emoji icon', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const micIcon = compiled.querySelector('.text-3xl');
    expect(micIcon?.textContent).toContain('🎙️');
  });
});