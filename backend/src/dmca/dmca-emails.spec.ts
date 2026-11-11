import {
  claimantContentDisabledEmail,
  claimantCounterNoticeEmail,
  claimantNeedsReviewEmail,
  clean,
  closureEmail,
  ownerContentDisabledEmail,
  ownerCounterNoticeEmail,
  verificationEmail,
} from './dmca-emails';

describe('dmca emails', () => {
  it('strips control characters and bounds user-supplied text', () => {
    expect(clean('a\u0000b\u001bc\td')).toBe('a b c\td');
    expect(clean('x'.repeat(700))).toHaveLength(603);
    expect(clean(null)).toBe('');
  });

  it('never lets claimant text add a header-like line to a subject', () => {
    const email = ownerContentDisabledEmail({
      reference: 'DMCA-ABCDEFGHJK',
      claimantName: 'Eve\r\nBcc: attacker@example.com',
      claimantOrganisation: null,
      claimantEmail: 'eve@example.com',
      copyrightedWork: 'My song',
      kind: 'moment',
      manageUrl: 'https://app.example.com/settings/copyright-notices',
      waitBusinessDays: 10,
    });

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toBe(
      'Copyright notice DMCA-ABCDEFGHJK: your content was disabled',
    );
  });

  it('gives the claimant a single-use confirmation link with its lifetime', () => {
    const email = verificationEmail({
      references: ['DMCA-AAAAAAAAAA', 'DMCA-BBBBBBBBBB'],
      verifyUrl: 'https://app.example.com/dmca/verify?token=abc',
      ttlHours: 72,
    });

    expect(email.text).toContain(
      'References: DMCA-AAAAAAAAAA, DMCA-BBBBBBBBBB',
    );
    expect(email.text).toContain(
      'https://app.example.com/dmca/verify?token=abc',
    );
    expect(email.text).toContain('works once and expires in 72 hours');
    expect(email.text).toContain('nothing will be removed');
  });

  it('tells the account holder who complained, what to do and what a false counter-notice risks', () => {
    const email = ownerContentDisabledEmail({
      reference: 'DMCA-ABCDEFGHJK',
      claimantName: 'Ana Costa',
      claimantOrganisation: 'Costa Music',
      claimantEmail: 'ana@example.com',
      copyrightedWork: 'Song "Mar"',
      kind: 'moment_comment',
      manageUrl: 'https://app.example.com/settings/copyright-notices',
      waitBusinessDays: 10,
    });

    expect(email.text).toContain('your comment');
    expect(email.text).toContain('Ana Costa (Costa Music)');
    expect(email.text).toContain('ana@example.com');
    expect(email.text).toContain('counter-notification');
    expect(email.text).toContain('10 business days');
    expect(email.text).toContain('misrepresenting');
  });

  it('forwards counter-notification details and the restore date to the claimant', () => {
    const email = claimantCounterNoticeEmail({
      reference: 'DMCA-ABCDEFGHJK',
      fullName: 'Sam Lee',
      address: '1 Road, Town',
      phone: null,
      restoreAfter: new Date('2026-11-25T09:30:00.000Z'),
    });

    expect(email.text).toContain('Sam Lee');
    expect(email.text).toContain('1 Road, Town');
    expect(email.text).not.toContain('Phone:');
    expect(email.text).toContain('2026-11-25');
    expect(email.text).toContain('penalty of perjury');
  });

  it('confirms the schedule to the account holder', () => {
    const email = ownerCounterNoticeEmail({
      reference: 'DMCA-ABCDEFGHJK',
      restoreAfter: new Date('2026-11-25T09:30:00.000Z'),
    });
    expect(email.text).toContain('2026-11-25');
  });

  it.each(['restored', 'rejected', 'withdrawn'] as const)(
    'explains a %s closure to both parties',
    (outcome) => {
      for (const audience of ['claimant', 'owner'] as const) {
        const email = closureEmail({
          reference: 'DMCA-ABCDEFGHJK',
          outcome,
          audience,
        });
        expect(email.subject).toBe('Copyright notice DMCA-ABCDEFGHJK: closed');
        expect(email.text).toContain('restored');
      }
    },
  );

  it('includes the reference in the remaining claimant updates', () => {
    expect(
      claimantContentDisabledEmail({
        reference: 'DMCA-ABCDEFGHJK',
        waitBusinessDays: 10,
      }).subject,
    ).toContain('DMCA-ABCDEFGHJK');
    expect(
      claimantNeedsReviewEmail({ reference: 'DMCA-ABCDEFGHJK' }).text,
    ).toContain('could not match');
  });
});
