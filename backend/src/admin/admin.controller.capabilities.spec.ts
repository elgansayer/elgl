import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AdminController } from './admin.controller';
import { ADMIN_CAPABILITIES_METADATA_KEY } from './decorators/require-admin-capabilities.decorator';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';

const ROUTE_CAPABILITIES = [
  ['listUsers', 'users.read'],
  ['setVipStatus', 'users.manage'],
  ['getLoginHistory', 'users.sessions.read'],
  ['banUser', 'moderation.cases.manage'],
  ['warnUser', 'moderation.cases.manage'],
  ['listAllBlocks', 'moderation.cases.read'],
  ['listReports', 'moderation.cases.read'],
  ['removeBlock', 'moderation.cases.manage'],
] as const;

const MODERATION_ACTION_ROUTES = [
  ['banUser', 'users/:id/ban'],
  ['warnUser', 'users/:id/warn'],
] as const;

describe('AdminController legacy capability boundaries', () => {
  it.each(ROUTE_CAPABILITIES)(
    '%s requires %s through AdminCapabilityGuard',
    (methodName, capability) => {
      const method = AdminController.prototype[methodName];
      const required = Reflect.getMetadata(
        ADMIN_CAPABILITIES_METADATA_KEY,
        method,
      ) as string[] | undefined;
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) as
        unknown[] | undefined;

      expect(required).toEqual([capability]);
      expect(guards).toContain(AdminCapabilityGuard);
    },
  );

  it.each(MODERATION_ACTION_ROUTES)(
    '%s remains a POST /admin/%s endpoint',
    (methodName, path) => {
      const method = AdminController.prototype[methodName];

      expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(
        RequestMethod.POST,
      );
    },
  );
});
