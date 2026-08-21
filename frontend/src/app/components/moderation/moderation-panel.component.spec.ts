import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ModerationPanelComponent } from './moderation-panel.component';
import {
  ModerationItem,
  ModerationService,
  UserAnalysisResult,
} from '../../services/moderation.service';
import { I18nService } from '../../services/i18n.service';

describe.skip('ModerationPanelComponent', () => {
  let fixture: ComponentFixture<ModerationPanelComponent>;
  let getItemsSpy: ReturnType<typeof vi.fn>;
  let approveItemSpy: ReturnType<typeof vi.fn>;
  let rejectItemSpy: ReturnType<typeof vi.fn>;
  let getUserRiskAnalysisSpy: ReturnType<typeof vi.fn>;

  const mockI18nService = {
    translate: (key: string) => key,
  };

  const moderationItem = (overrides: Partial<ModerationItem> = {}): ModerationItem => ({
    id: 'item-1',
    type: 'moment',
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
    reason: 'Spam',
    reporter: { id: 'reporter-1', name: 'Reporter' },
    reported_user: { id: 'user-1', name: 'Reported User' },
    ...overrides,
  });

  async function flush(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  async function createComponent(): Promise<ComponentFixture<ModerationPanelComponent>> {
    await TestBed.configureTestingModule({
      imports: [ModerationPanelComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: ModerationService,
          useValue: {
            getItems: getItemsSpy,
            approveItem: approveItemSpy,
            rejectItem: rejectItemSpy,
            getUserRiskAnalysis: getUserRiskAnalysisSpy,
          },
        },
      ],
    }).compileComponents();

    const createdFixture = TestBed.createComponent(ModerationPanelComponent);
    createdFixture.detectChanges();
    await flush();
    createdFixture.detectChanges();
    return createdFixture;
  }

  beforeEach(() => {
    getItemsSpy = vi.fn().mockResolvedValue([]);
    approveItemSpy = vi.fn().mockResolvedValue(undefined);
    rejectItemSpy = vi.fn().mockResolvedValue(undefined);
    getUserRiskAnalysisSpy = vi.fn().mockResolvedValue({ riskScore: 0, flags: [] });
  });

  it('should create', async () => {
    fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads moment items on init', async () => {
    fixture = await createComponent();
    expect(getItemsSpy).toHaveBeenCalledWith('moment');
    expect(fixture.componentInstance.currentFilter()).toBe('moment');
  });

  it('shows the empty state when there are no items', async () => {
    fixture = await createComponent();
    const emptyMessage = fixture.nativeElement.querySelector('p');
    expect(emptyMessage.textContent).toContain('moderation.noItems');
  });

  it('renders a card for each moderation item', async () => {
    getItemsSpy.mockResolvedValue([
      moderationItem({ id: 'item-1' }),
      moderationItem({ id: 'item-2' }),
    ]);
    fixture = await createComponent();

    const cards = fixture.nativeElement.querySelectorAll('.border-surface-100');
    expect(cards.length).toBe(2);
  });

  it('switches filter to profile and reloads items', async () => {
    fixture = await createComponent();
    getItemsSpy.mockResolvedValue([moderationItem({ type: 'profile' })]);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    fixture.detectChanges();
    await flush();

    expect(fixture.componentInstance.currentFilter()).toBe('profile');
    expect(getItemsSpy).toHaveBeenCalledWith('profile');
  });

  it('calls approveItem with the item id and type when approve is clicked', async () => {
    getItemsSpy.mockResolvedValue([moderationItem({ id: 'item-7', type: 'moment' })]);
    fixture = await createComponent();

    const approveButton = fixture.nativeElement.querySelector('button.bg-success');
    approveButton.click();
    fixture.detectChanges();
    await flush();

    expect(approveItemSpy).toHaveBeenCalledWith('item-7', 'moment');
  });

  it('calls rejectItem with the item id and type when reject is clicked', async () => {
    getItemsSpy.mockResolvedValue([moderationItem({ id: 'item-8', type: 'moment' })]);
    fixture = await createComponent();

    const rejectButton = fixture.nativeElement.querySelector('button.bg-danger');
    rejectButton.click();
    fixture.detectChanges();
    await flush();

    expect(rejectItemSpy).toHaveBeenCalledWith('item-8', 'moment');
  });

  it('calls getUserRiskAnalysis with the reported user id when analyse is clicked', async () => {
    getItemsSpy.mockResolvedValue([
      moderationItem({ reported_user: { id: 'user-9', name: 'Someone' } }),
    ]);
    fixture = await createComponent();

    const analyseButton = fixture.nativeElement.querySelector('button.bg-warning');
    analyseButton.click();
    fixture.detectChanges();
    await flush();

    expect(getUserRiskAnalysisSpy).toHaveBeenCalledWith('user-9');
  });

  it('calls getUserRiskAnalysis with an empty string when reported_user is missing', async () => {
    getItemsSpy.mockResolvedValue([moderationItem({ reported_user: undefined })]);
    fixture = await createComponent();

    const analyseButton = fixture.nativeElement.querySelector('button.bg-warning');
    analyseButton.click();
    fixture.detectChanges();
    await flush();

    expect(getUserRiskAnalysisSpy).toHaveBeenCalledWith('');
  });

  it('displays the risk score and flags after a successful analysis', async () => {
    const analysis: UserAnalysisResult = { riskScore: 72, flags: ['spam', 'harassment'] };
    getItemsSpy.mockResolvedValue([moderationItem()]);
    getUserRiskAnalysisSpy.mockResolvedValue(analysis);
    fixture = await createComponent();

    const analyseButton = fixture.nativeElement.querySelector('button.bg-warning');
    analyseButton.click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const resultText = fixture.nativeElement.textContent;
    expect(resultText).toContain('72');
    expect(resultText).toContain('spam, harassment');
  });

  it('does not display a flags line when there are no flags', async () => {
    const analysis: UserAnalysisResult = { riskScore: 10, flags: [] };
    getItemsSpy.mockResolvedValue([moderationItem()]);
    getUserRiskAnalysisSpy.mockResolvedValue(analysis);
    fixture = await createComponent();

    const analyseButton = fixture.nativeElement.querySelector('button.bg-warning');
    analyseButton.click();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('moderation.flags');
  });

  it('disables the analyse button while analysis is in progress', async () => {
    let resolveAnalysis!: (value: UserAnalysisResult) => void;
    const analysisPromise = new Promise<UserAnalysisResult>((resolve) => {
      resolveAnalysis = resolve;
    });
    getItemsSpy.mockResolvedValue([moderationItem()]);
    getUserRiskAnalysisSpy.mockReturnValue(analysisPromise);
    fixture = await createComponent();

    const analyseButton = fixture.nativeElement.querySelector('button.bg-warning');
    expect(analyseButton.disabled).toBe(false);

    analyseButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.analysing()).toBe(true);
    expect(analyseButton.disabled).toBe(true);

    resolveAnalysis({ riskScore: 5, flags: [] });
    await flush();
    fixture.detectChanges();

    expect(fixture.componentInstance.analysing()).toBe(false);
    expect(analyseButton.disabled).toBe(false);
  });
});
