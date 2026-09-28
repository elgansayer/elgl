import {
  assertMockFixtureIntegrity,
  validateMockFixtureIntegrity,
} from './fixture-integrity';

describe('mock fixture referential integrity', () => {
  it('orders dependent collections topologically and reports valid references', () => {
    const report = validateMockFixtureIntegrity([
      {
        name: 'users',
        records: [{ id: 'user-1' }],
      },
      {
        name: 'rooms',
        records: [{ id: 'room-1', owner_id: 'user-1' }],
        references: [{ field: 'owner_id', targetCollection: 'users' }],
      },
      {
        name: 'messages',
        records: [
          {
            id: 'message-1',
            room_id: 'room-1',
            sender_id: 'user-1',
            reply_to_id: null,
          },
        ],
        references: [
          { field: 'room_id', targetCollection: 'rooms' },
          { field: 'sender_id', targetCollection: 'users' },
          {
            field: 'reply_to_id',
            targetCollection: 'messages',
            optional: true,
            cyclePolicy: 'forbid',
          },
        ],
      },
      {
        name: 'media',
        records: [{ id: 'media-1', message_id: 'message-1' }],
        references: [{ field: 'message_id', targetCollection: 'messages' }],
      },
      {
        name: 'transactions',
        records: [{ id: 'transaction-1', user_id: 'user-1' }],
        references: [{ field: 'user_id', targetCollection: 'users' }],
      },
    ]);

    expect(report.valid).toBe(true);
    expect(report.recordCount).toBe(5);
    expect(report.creationOrder.indexOf('users')).toBeLessThan(
      report.creationOrder.indexOf('rooms'),
    );
    expect(report.creationOrder.indexOf('rooms')).toBeLessThan(
      report.creationOrder.indexOf('messages'),
    );
    expect(report.creationOrder.indexOf('messages')).toBeLessThan(
      report.creationOrder.indexOf('media'),
    );
    expect(report.summary).toContain('Mock fixture integrity OK');
  });

  it('rejects dangling foreign keys and duplicate fixture identifiers', () => {
    const report = validateMockFixtureIntegrity([
      {
        name: 'users',
        records: [{ id: 'user-1' }, { id: 'user-1' }],
      },
      {
        name: 'rooms',
        records: [{ id: 'room-1', owner_id: 'missing-user' }],
        references: [{ field: 'owner_id', targetCollection: 'users' }],
      },
    ]);

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: 'users',
          message: 'Duplicate fixture identifier',
        }),
        expect.objectContaining({
          collection: 'rooms',
          field: 'owner_id',
          message: 'Dangling fixture reference to users.id: missing-user',
        }),
      ]),
    );
    expect(() =>
      assertMockFixtureIntegrity([
        {
          name: 'users',
          records: [{ id: 'user-1' }],
        },
        {
          name: 'rooms',
          records: [{ id: 'room-1', owner_id: 'missing-user' }],
          references: [{ field: 'owner_id', targetCollection: 'users' }],
        },
      ]),
    ).toThrow('Mock fixture integrity failed');
  });

  it('validates polymorphic references against the declared target map', () => {
    const valid = validateMockFixtureIntegrity([
      { name: 'users', records: [{ id: 'user-1' }] },
      { name: 'rooms', records: [{ id: 'room-1' }] },
      {
        name: 'activity',
        records: [
          { id: 'activity-1', subject_type: 'user', subject_id: 'user-1' },
          { id: 'activity-2', subject_type: 'room', subject_id: 'room-1' },
        ],
        references: [
          {
            field: 'subject_id',
            targetCollectionField: 'subject_type',
            targetCollectionMap: {
              user: 'users',
              room: 'rooms',
            },
          },
        ],
      },
    ]);
    expect(valid.valid).toBe(true);

    const invalid = validateMockFixtureIntegrity([
      { name: 'users', records: [{ id: 'user-1' }] },
      {
        name: 'activity',
        records: [
          { id: 'activity-1', subject_type: 'unknown', subject_id: 'user-1' },
        ],
        references: [
          {
            field: 'subject_id',
            targetCollectionField: 'subject_type',
            targetCollectionMap: { user: 'users' },
          },
        ],
      },
    ]);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]?.message).toBe(
      'Fixture reference target collection is unknown',
    );
  });

  it('rejects reply cycles while allowing intentional social graph cycles', () => {
    const replyReport = validateMockFixtureIntegrity([
      {
        name: 'messages',
        records: [
          { id: 'message-1', reply_to_id: 'message-2' },
          { id: 'message-2', reply_to_id: 'message-1' },
        ],
        references: [
          {
            field: 'reply_to_id',
            targetCollection: 'messages',
            cyclePolicy: 'forbid',
          },
        ],
      },
    ]);
    expect(replyReport.valid).toBe(false);
    expect(replyReport.summary).toContain('Forbidden reference cycle');

    const socialReport = validateMockFixtureIntegrity([
      {
        name: 'users',
        records: [
          { id: 'user-1', favourite_user_id: 'user-2' },
          { id: 'user-2', favourite_user_id: 'user-1' },
        ],
        references: [
          {
            field: 'favourite_user_id',
            targetCollection: 'users',
            cyclePolicy: 'allow',
          },
        ],
      },
    ]);
    expect(socialReport.valid).toBe(true);
  });

  it('reports circular collection dependencies with actionable collection names', () => {
    const report = validateMockFixtureIntegrity([
      {
        name: 'rooms',
        records: [{ id: 'room-1', message_id: 'message-1' }],
        references: [{ field: 'message_id', targetCollection: 'messages' }],
      },
      {
        name: 'messages',
        records: [{ id: 'message-1', room_id: 'room-1' }],
        references: [{ field: 'room_id', targetCollection: 'rooms' }],
      },
    ]);

    expect(report.valid).toBe(false);
    expect(report.summary).toContain('Circular collection dependency');
    expect(report.summary).toContain('rooms');
    expect(report.summary).toContain('messages');
  });
});
