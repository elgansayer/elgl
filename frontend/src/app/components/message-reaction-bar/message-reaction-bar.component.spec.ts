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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
