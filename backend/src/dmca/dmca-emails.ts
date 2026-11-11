/**
 * Plain-text copy for every DMCA message. It lives in one module, keyed by
 * message, so a backend message catalogue can replace it without touching the
 * workflow. User-supplied text is length-bounded and stripped of control
 * characters before it is embedded.
 */

export interface DmcaEmail {
  subject: string;
  text: string;
}

const SIGN_OFF = '- HelloTalk Copyright Team';
const FIELD_LIMIT = 600;

function isStrippedControlCode(code: number): boolean {
  // Keep tab (9), line feed (10) and carriage return (13); drop the rest of C0 and DEL.
  return (
    (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
  );
}

export function clean(
  value: string | null | undefined,
  limit = FIELD_LIMIT,
): string {
  if (!value) return '';

  const stripped = Array.from(value, (character) =>
    isStrippedControlCode(character.charCodeAt(0)) ? ' ' : character,
  ).join('');
  return stripped.length > limit ? `${stripped.slice(0, limit)}...` : stripped;
}

export function verificationEmail(input: {
  references: string[];
  verifyUrl: string;
  ttlHours: number;
}): DmcaEmail {
  return {
    subject: 'Confirm your copyright notice',
    text: [
      'We received a copyright takedown notice from this email address.',
      '',
      `Reference${input.references.length > 1 ? 's' : ''}: ${input.references.join(', ')}`,
      '',
      'Confirm the notice to start processing it:',
      input.verifyUrl,
      '',
      `The link works once and expires in ${input.ttlHours} hours. If you did not submit a notice, ignore this email and nothing will be removed.`,
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}

export function claimantContentDisabledEmail(input: {
  reference: string;
  waitBusinessDays: number;
}): DmcaEmail {
  return {
    subject: `Copyright notice ${input.reference}: material disabled`,
    text: [
      `We disabled access to the material identified in notice ${input.reference}.`,
      '',
      `The account holder has been told and may send a counter-notification. If one is received, we will forward it to you and restore the material after ${input.waitBusinessDays} business days unless you tell us you have filed a court action seeking an order to keep it down.`,
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}

export function claimantNeedsReviewEmail(input: {
  reference: string;
}): DmcaEmail {
  return {
    subject: `Copyright notice ${input.reference}: under review`,
    text: [
      `Your notice ${input.reference} is confirmed, but we could not match the material you identified to content on the service automatically.`,
      '',
      'A member of our team will review it. Replying with a direct link to the material or its content identifier will speed this up.',
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}

export function ownerContentDisabledEmail(input: {
  reference: string;
  claimantName: string;
  claimantOrganisation: string | null;
  claimantEmail: string;
  copyrightedWork: string;
  kind: 'moment' | 'moment_comment';
  manageUrl: string;
  waitBusinessDays: number;
}): DmcaEmail {
  const claimant = input.claimantOrganisation
    ? `${clean(input.claimantName, 200)} (${clean(input.claimantOrganisation, 200)})`
    : clean(input.claimantName, 200);
  return {
    subject: `Copyright notice ${input.reference}: your content was disabled`,
    text: [
      `We received a copyright notice (${input.reference}) about your ${
        input.kind === 'moment' ? 'Moment' : 'comment'
      } and disabled access to it, as the law requires.`,
      '',
      `Complaining party: ${claimant}`,
      `Contact: ${clean(input.claimantEmail, 254)}`,
      `Work they say was copied: ${clean(input.copyrightedWork)}`,
      '',
      'If you believe this was a mistake or the material was misidentified, you can send a counter-notification here:',
      input.manageUrl,
      '',
      `If you do, we will pass it to the complaining party and restore your content after ${input.waitBusinessDays} business days unless they tell us they have started a court action.`,
      'Knowingly misrepresenting that material was removed by mistake can make you liable for damages. Accounts with repeated valid notices can be closed.',
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}

export function claimantCounterNoticeEmail(input: {
  reference: string;
  fullName: string;
  address: string;
  phone: string | null;
  restoreAfter: Date;
}): DmcaEmail {
  return {
    subject: `Copyright notice ${input.reference}: counter-notification received`,
    text: [
      `The account holder sent a counter-notification for notice ${input.reference}.`,
      '',
      `Name: ${clean(input.fullName, 200)}`,
      `Address: ${clean(input.address, 500)}`,
      input.phone ? `Phone: ${clean(input.phone, 40)}` : null,
      'They state, under penalty of perjury, a good faith belief the material was removed by mistake or misidentification, and consent to the jurisdiction of the court for the address above.',
      '',
      `Unless you notify us before ${input.restoreAfter.toISOString().slice(0, 10)} that you have filed an action seeking a court order against this person, we will restore the material.`,
      '',
      SIGN_OFF,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

export function ownerCounterNoticeEmail(input: {
  reference: string;
  restoreAfter: Date;
}): DmcaEmail {
  return {
    subject: `Copyright notice ${input.reference}: counter-notification sent`,
    text: [
      `We forwarded your counter-notification for notice ${input.reference} to the complaining party.`,
      '',
      `Your content will be restored on or after ${input.restoreAfter.toISOString().slice(0, 10)} unless they tell us they have filed a court action.`,
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}

export type DmcaClosureOutcome = 'restored' | 'rejected' | 'withdrawn';

const CLOSURE_SENTENCE: Record<DmcaClosureOutcome, string> = {
  restored:
    'The waiting period after the counter-notification has ended, so the material was restored.',
  rejected:
    'After review, the notice was rejected and the material was restored.',
  withdrawn:
    'The complaining party withdrew the notice, so the material was restored.',
};

export function closureEmail(input: {
  reference: string;
  outcome: DmcaClosureOutcome;
  audience: 'claimant' | 'owner';
}): DmcaEmail {
  return {
    subject: `Copyright notice ${input.reference}: closed`,
    text: [
      `Notice ${input.reference} is now closed.`,
      '',
      CLOSURE_SENTENCE[input.outcome],
      '',
      SIGN_OFF,
    ].join('\n'),
  };
}
