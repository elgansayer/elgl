import { TestBed } from '@angular/core/testing';
import { DeveloperBotsComponent } from './developer-bots.component';
import { CustomEducationalBot, DeveloperBotsService } from '../../services/developer-bots.service';
import { I18nService } from '../../services/i18n.service';

const bot: CustomEducationalBot = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: 'user-1',
  display_name: 'Chef Ana',
  persona: 'A cheerful Spanish chef',
  target_language: 'es',
  tone: 'playful',
  greeting: 'Hola',
  is_enabled: true,
  created_at: '2026-11-14T00:00:00.000Z',
  updated_at: '2026-11-14T00:00:00.000Z',
};

describe('DeveloperBotsComponent', () => {
  let service: {
    listBots: ReturnType<typeof vi.fn>;
    createBot: ReturnType<typeof vi.fn>;
    updateBot: ReturnType<typeof vi.fn>;
    deleteBot: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listBots: vi.fn().mockResolvedValue([bot]),
      createBot: vi.fn().mockResolvedValue(bot),
      updateBot: vi.fn().mockResolvedValue(bot),
      deleteBot: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [DeveloperBotsComponent],
      providers: [
        { provide: DeveloperBotsService, useValue: service },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and renders the caller bots', async () => {
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(service.listBots).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Chef Ana');
    expect(fixture.nativeElement.textContent).toContain('developerBots.title');
  });

  it('creates a bot from the form', async () => {
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.startCreate();
    component.displayName.set('Coach Luis');
    component.persona.set('A patient football coach');
    component.targetLanguage.set('es');
    component.greeting.set('Buenas');

    await component.save();

    expect(service.createBot).toHaveBeenCalledWith({
      display_name: 'Coach Luis',
      persona: 'A patient football coach',
      target_language: 'es',
      tone: 'friendly',
      greeting: 'Buenas',
    });
    expect(component.editing()).toBe(false);
    expect(component.bots()[0].display_name).toBe('Chef Ana');
  });

  it('validates required fields before calling the API', async () => {
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.startCreate();
    component.displayName.set('Only a name');
    await component.save();

    expect(service.createBot).not.toHaveBeenCalled();
    expect(component.errorKey()).toBe('developerBots.validationError');
  });

  it('prefills and updates an existing bot', async () => {
    service.updateBot.mockResolvedValue({ ...bot, display_name: 'Chef Ana 2' });
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.startEdit(bot);
    expect(component.displayName()).toBe('Chef Ana');
    expect(component.tone()).toBe('playful');

    component.displayName.set('Chef Ana 2');
    await component.save();

    expect(service.updateBot).toHaveBeenCalledWith(bot.id, {
      display_name: 'Chef Ana 2',
      persona: 'A cheerful Spanish chef',
      target_language: 'es',
      tone: 'playful',
      greeting: 'Hola',
    });
  });

  it('deletes a bot only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    await component.remove(bot);
    expect(service.deleteBot).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await component.remove(bot);
    expect(service.deleteBot).toHaveBeenCalledWith(bot.id);
    expect(component.bots()).toEqual([]);
  });

  it('reports a load failure without inventing bots', async () => {
    service.listBots.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(DeveloperBotsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.errorKey()).toBe('developerBots.loadError');
    expect(fixture.nativeElement.textContent).toContain('developerBots.loadError');
  });
});
