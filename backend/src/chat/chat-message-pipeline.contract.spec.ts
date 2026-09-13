import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const controller = readFileSync(
  resolve(repositoryRoot, 'backend/src/chat/chat.controller.ts'),
  'utf8',
);
const service = readFileSync(
  resolve(repositoryRoot, 'backend/src/chat/chat.service.ts'),
  'utf8',
);
const dto = readFileSync(
  resolve(repositoryRoot, 'backend/src/chat/dto/send-message.dto.ts'),
  'utf8',
);

function sendMessageSource(): string {
  const start = service.indexOf('  async sendMessage(');
  const publish = service.indexOf(
    'await this.centrifugoService.publish(`chat:${dto.room_id}`',
    start,
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(publish).toBeGreaterThan(start);

  return service.slice(start, publish + 160);
}

describe('POST /chat/messages pipeline contract', () => {
  it('keeps message creation behind Supabase authentication and delegates the authenticated user', () => {
    expect(controller).toMatch(/@Controller\('chat'\)/);
    expect(controller).toMatch(/@UseGuards\(SupabaseAuthGuard\)/);
    expect(controller).toMatch(
      /@Post\('messages'\)[\s\S]*?async sendMessage\([\s\S]*?@CurrentUser\(\) user: User \| null,[\s\S]*?@Body\(\) dto: SendMessageDto,[\s\S]*?this\.chatService\.sendMessage\(user\.id, dto\)/,
    );
  });

  it('keeps the request DTO bounded and validates supported message shapes', () => {
    expect(dto).toMatch(/room_id!:\s*string/);
    expect(dto).toMatch(/@MaxLength\(128\)[\s\S]*?room_id!/);
    expect(dto).toMatch(
      /@IsIn\(\[[\s\S]*?'text'[\s\S]*?'voice'[\s\S]*?'correction'[\s\S]*?'doodle'[\s\S]*?'sticker'[\s\S]*?'view_once_media'[\s\S]*?\]\)/,
    );
    expect(dto).toMatch(/text_content must not be blank/);
    expect(dto).toMatch(/@MaxLength\(10000\)[\s\S]*?text_content\?: string/);
  });

  it('persists the authenticated sender and message payload before publishing realtime state', () => {
    const source = sendMessageSource();
    const insertIndex = source.indexOf(".from('chat_messages')");
    const savedIndex = source.indexOf(
      'const savedMessage = insertResponse.data',
    );
    const publishIndex = source.indexOf(
      'await this.centrifugoService.publish(`chat:${dto.room_id}`',
    );

    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(source).toMatch(/sender_id:\s*senderId/);
    expect(source).toMatch(/message_type:\s*dto\.message_type/);
    expect(source).toMatch(/text_content:\s*dto\.text_content \?\? null/);
    expect(source).toMatch(/delivery_status:\s*'sent'/);
    expect(source).toMatch(/\.single\(\)/);
    expect(savedIndex).toBeGreaterThan(insertIndex);
    expect(publishIndex).toBeGreaterThan(savedIndex);
    expect(source).toMatch(
      /centrifugoService\.publish\(`chat:\$\{dto\.room_id\}`,[\s\S]*?message:\s*messageForPublish/,
    );
  });

  it('fails closed on persistence errors before any realtime publication can occur', () => {
    const source = sendMessageSource();
    const failureIndex = source.indexOf(
      'if (insertResponse.error || !insertResponse.data)',
    );
    const throwIndex = source.indexOf(
      'throw new Error(`Failed to save message:',
      failureIndex,
    );
    const publishIndex = source.indexOf(
      'await this.centrifugoService.publish(`chat:${dto.room_id}`',
    );

    expect(failureIndex).toBeGreaterThanOrEqual(0);
    expect(throwIndex).toBeGreaterThan(failureIndex);
    expect(publishIndex).toBeGreaterThan(throwIndex);
  });
});
