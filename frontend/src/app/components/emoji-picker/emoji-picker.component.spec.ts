import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmojiPickerComponent } from './emoji-picker.component';

describe('EmojiPickerComponent', () => {
  let component: EmojiPickerComponent;
  let fixture: ComponentFixture<EmojiPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmojiPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmojiPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should delegate mutually exclusive category selection to the Spartan radio group', () => {
    const group = fixture.nativeElement.querySelector('hlm-radio-group');
    const radios = fixture.nativeElement.querySelectorAll('hlm-radio');

    expect(group).toBeTruthy();
    expect(group.getAttribute('name')).toBe('emojiCategory');
    expect(radios.length).toBe(component.categories.length);
    expect(component.selectedCategory()).toBe('Smileys');
  });

  it('should update category state only for known categories', () => {
    component.selectCategory('People');
    expect(component.selectedCategory()).toBe('People');

    component.selectCategory('Not a category');
    expect(component.selectedCategory()).toBe('People');
  });

  it('should derive the visible emoji list reactively from category and search state', () => {
    component.selectCategory('People');
    expect(component.filteredEmojis()).toContain('👋');
    expect(component.filteredEmojis()).not.toContain('😀');

    component.searchQuery.set('👋');
    expect(component.filteredEmojis()).toEqual(['👋']);

    component.searchQuery.set('no-match');
    expect(component.filteredEmojis()).toEqual([]);
  });

  it('should keep emoji actions as native Spartan buttons and emit the selected emoji', () => {
    component.selectedCategory.set('Smileys');
    component.searchQuery.set('');
    fixture.detectChanges();

    const emitted: string[] = [];
    component.emojiSelect.subscribe((emoji) => emitted.push(emoji));

    const emojiButtons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const emojiButton = emojiButtons.find(
      (btn) =>
        btn.getAttribute('aria-label') === 'Emoji 😀' ||
        btn.textContent?.includes('😀'),
    );

    expect(emojiButton).toBeTruthy();
    expect(emojiButton?.type).toBe('button');

    emojiButton?.click();
    expect(emitted).toEqual(['😀']);
  });
});
