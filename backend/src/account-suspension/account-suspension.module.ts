import { Global, Module } from '@nestjs/common';
import { AccountSuspensionService } from './account-suspension.service';

/**
 * Global so the authentication guard, which is instantiated inside every
 * feature module that protects a route, can resolve the suspension lookup.
 */
@Global()
@Module({
  providers: [AccountSuspensionService],
  exports: [AccountSuspensionService],
})
export class AccountSuspensionModule {}
