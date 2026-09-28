import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const chatListTemplate = readFileSync(
  resolve(process.cwd(), 'src/app/components/chat-list/chat-list.component.html'),
  'utf8',
);
const chatRoutes = readFileSync(resolve(process.cwd(), 'src/app/routes/chat.routes.ts'), 'utf8');
const discoverySource = readFileSync(
  resolve(process.cwd(), 'src/app/components/groups-discovery/groups-discovery.component.ts'),
  'utf8',
);

describe('groups discovery product contract', () => {
  it('keeps Groups as a first-class tab in the chat inbox', () => {
    expect(chatListTemplate).toContain("activeTab() === 'groups'");
    expect(chatListTemplate).toContain(
      '<app-groups-discovery [isEmbedded]="true"></app-groups-discovery>',
    );
    expect(chatListTemplate).toContain("'chatList.tabGroups' | t");
  });

  it('keeps a standalone lazy-loaded Groups Discovery route', () => {
    expect(chatRoutes).toContain("path: 'groups'");
    expect(chatRoutes).toContain(
      "import('../components/groups-discovery/groups-discovery.component')",
    );
    expect(chatRoutes).toContain("title: 'Groups Discovery - HelloTalk'");
  });

  it('loads discoverable groups and encoded localized topic metadata', () => {
    expect(discoverySource).toContain('`${this.apiUrl}/groups/discoverable`');
    expect(discoverySource).toContain('encodeURIComponent(lang)');
    expect(discoverySource).toContain(
      'return groups.filter((group) => group.interest_id === interestId);',
    );
  });

  it('bounds and validates untrusted discovery collections before rendering', () => {
    expect(discoverySource).toContain('const MAX_DISCOVERABLE_GROUPS = 100;');
    expect(discoverySource).toContain('const MAX_INTEREST_TOPICS = 100;');
    expect(discoverySource).toContain('parseDiscoverableGroups(response)');
    expect(discoverySource).toContain('parseInterestTopics(response)');
    expect(discoverySource).toContain("this.i18n.translate('common.error_generic')");
  });

  it('keeps join state and capacity state explicit in the UI', () => {
    expect(discoverySource).toContain('encodeURIComponent(groupId)');
    expect(discoverySource).toContain('[disabled]="joiningId() !== null"');
    expect(discoverySource).toContain('group.member_count < group.max_members');
    expect(discoverySource).toContain("'groups_discovery_joined' | t");
    expect(discoverySource).toContain("'groups_discovery_full' | t");
  });

  it('serializes joins and refuses arbitrary, joined, or full group mutations', () => {
    expect(discoverySource).toContain('if (this.joiningId() !== null) return;');
    expect(discoverySource).toContain(
      'if (!group || group.is_member || group.member_count >= group.max_members)',
    );
    expect(discoverySource).toContain('if (!isJoinResult(response))');
  });

  it('uses safe text rendering and Spartan-owned native actions', () => {
    expect(discoverySource).toContain('dir="auto"');
    expect(discoverySource).not.toContain('sanitiseHtml');
    expect(discoverySource).toContain('hlmBtn');
    expect(discoverySource).not.toContain('tabindex="0"');
    expect(discoverySource).not.toContain('role="button"');
  });
});
