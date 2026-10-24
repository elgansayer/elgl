import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const template = readFileSync(
  fileURLToPath(new URL('./moments-feed.component.html', import.meta.url)),
  'utf8',
);

describe('Moments correction quality controls', () => {
  it('renders rating controls only inside correction comments', () => {
    const correctionStart = template.indexOf('@if (comment.correction_payload)');
    const ratingGroup = template.indexOf('aria-label="Correction quality"');

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
    expect(template).toContain('aria-label="Mark correction helpful"');
    expect(template).toContain('aria-label="Mark correction not helpful"');
    expect(template.match(/min-h-11 min-w-11/g)?.length).toBe(2);
  });
});
