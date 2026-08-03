import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
}

function isGithubRelease(value: unknown): value is GithubRelease {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const tagNameValid =
    !('tag_name' in value) || typeof value.tag_name === 'string';
  const htmlUrlValid =
    !('html_url' in value) || typeof value.html_url === 'string';
  return tagNameValid && htmlUrlValid;
}

@Injectable()
export class VersionService implements OnModuleInit {
  private readonly logger = new Logger(VersionService.name);
  private readonly currentVersion: string;
  private latestVersion: string;
  private updateUrl?: string;

  constructor() {
    this.currentVersion = process.env.npm_package_version || '0.0.0';
    this.latestVersion = this.currentVersion;
  }

  async onModuleInit(): Promise<void> {
    await this.refreshLatestVersion();
  }

  private async refreshLatestVersion(): Promise<void> {
    const repo = process.env.GITHUB_REPO || '';
    if (!repo) {
      this.logger.warn(
        'GITHUB_REPO not set; version check will use current version',
      );
      this.latestVersion = this.currentVersion;
      return;
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          method: 'GET',
          headers: { Accept: 'application/vnd.github.v3+json' },
        },
      );
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
      this.logger.error('Failed to fetch latest version from GitHub', err);
      this.latestVersion = this.currentVersion;
    }
  }

  getVersion(): { current: string; latest: string; updateUrl?: string } {
    return {
      current: this.currentVersion,
      latest: this.latestVersion,
      updateUrl: this.updateUrl,
    };
  }
}
