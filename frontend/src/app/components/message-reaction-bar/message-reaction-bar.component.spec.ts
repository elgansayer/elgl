import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageReactionBarComponent } from './message-reaction-bar.component';

describe('MessageReactionBarComponent', () => {
  let component: MessageReactionBarComponent;
  let fixture: ComponentFixture<MessageReactionBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageReactionBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageReactionBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('messageId', 'message-1');
    fixture.componentRef.setInput('currentUserId', 'user-me');
    fixture.detectChanges();
  });

  it('creates six quick reaction controls', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(component).toBeTruthy();
    expect(component.quickEmojis).toHaveLength(6);
    expect(buttons).toHaveLength(6);
  });

  it('aggregates supported reactions and marks the current user reaction as pressed', () => {
    fixture.componentRef.setInput('reactions', {
      '❤️': ['user-me', 'user-2'],
      '👍': ['user-2'],
      '🚫': ['user-me'],
    });
    fixture.detectChanges();

    expect(component.getReactionEntries()).toEqual([
      { emoji: '❤️', users: ['user-me', 'user-2'] },
      { emoji: '👍', users: ['user-2'] },
    ]);
    expect(component.hasCurrentUserReaction('❤️')).toBe(true);
    expect(component.hasCurrentUserReaction('👍')).toBe(false);
  });

  it('emits an idempotent desired state when toggled', () => {
    fixture.componentRef.setInput('reactions', { '❤️': ['user-me'] });
    fixture.detectChanges();

    let emitted: { messageId: string; emoji: string; added: boolean } | undefined;
    component.reacted.subscribe((value) => {
      emitted = value;
    });

    component.toggleReaction('❤️');
    expect(emitted).toEqual({ messageId: 'message-1', emoji: '❤️', added: false });

    component.toggleReaction('😂');
    expect(emitted).toEqual({ messageId: 'message-1', emoji: '😂', added: true });
  });

  it('suppresses duplicate interactions while a mutation is pending', () => {
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();

    let emissionCount = 0;
    component.reacted.subscribe(() => {
      emissionCount += 1;
    });

    component.toggleReaction('👍');

    expect(emissionCount).toBe(0);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
