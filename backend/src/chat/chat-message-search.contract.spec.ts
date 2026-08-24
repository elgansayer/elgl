import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const chatService = readFileSync(resolve(process.cwd(), 'src/chat/chat.service.ts'), 'utf8');
const searchController = readFileSync(
  resolve(process.cwd(), 'src/chat/chat-search.controller.ts'),
  'utf8',
);
const searchDto = readFileSync(
  resolve(process.cwd(), 'src/chat/dto/search-messages-query.dto.ts'),
  'utf8',
);
const initialSchema = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/001_initial_schema.sql'),
  'utf8',
);
const chatMigration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/003_chat_and_favourites.sql'),
  'utf8',
);

describe('chat message search production contract', () => {
  it('keeps pg_trgm enabled with a GIN trigram index over searchable message text', () => {
    expect(initialSchema).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/i);
    expect(chatMigration).toMatch(
      /chat_messages_text_content_trgm_idx\s+ON public\.chat_messages\s+USING GIN\s*\(text_content gin_trgm_ops\)/i,
    );
  });

  it('scopes server-side search to rooms owned by the authenticated membership', () => {
    expect(chatService).toMatch(
      /async searchAllMessages\([\s\S]*?from\('chat_room_members'\)[\s\S]*?eq\('user_id', userId\)/,
    );
    expect(chatService).toMatch(
      /if \(roomId\) \{[\s\S]*?if \(!roomIds\.includes\(roomId\)\) return \[\];[\s\S]*?roomIds = \[roomId\]/,
    );
    expect(chatService).toMatch(/\.in\('room_id', roomIds\)/);
  });

  it('uses bounded trigram-indexable substring matching and newest-first results', () => {
    expect(chatService).toMatch(/\.ilike\('text_content', `%\$\{trimmedTerm\}%`\)/);
    expect(chatService).toMatch(/\.order\('created_at', \{ ascending: false \}\)/);
    expect(chatService).toMatch(/\.limit\(limit\)/);
    expect(searchDto).toMatch(/@MinLength\(2\)/);
    expect(searchDto).toMatch(/@MaxLength\(200\)/);
    expect(searchDto).toMatch(/@Max\(100\)/);
  });

  it('preserves privacy filters for blocked and deleted messages', () => {
    expect(chatService).toMatch(/getBlockedAndBlockerIds\(userId\)/);
    expect(chatService).toMatch(/query = query\.not\('sender_id', 'in', blockedIds\)/);
    expect(chatService).toMatch(/if \(msg\.is_deleted\) return false/);
    expect(chatService).toMatch(/msg\.deleted_for_user_ids\.includes\(userId\)/);
  });

  it('keeps the public search endpoint authenticated and rate limited', () => {
    expect(searchController).toMatch(/@Controller\('chat\/search'\)/);
    expect(searchController).toMatch(/@UseGuards\(SupabaseAuthGuard\)/);
    expect(searchController).toMatch(
      /@Throttle\(\{ default: \{ limit: 30, ttl: 60000 \} \}\)/,
    );
    expect(searchController).toMatch(/@CurrentUser\(\) user: User \| null/);
  });
});
