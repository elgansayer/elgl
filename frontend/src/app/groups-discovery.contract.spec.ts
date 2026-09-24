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

  it('loads authenticated discoverable groups and topic metadata', () => {
    expect(discoverySource).toContain('`${this.apiUrl}/groups/discoverable`');
    expect(discoverySource).toContain(
      '`${this.apiUrl}/interests?language=${lang}&includeEmpty=true`',
    );
    expect(discoverySource).toContain('return groups.filter((g) => g.interest_id === interestId);');
  });

  it('keeps join state and capacity state explicit in the UI', () => {
    expect(discoverySource).toContain('`${this.apiUrl}/groups/${groupId}/join`');
    expect(discoverySource).toContain('[disabled]="joiningId() === group.id"');
    expect(discoverySource).toContain('group.member_count < group.max_members');
    expect(discoverySource).toContain("'groups_discovery_joined' | t");
    expect(discoverySource).toContain("'groups_discovery_full' | t");
  });

  it('uses Spartan-owned native actions and avoids synthetic button semantics', () => {
    expect(discoverySource).toContain('hlmBtn');
    expect(discoverySource).not.toContain('tabindex="0"');
    expect(discoverySource).not.toContain('role="button"');
  });
});
