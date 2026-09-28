import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  resolve(
    process.cwd(),
    'src/app/components/moments-feed/moments-feed.component.html',
  ),
  'utf8',
);
const component = readFileSync(
  resolve(
    process.cwd(),
    'src/app/components/moments-feed/moments-feed.component.ts',
  ),
  'utf8',
);

describe('Moment comment @mention product contract', () => {
  it('wires comment input changes and keyboard events to mention handling', () => {
    expect(template).toContain('(input)="onCommentInput($event, moment.id)"');
    expect(template).toContain('(keydown)="onCommentKeydown($event, moment)"');
    expect(component).toContain('this.userService.searchUsers(query, 5)');
  });

  it('renders suggestions as an accessible combobox/listbox relationship', () => {
    expect(template).toContain('role="combobox"');
    expect(template).toContain('aria-autocomplete="list"');
    expect(template).toContain('role="listbox"');
    expect(template).toContain('role="option"');
    expect(template).toContain('[attr.aria-activedescendant]');
    expect(template).toContain('[attr.aria-selected]');
  });

  it('keeps suggestion selection usable by pointer without stealing input focus', () => {
    expect(template).toContain('(mousedown)="$event.preventDefault()"');
    expect(template).toContain('(click)="selectMention(moment.id, suggestion)"');
    expect(template).toContain('min-h-11');
  });

  it('keeps Arrow keys, Enter and Escape owned by the autocomplete interaction', () => {
    expect(component).toContain("event.key === 'ArrowDown'");
    expect(component).toContain("event.key === 'ArrowUp'");
    expect(component).toContain("event.key === 'Enter'");
    expect(component).toContain("event.key === 'Escape'");
  });

  it('keeps user-controlled display names direction-safe and avatar images decorative', () => {
    expect(template).toContain('<span dir="auto" class="min-w-0 truncate">');
    expect(template).toContain('alt=""');
  });
});
