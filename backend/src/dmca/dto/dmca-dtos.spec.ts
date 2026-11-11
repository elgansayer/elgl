import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminDmcaDecisionDto, AdminDmcaListQueryDto } from './admin-dmca.dto';
import { CreateCounterNoticeDto } from './create-counter-notice.dto';
import { CreateDmcaNoticeDto } from './create-dmca-notice.dto';
import { OwnerNoticesQueryDto } from './owner-notices-query.dto';
import { VerifyDmcaNoticeDto } from './verify-dmca-notice.dto';

const MOMENT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

async function check<T extends object>(type: new () => T, body: unknown) {
  const instance = plainToInstance(type, body);
  const errors = await validate(instance);
  return { instance, properties: errors.map((error) => error.property) };
}

const validNotice = {
  claimantName: '  Ana Costa ',
  claimantEmail: 'ana@example.com',
  copyrightedWork: 'The song "Mar" released in 2019',
  materialReferences: [MOMENT],
  goodFaithStatement: true,
  accuracyStatement: true,
  electronicSignature: 'Ana Costa',
};

describe('CreateDmcaNoticeDto', () => {
  it('accepts a complete notice and trims text', async () => {
    const { instance, properties } = await check(
      CreateDmcaNoticeDto,
      validNotice,
    );
    expect(properties).toEqual([]);
    expect(instance.claimantName).toBe('Ana Costa');
  });

  it('treats blank optional fields as absent', async () => {
    const { instance, properties } = await check(CreateDmcaNoticeDto, {
      ...validNotice,
      claimantOrganisation: '   ',
      claimantPhone: '',
    });
    expect(properties).toEqual([]);
    expect(instance.claimantOrganisation).toBeUndefined();
    expect(instance.claimantPhone).toBeUndefined();
  });

  it.each(['goodFaithStatement', 'accuracyStatement'])(
    'requires %s to be explicitly true',
    async (field) => {
      for (const value of [false, 'true', undefined, 1]) {
        const { properties } = await check(CreateDmcaNoticeDto, {
          ...validNotice,
          [field]: value,
        });
        expect(properties).toContain(field);
      }
    },
  );

  it.each([
    ['claimantName', 'A'],
    ['claimantEmail', 'not-an-email'],
    ['copyrightedWork', 'too short'],
    ['electronicSignature', ''],
  ])('rejects an invalid %s', async (field, value) => {
    const { properties } = await check(CreateDmcaNoticeDto, {
      ...validNotice,
      [field]: value,
    });
    expect(properties).toContain(field);
  });

  it.each([
    ['none', []],
    ['too many', Array.from({ length: 11 }, (_, i) => `ref-${i}`)],
    ['duplicates', [MOMENT, MOMENT]],
    ['blank entry', ['   ']],
    ['oversized entry', ['x'.repeat(2049)]],
    ['not a list', MOMENT],
  ])('rejects materialReferences: %s', async (_label, materialReferences) => {
    const { properties } = await check(CreateDmcaNoticeDto, {
      ...validNotice,
      materialReferences,
    });
    expect(properties).toContain('materialReferences');
  });
});

describe('CreateCounterNoticeDto', () => {
  const valid = {
    fullName: 'Sam Lee',
    address: '1 Road, Town',
    goodFaithStatement: true,
    jurisdictionConsent: true,
    electronicSignature: 'Sam Lee',
  };

  it('accepts a complete counter-notification', async () => {
    expect((await check(CreateCounterNoticeDto, valid)).properties).toEqual([]);
  });

  it.each(['goodFaithStatement', 'jurisdictionConsent'])(
    'requires %s',
    async (field) => {
      const { properties } = await check(CreateCounterNoticeDto, {
        ...valid,
        [field]: false,
      });
      expect(properties).toContain(field);
    },
  );

  it('requires a postal address', async () => {
    const { properties } = await check(CreateCounterNoticeDto, {
      ...valid,
      address: 'x',
    });
    expect(properties).toContain('address');
  });
});

describe('VerifyDmcaNoticeDto', () => {
  it('accepts only a 43 character url-safe token', async () => {
    expect(
      (await check(VerifyDmcaNoticeDto, { token: 'A'.repeat(43) })).properties,
    ).toEqual([]);
    for (const token of [
      '',
      'A'.repeat(42),
      'A'.repeat(44),
      `${'A'.repeat(42)}!`,
      7,
    ]) {
      expect(
        (await check(VerifyDmcaNoticeDto, { token })).properties,
      ).toContain('token');
    }
  });
});

describe('admin DTOs', () => {
  it('limits the status filter and page size', async () => {
    expect(
      (
        await check(AdminDmcaListQueryDto, {
          status: 'needs_review',
          page: '2',
          pageSize: '50',
        })
      ).properties,
    ).toEqual([]);
    expect(
      (await check(AdminDmcaListQueryDto, { status: 'deleted' })).properties,
    ).toContain('status');
    expect(
      (await check(AdminDmcaListQueryDto, { pageSize: '101' })).properties,
    ).toContain('pageSize');
    expect(
      (await check(AdminDmcaListQueryDto, { page: '0' })).properties,
    ).toContain('page');
    expect(
      (await check(AdminDmcaListQueryDto, { page: 'abc' })).properties,
    ).toContain('page');
  });

  it('bounds the owner listing the same way', async () => {
    expect(
      (await check(OwnerNoticesQueryDto, { page: '3', pageSize: '100' }))
        .properties,
    ).toEqual([]);
    expect(
      (await check(OwnerNoticesQueryDto, { pageSize: '500' })).properties,
    ).toContain('pageSize');
  });

  it('accepts only known decisions with an audited reason', async () => {
    const base = { decision: 'reject', reasonCode: 'legal_request' };
    expect((await check(AdminDmcaDecisionDto, base)).properties).toEqual([]);
    expect(
      (
        await check(AdminDmcaDecisionDto, {
          ...base,
          decision: 'delete_account',
        })
      ).properties,
    ).toContain('decision');
    expect(
      (await check(AdminDmcaDecisionDto, { ...base, reasonCode: 'because' }))
        .properties,
    ).toContain('reasonCode');
    expect(
      (await check(AdminDmcaDecisionDto, { decision: 'reject' })).properties,
    ).toContain('reasonCode');
  });

  it('validates a named target and bounds the operator note', async () => {
    const base = { decision: 'disable', reasonCode: 'legal_request' };
    expect(
      (
        await check(AdminDmcaDecisionDto, {
          ...base,
          targetType: 'moment',
          targetId: MOMENT,
        })
      ).properties,
    ).toEqual([]);
    expect(
      (
        await check(AdminDmcaDecisionDto, {
          ...base,
          targetType: 'profile',
          targetId: MOMENT,
        })
      ).properties,
    ).toContain('targetType');
    expect(
      (
        await check(AdminDmcaDecisionDto, {
          ...base,
          targetType: 'moment',
          targetId: 'nope',
        })
      ).properties,
    ).toContain('targetId');
    expect(
      (
        await check(AdminDmcaDecisionDto, {
          ...base,
          operatorNote: 'x'.repeat(1001),
        })
      ).properties,
    ).toContain('operatorNote');
  });
});
