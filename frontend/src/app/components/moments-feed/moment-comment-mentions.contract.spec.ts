import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = process.cwd();
const template = readFileSync(
  resolve(frontendRoot, 'src/app/components/moments-feed/moments-feed.component.html'),
  'utf8',
);
const component = readFileSync(
  resolve(frontendRoot, 'src/app/components/moments-feed/moments-feed.component.ts'),
  'utf8',
);
const momentsService = readFileSync(
  resolve(frontendRoot, '../backend/src/moments/moments.service.ts'),
  'utf8',
);
const mentionListener = readFileSync(
  resolve(
    frontendRoot,
    '../backend/src/notifications/listeners/comment-mention-notification.listener.ts',
  ),
  'utf8',
);

describe('Moment comment @mention contract', () => {
  it('delegates comment keyboard, focus, and selection state to Spartan autocomplete', () => {
    expect(component).toContain(
      "import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete'",
    );
    expect(component).toContain('...HlmAutocompleteImports');
    expect(template).toContain('<hlm-autocomplete-search');
    expect(template).toContain('<hlm-autocomplete-input');
    expect(template).toContain('(inputEvent)="onCommentInput($event, moment.id)"');
    expect(template).toContain('(keyDown)="onCommentKeydown($event, moment)"');
    expect(template).toContain('autoHighlight');
    expect(template).not.toContain('role="combobox"');
    expect(template).not.toContain('[attr.aria-activedescendant]');
    expect(component).not.toContain("event.key === 'ArrowDown'");
    expect(component).not.toContain("event.key === 'ArrowUp'");
  });

  it('renders server-backed suggestions as touch-sized Spartan options', () => {
    expect(template).toContain('mentionSuggestionsMap()[moment.id]');
    expect(template).toContain('<hlm-autocomplete-content *hlmAutocompletePortal>');
    expect(template).toContain('hlmAutocompleteList');
    expect(template).toContain('<hlm-autocomplete-item');
    expect(template).toContain('[value]="suggestion"');
    expect(template).toContain('min-h-11');
    expect(template).toContain('[itemToString]="mentionItemToStringFor(moment.id)"');
    expect(template).toContain('(valueChange)="onMentionSelected(moment.id, $event)"');
    expect(component).toContain('mentionItemToStringFor(momentId: string)');
  });

  it('ignores stale async searches and closes safely through the primitive', () => {
    expect(component).toContain('this.userService.searchUsers(query, 5)');
    expect(component).toContain('mentionRequestVersionMap');
    expect(component).toContain('this.mentionRequestVersionMap[momentId] !== requestVersion');
    expect(component).toContain('this.mentionQueryMap()[momentId] !== query');
    expect(template).toContain('(closed)="closeMentionSuggestions(moment.id)"');
    expect(component).toContain('this.closeMentionSuggestions(momentId)');
  });

  it('parses submitted mentions on the server and excludes self/author notifications', () => {
    expect(momentsService).toContain('const mentionRegex =');
    expect(momentsService).toContain(".in('display_name', mentionedNames)");
    expect(momentsService).toContain('u.id !== userId && u.id !== momentAuthorId');
    expect(momentsService).toContain("'moment.mention'");
  });

  it('routes mention events through the dedicated notification listener', () => {
    expect(mentionListener).toContain("@OnEvent('moment.mention')");
    expect(mentionListener).toContain('mentionedUserIds');
  });
});
