import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupParticipantDrawerComponent, GroupParticipant } from './group-participant-drawer.component';
import { I18nService } from '../../services/i18n.service';

function makeParticipant(overrides: Partial<GroupParticipant> = {}): GroupParticipant {
  return {
    id: 'user-1',
    display_name: 'Alice',
    avatar_url: undefined,
    native_language: 'English',
    target_languages: ['Spanish'],
    is_vip: false,
    ...overrides,
  };
}

describe('GroupParticipantDrawerComponent', () => {
  let fixture: ComponentFixture<GroupParticipantDrawerComponent>;
  let component: GroupParticipantDrawerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupParticipantDrawerComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupParticipantDrawerComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should expose isOpen and participants inputs', () => {
    // The component exists with signal inputs - just verify the API shape
    expect(typeof component.isOpen).toBe('function');
    expect(typeof component.participants).toBe('function');
  });

  it('should emit closed event when close() is called', () => {
    let emitted = false;
    component.closed.subscribe(() => {
      emitted = true;
    });

    component.close();
    expect(emitted).toBe(true);
  });

  it('should default isOpen to false', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should default participants to empty array', () => {
    expect(component.participants()).toEqual([]);
  });
});