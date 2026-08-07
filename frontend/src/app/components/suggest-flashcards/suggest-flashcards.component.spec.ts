import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { SuggestFlashcardsComponent } from './suggest-flashcards.component';
import { SuggestFlashcardsService } from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

describe('SuggestFlashcardsComponent', () => {
  let fixture: ComponentFixture<SuggestFlashcardsComponent>;
  let component: SuggestFlashcardsComponent;
  let mockSuggestService: { suggestFromMessage: ReturnType<typeof vi.fn> };
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();

    mockSuggestService = {
      suggestFromMessage: vi.fn().mockResolvedValue({ suggestions: ['word1', 'word2'] }),
    };
    mockErrorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SuggestFlashcardsComponent],
      providers: [
        { provide: SuggestFlashcardsService, useValue: mockSuggestService },
        {
          provide: I18nService,
          useValue: {
            translate: vi.fn((key: string) => {
              if (key === 'suggest_flashcards.error') return 'Failed to suggest flashcards';
              return key;
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'mock-token' },
        },
        { provide: ErrorHandler, useValue: mockErrorHandler },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuggestFlashcardsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(component.suggestions()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should provide error context with metadata', () => {
    component.messageInput.set('test message');
    const ctx = component.errorContext();
    expect(ctx.component).toBe('suggest-flashcards');
    expect(ctx.operation).toBe('suggest');
    expect(ctx.metadata).toBeDefined();
  });

  it('should set error message on suggest failure', async () => {
    mockSuggestService.suggestFromMessage.mockRejectedValueOnce(new Error('API error'));
    component.messageInput.set('test message');

    await component.manualSuggest();

    expect(component.error()).toBe('Failed to suggest flashcards');
  });

  it('should handle retry when message input has content', async () => {
    component.messageInput.set('retry message');
    mockSuggestService.suggestFromMessage.mockRejectedValueOnce(new Error('First fail'));
    await component.manualSuggest();

    mockSuggestService.suggestFromMessage.mockResolvedValueOnce({ suggestions: ['retry-word'] });
    // handleRetry fires runSuggest which is async but not awaited
    component.handleRetry();

    expect(mockSuggestService.suggestFromMessage).toHaveBeenCalledTimes(2);
  });

  it('should not call api when message is empty', async () => {
    await component.manualSuggest();
    expect(mockSuggestService.suggestFromMessage).not.toHaveBeenCalled();
  });
});