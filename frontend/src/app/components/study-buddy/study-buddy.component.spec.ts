import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyBuddyComponent } from './study-buddy.component';
import {
  StudyBuddyService,
  StudyBuddyMatch,
  BuddyRequest,
} from '../../services/study-buddy.service';

@Pipe({ name: 't' })
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
    getIncomingRequests: ReturnType<typeof vi.fn>;
    acceptRequest: ReturnType<typeof vi.fn>;
    declineRequest: ReturnType<typeof vi.fn>;
  };

  const mockMatches: StudyBuddyMatch[] = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
    },
  ];

  const mockRequests: BuddyRequest[] = [
    {
      id: 'req-1',
      requesterId: 'user-2',
      partnerId: 'user-current',
      status: 'pending',
      createdAt: '2026-08-01T00:00:00.000Z',
      requester: { id: 'user-2', display_name: 'Bob' },
    },
  ];

  beforeEach(async () => {
    serviceMock = {
      getMatches: vi.fn().mockResolvedValue(mockMatches),
      requestBuddy: vi.fn().mockResolvedValue(undefined),
      getIncomingRequests: vi.fn().mockResolvedValue(mockRequests),
      acceptRequest: vi.fn().mockResolvedValue(undefined),
      declineRequest: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [StudyBuddyComponent],
      providers: [{ provide: StudyBuddyService, useValue: serviceMock }],
    })
      .overrideComponent(StudyBuddyComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StudyBuddyComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load matches and incoming requests after first render', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.getMatches).toHaveBeenCalledTimes(1);
    expect(serviceMock.getIncomingRequests).toHaveBeenCalledTimes(1);
    expect(component.matches()).toEqual(mockMatches);
    expect(component.incomingRequests()).toEqual(mockRequests);
  });

  it('should render a list of potential matches', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Alice');
  });

  it('should render incoming requests', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Bob');
  });

  it('should send a real buddy request with the selected match id', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.requestBuddy('user-1');

    expect(serviceMock.requestBuddy).toHaveBeenCalledWith({ partnerId: 'user-1' });
    expect(component.requestedIds().has('user-1')).toBe(true);
  });

  it('should accept an incoming request and reload', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.accept('req-1');
    expect(serviceMock.acceptRequest).toHaveBeenCalledWith('req-1');
  });

  it('should decline an incoming request and reload', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.decline('req-1');
    expect(serviceMock.declineRequest).toHaveBeenCalledWith('req-1');
  });
});
