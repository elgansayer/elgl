import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiConversationComponent } from './ai-conversation.component';
import { UserService } from '../services/user.service';
import { TokenisedTextComponent } from '../components/tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../components/word-definition-modal/word-definition-modal.component';
import { AiConversationService, Scenario } from '../services/ai-conversation.service';
import { TranslatePipe } from '../services/translate.pipe';
import { Pipe, PipeTransform, Component, Input, Output, EventEmitter } from '@angular/core';

@Component({ selector: 'app-tokenised-text', template: '' })
class MockTokenisedTextComponent {
  @Input() text: string = '';
  @Input() language: string = 'en';
  @Output() wordClicked = new EventEmitter<any>();
}

@Component({ selector: 'app-word-definition-modal', template: '' })
class MockWordDefinitionModalComponent {
  @Input() wordToken: string = '';
  @Input() contextSentence?: string;
  @Output() closed = new EventEmitter<void>();
}

@Pipe({
  name: 't',
  standalone: true
})
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('AiConversationComponent', () => {
  let component: AiConversationComponent;
  let fixture: ComponentFixture<AiConversationComponent>;

  let aiServiceMock: any;
  let userServiceMock: any;

  const mockScenarios: Scenario[] = [
    { id: '1', name: 'Order Coffee', icon: '☕' },
    { id: '2', name: 'Ask Directions', icon: '🗺️' }
  ];

  beforeEach(async () => {
    TestBed.resetTestingModule();

    aiServiceMock = {
      getScenarios: vi.fn().mockResolvedValue(mockScenarios),
      sendMessage: vi.fn().mockResolvedValue({ reply: 'Here is your coffee.' })
    };

    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({ target_languages: ['es'] })
    };


    await TestBed.configureTestingModule({
      imports: [AiConversationComponent],
      providers: [
        { provide: AiConversationService, useValue: aiServiceMock },
        { provide: UserService, useValue: userServiceMock }
      ]
    })
    .overrideComponent(AiConversationComponent, {
      remove: { imports: [TranslatePipe, TokenisedTextComponent, WordDefinitionModalComponent] },
      add: { imports: [MockTranslatePipe, MockTokenisedTextComponent, MockWordDefinitionModalComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiConversationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Wait for initial getScenarios promise to resolve
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load scenarios on init', () => {
    expect(aiServiceMock.getScenarios).toHaveBeenCalled();
    expect(component.scenarioList()).toEqual(mockScenarios);
  });

  it('should start a scenario', () => {
    component.startScenario(mockScenarios[0]);
    expect(component.selectedScenario()).toEqual(mockScenarios[0]);
    expect(component.messages()).toEqual([]);
  });

  it('should go back to scenarios list', () => {
    component.startScenario(mockScenarios[0]);
    component.backToScenarios();
    expect(component.selectedScenario()).toBeNull();
    expect(component.messages()).toEqual([]);
  });

  it('should send a message and receive a reply', async () => {
    component.startScenario(mockScenarios[0]);
    component.inputText.set('Can I get a coffee?');

    const sendPromise = component.send();

    expect(component.isLoading()).toBe(true);
    expect(component.messages().length).toBe(1);
    expect(component.messages()[0]).toEqual({ from: 'user', text: 'Can I get a coffee?' });
    expect(component.inputText()).toBe('');

    await sendPromise;
    fixture.detectChanges();

    expect(aiServiceMock.sendMessage).toHaveBeenCalledWith(
      'Can I get a coffee?',
      '1',
      [{ role: 'user', content: 'Can I get a coffee?' }]
    );

    expect(component.isLoading()).toBe(false);
    expect(component.messages().length).toBe(2);
    expect(component.messages()[1]).toEqual({ from: 'ai', text: 'Here is your coffee.' });
  });

  it('should handle errors when sending a message', async () => {
    aiServiceMock.sendMessage.mockRejectedValue('API Error');

    component.startScenario(mockScenarios[0]);
    component.inputText.set('Hello?');

    await component.send();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.messages().length).toBe(2);
    expect(component.messages()[1]).toEqual({
      from: 'ai',
      text: 'Sorry, I am having trouble responding. Please try again.'
    });
  });

  it('should not send an empty message', async () => {
    component.startScenario(mockScenarios[0]);
    component.inputText.set('   ');

    await component.send();

    expect(aiServiceMock.sendMessage).not.toHaveBeenCalled();
    expect(component.messages().length).toBe(0);
  });

  it('should only keep the last 10 messages for conversation history', async () => {
    component.startScenario(mockScenarios[0]);
    const mockMessages = Array.from({ length: 15 }, (_, i) => ({
      from: i % 2 === 0 ? 'user' : 'ai',
      text: `Message ${i}`
    }));
    // @ts-expect-error bypassing readonly to set mock test data
    component.messages.set(mockMessages);

    component.inputText.set('Next message');
    await component.send();

    const callArgs = aiServiceMock.sendMessage.mock.calls[0];
    const history = callArgs[2];

    expect(history?.length).toBe(10);
  });
});
