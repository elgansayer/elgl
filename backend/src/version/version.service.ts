import { Injectable } from '@nestjs/common';

@Injectable()
export class VersionService {
  getMinimumSupportedVersion() {
    return {
      minimum_version: '1.0.0',
      latest_version: '1.0.0',
      update_required: false,
    };
  }
}
