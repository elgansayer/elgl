import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyBuddyComponent } from './study-buddy.component';
import { StudyBuddyService, StudyBuddyMatch } from '../../services/study-buddy.service';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('StudyBuddyComponent', () => {
  let component: StudyBuddyComponent;
  let fixture: ComponentFixture<StudyBuddyComponent>;
  let serviceMock: {
    getMatches: ReturnType<typeof vi.fn>;
    requestBuddy: ReturnType<typeof vi.fn>;
  };

  const mockMatches: StudyBuddyMatch[] = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
    },
  ];

  beforeEach(async () => {
    serviceMock = {
      getMatches: vi.fn().mockResolvedValue(mockMatches),
      requestBuddy: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [StudyBuddyComponent],
      providers: [{ provide: StudyBuddyService, useValue: serviceMock }],
    })
      .overrideComponent(StudyBuddyComponent, {
        set: { imports: [CommonModule, MockTranslatePipe] },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StudyBuddyComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should call getMatches after first render and populate matches', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(serviceMock.getMatches).toHaveBeenCalledTimes(1);
    expect(component.matches()).toEqual(mockMatches);
  });

  it('should render a list of potential matches', () => {
    component.matches.set(mockMatches);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Alice');
  });

  it('should call requestBuddy with placeholder partnerId', () => {
    component.requestBuddy();
    expect(serviceMock.requestBuddy).toHaveBeenCalledWith({
      partnerId: 'placeholder',
    });
  });
});
