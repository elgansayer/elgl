import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRepositoryFile(path: string): string {
  const backendPath = join(process.cwd(), path);
  if (existsSync(backendPath)) {
    return readFileSync(backendPath, 'utf8');
  }

  return readFileSync(join(process.cwd(), 'backend', path), 'utf8');
}

describe('Profile visits HTTP privacy contract', () => {
  const controllerSource = readRepositoryFile(
    'src/profile-visits/profile-visits.controller.ts',
  );
  const serviceSource = readRepositoryFile(
    'src/profile-visits/profile-visits.service.ts',
  );

  it('keeps profile visit routes behind Supabase authentication', () => {
    expect(controllerSource).toContain('@UseGuards(SupabaseAuthGuard)');
    expect(controllerSource).toContain("@Post(':viewedId')");
    expect(controllerSource).toContain("@Get('my-visitors')");
  });

  it('rate limits visit recording and visitor-log reads', () => {
    const throttleMatches = controllerSource.match(
      /@Throttle\(\{ default: \{ limit: 30, ttl: 60000 \} \}\)/g,
    );

    expect(throttleMatches).toHaveLength(2);
  });

  it('marks visitor logs private and non-cacheable', () => {
    expect(controllerSource).toContain(
      "@Header('Cache-Control', 'private, no-store')",
    );
  });

  it('keeps the visitor collection bounded and newest-first', () => {
    expect(serviceSource).toContain(".eq('viewed_id', userId)");
    expect(serviceSource).toContain(
      ".order('created_at', { ascending: false })",
    );
    expect(serviceSource).toContain('.limit(50)');
  });

  it('keeps free-tier identity masking server-owned', () => {
    expect(serviceSource).toContain('if (!isOwnerVip)');
    expect(serviceSource).toContain('is_blurred: true');
    expect(serviceSource).toContain("id: 'hidden-vip-only'");
  });
});
