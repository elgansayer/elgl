import { SetMetadata } from '@nestjs/common';
import { AdminCapability } from '../admin-capabilities';

export const ADMIN_CAPABILITIES_METADATA_KEY = 'admin.required-capabilities';

export const RequireAdminCapabilities = (
  ...capabilities: AdminCapability[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(ADMIN_CAPABILITIES_METADATA_KEY, capabilities);
