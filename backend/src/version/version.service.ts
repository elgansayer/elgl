import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
}

const DEFAULT_MINIMUM_SUPPORTED_VERSION = '1.0.0';
const STABLE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGithubRelease(value: unknown): value is GithubRelease {
  if (!isRecord(value)) {
    return false;
  }
  const tagName = value['tag_name'];
  const htmlUrl = value['html_url'];
  return (
    (tagName === undefined || typeof tagName === 'string') &&
    (htmlUrl === undefined || typeof htmlUrl === 'string')
  );
}

function parseMinimumSupportedVersion(value: string | undefined): string {
  if (value === undefined) {
    return DEFAULT_MINIMUM_SUPPORTED_VERSION;
  }

  const candidate = value.trim();
  if (!STABLE_SEMVER_PATTERN.test(candidate)) {
    throw new Error(
      'MINIMUM_SUPPORTED_APP_VERSION must be a stable semantic version (major.minor.patch)',
    );
  }

  return candidate;
}

@Injectable()
export class VersionService implements OnModuleInit {
  private readonly logger = new Logger(VersionService.name);
  private readonly currentVersion: string;
  private latestVersion: string;
  private updateUrl?: string;
  private readonly minimumSupportedVersion: string;

  constructor() {
    this.currentVersion = process.env.npm_package_version || '0.0.0';
    this.latestVersion = this.currentVersion;
    this.minimumSupportedVersion = parseMinimumSupportedVersion(
      process.env.MINIMUM_SUPPORTED_APP_VERSION,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.refreshLatestVersion();
  }

  private async refreshLatestVersion(): Promise<void> {
    const repo = process.env.GITHUB_REPO;
    if (!repo) {
      this.logger.warn(
        'GITHUB_REPO not set; version check will use current version',
      );
      this.latestVersion = this.currentVersion;
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5-second timeout
      let res: Response;
      try {
        res = await fetch(
          `https://api.github.com/repos/${repo}/releases/latest`,
          {
            method: 'GET',
            headers: { Accept: 'application/vnd.github.v3+json' },
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        this.logger.warn(`GitHub API responded with ${res.status}`);
        this.latestVersion = this.currentVersion;
        return;
      }
      const data: unknown = await res.json();
      if (!isGithubRelease(data)) {
        this.logger.warn('GitHub API response did not match expected shape');
        this.latestVersion = this.currentVersion;
        return;
      }
      const tag =
        typeof data.tag_name === 'string'
          ? data.tag_name.replace(/^v/i, '')
          : '';
      if (tag) {
        this.latestVersion = tag;
        if (typeof data.html_url === 'string') {
          this.updateUrl = data.html_url;
        }
      } else {
        this.latestVersion = this.currentVersion;
      }
      this.logger.log(`Latest version fetched: ${this.latestVersion}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.stack || err.message : String(err);
      this.logger.error('Failed to fetch latest version from GitHub', {
        error: message,
      });
      this.latestVersion = this.currentVersion;
    }
  }

  getVersion(): {
    current: string;
    latest: string;
    updateUrl?: string;
    minimumSupported: string;
  } {
    return {
      current: this.currentVersion,
      latest: this.latestVersion,
      updateUrl: this.updateUrl,
      minimumSupported: this.minimumSupportedVersion,
    };
  }

  getMinimumSupportedVersion(): { minimumSupported: string } {
    return {
      minimumSupported: this.minimumSupportedVersion,
    };
  }
}
