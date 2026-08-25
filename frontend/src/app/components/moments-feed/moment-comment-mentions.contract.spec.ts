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
  it('wires comment typing and keyboard navigation into the autocomplete controller', () => {
    expect(template).toContain('(input)="onCommentInput($event, moment.id)"');
    expect(template).toContain('(keydown)="onCommentKeydown($event, moment)"');
    expect(template).not.toContain('(keyup.enter)="submitComment(moment)"');

    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
      expect(component).toContain(`event.key === '${key}'`);
    }
    expect(component).toContain('this.userService.searchUsers(query, 5)');
  });

  it('renders server-backed suggestions as touch-sized Spartan actions', () => {
    expect(template).toContain('mentionSuggestionsMap()[moment.id]');
    expect(template).toContain('(click)="selectMention(moment.id, suggestion)"');
    expect(template).toContain('hlmBtn');
    expect(template).toContain('min-h-11');
    expect(template).toContain('aria-autocomplete="list"');
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
