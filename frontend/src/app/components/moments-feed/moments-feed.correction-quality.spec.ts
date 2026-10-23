import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const template = readFileSync(
  resolve(process.cwd(), 'src/app/components/moments-feed/moments-feed.component.html'),
  'utf8',
);

describe('Moments correction quality controls', () => {
  it('renders rating controls only inside correction comments', () => {
    const correctionStart = template.indexOf('@if (comment.correction_payload)');
    // The same translated label is used by the compose button, so search for the
    // rating group (role="group") after the correction comment branch starts.
    const ratingGroup = template.indexOf('role="group"', correctionStart);

    expect(correctionStart).toBeGreaterThanOrEqual(0);
    expect(ratingGroup).toBeGreaterThan(correctionStart);
    expect(template).toContain("@if (comment.user_id !== authService.currentUser()?.id)");
  });

  it('wires both server-authoritative vote actions and visible counts', () => {
    expect(template).toContain("voteOnCorrection(moment.id, comment, 'up')");
    expect(template).toContain("voteOnCorrection(moment.id, comment, 'down')");
    expect(template).toContain('{{ comment.upVotes ?? 0 }}');
    expect(template).toContain('{{ comment.downVotes ?? 0 }}');
  });

  it('exposes pressed state and touch-sized accessible actions', () => {
    expect(template).toContain("[attr.aria-pressed]=\"comment.userVote === 'up'\"");
    expect(template).toContain("[attr.aria-pressed]=\"comment.userVote === 'down'\"");
    // 7e69864f4 made the labels translation-safe.
    expect(template).toContain(`[attr.aria-label]="('moments.correctBtn' | t) + ' 👍'"`);
    expect(template).toContain(`[attr.aria-label]="('moments.correctBtn' | t) + ' 👎'"`);
    expect(template.match(/min-h-11 min-w-11/g)?.length).toBe(2);
  });
});
