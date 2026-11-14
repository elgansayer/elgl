import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService, GroupVocabularyEntry } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { GroupVocabularyBankComponent } from './group-vocabulary-bank.component';

const entry: GroupVocabularyEntry = {
  id: 'entry-1',
  group_id: 'group-1',
  created_by: 'user-1',
  term: 'bonjour',
  translation: 'hello',
  language: 'fr',
  created_at: '2026-11-14T00:00:00.000Z',
};

describe('GroupVocabularyBankComponent', () => {
  let fixture: ComponentFixture<GroupVocabularyBankComponent>;
  let component: GroupVocabularyBankComponent;
  let getVocabulary: ReturnType<typeof vi.fn>;
  let addVocabulary: ReturnType<typeof vi.fn>;
  let deleteVocabulary: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getVocabulary = vi.fn().mockResolvedValue([entry]);
    addVocabulary = vi.fn().mockResolvedValue({ ...entry, id: 'entry-2', term: 'merci' });
    deleteVocabulary = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [GroupVocabularyBankComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getGroupVocabulary: getVocabulary,
            addGroupVocabulary: addVocabulary,
            deleteGroupVocabulary: deleteVocabulary,
          },
        },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupVocabularyBankComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('lists terms shared in the group', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(getVocabulary).toHaveBeenCalledWith('room-1');
    expect(text).toContain('bonjour');
    expect(text).toContain('hello');
  });

  it('adds a trimmed term and appends it once', async () => {
    component.term.set(' merci ');
    component.translation.set(' thank you ');
    component.language.set('fr');

    await component.add();
    fixture.detectChanges();

    expect(addVocabulary).toHaveBeenCalledWith('room-1', {
      term: 'merci',
      translation: 'thank you',
      language: 'fr',
    });
    expect(component.entries()).toHaveLength(2);
    expect(component.term()).toBe('');
  });

  it('rejects incomplete or invalid script codes without calling the API', async () => {
    component.term.set('merci');
    component.translation.set('thank you');
    component.language.set('not a code');

    await component.add();
    expect(addVocabulary).not.toHaveBeenCalled();
  });

  it('removes a term from the list after the API accepts the delete', async () => {
    await component.remove(entry);

    expect(deleteVocabulary).toHaveBeenCalledWith('room-1', 'entry-1');
    expect(component.entries()).toEqual([]);
  });

  it('shows a retryable error instead of crashing when loading fails', async () => {
    getVocabulary.mockRejectedValueOnce(new Error('offline'));
    component.entries.set([]);
    await component.load();
    fixture.detectChanges();

    expect(component.loadError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
