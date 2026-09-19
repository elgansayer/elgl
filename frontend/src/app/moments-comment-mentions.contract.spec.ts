import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  resolve(process.cwd(), 'src/app/components/moments-feed/moments-feed.component.html'),
  'utf8',
);
const component = readFileSync(
  resolve(process.cwd(), 'src/app/components/moments-feed/moments-feed.component.ts'),
  'utf8',
);

describe('Moment comment @mention product contract', () => {
  it('wires comment input changes and keyboard events to mention handling', () => {
    expect(template).toContain('(inputEvent)="onCommentInput($event, moment.id)"');
    expect(template).toContain('(keyDown)="onCommentKeydown($event, moment)"');
    expect(component).toContain('this.userService.searchUsers(query, 5)');
  });

  it('delegates accessible combobox/listbox relationships to the owned Spartan primitive', () => {
    expect(component).toContain('HlmAutocompleteImports');
    expect(template).toContain('<hlm-autocomplete-search');
    expect(template).toContain('<hlm-autocomplete-input');
    expect(template).toContain('hlmAutocompleteList');
    expect(template).toContain('<hlm-autocomplete-item');
    expect(template).not.toContain('role="combobox"');
    expect(template).not.toContain('[attr.aria-activedescendant]');
  });

  it('delegates pointer and active-option selection to Spartan autocomplete items', () => {
    expect(template).toContain('[value]="suggestion"');
    expect(template).toContain('(valueChange)="onMentionSelected(moment.id, $event)"');
    expect(template).not.toContain('(mousedown)="$event.preventDefault()"');
    expect(template).not.toContain('(click)="selectMention(moment.id, suggestion)"');
  });

  it('keeps navigation keys Spartan-owned and comment submission IME-safe', () => {
    expect(component).not.toContain("event.key === 'ArrowDown'");
    expect(component).not.toContain("event.key === 'ArrowUp'");
    expect(component).not.toContain("event.key === 'Escape'");
    expect(component).toContain('if (event.isComposing) return;');
    expect(component).toContain("event.key === 'Enter'");
  });

  it('keeps user-controlled display names direction-safe and avatar images decorative', () => {
    expect(template).toContain('<span dir="auto" class="min-w-0 truncate">');
    expect(template).toContain('alt=""');
  });
});
