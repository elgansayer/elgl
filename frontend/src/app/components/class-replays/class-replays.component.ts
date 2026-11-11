import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import {
  ClassReplay,
  ClassReplayPlayback,
  ClassReplayService,
} from '../../services/class-replay.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-class-replays',
  imports: [RouterLink, TranslatePipe, HlmButton],
  templateUrl: './class-replays.component.html',
})
export class ClassReplaysComponent {
  private readonly replayService = inject(ClassReplayService);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly selectedId = signal<string | null>(null);
  readonly retrying = signal(false);
  readonly retryFailed = signal(false);

  readonly replaysResource = resource({
    loader: () => this.replayService.listReplays(),
  });

  readonly replays = computed(() => this.replaysResource.value() ?? []);
  readonly hasReplays = computed(() => this.replays().length > 0);

  readonly selectedReplay = computed(
    () => this.replays().find((replay) => replay.id === this.selectedId()) ?? null,
  );

  readonly playbackResource = resource<ClassReplayPlayback | null, string | null>({
    params: () => {
      const replay = this.selectedReplay();
      return replay?.status === 'ready' ? replay.id : null;
    },
    loader: async ({ params }) => (params ? this.replayService.getPlayback(params) : null),
  });

  readonly playback = computed<ClassReplayPlayback | null>(
    () => this.playbackResource.value() ?? null,
  );

  readonly canRetrySelected = computed(() => {
    const replay = this.selectedReplay();
    const currentUserId = this.authService.currentUser()?.id;
    return replay?.status === 'failed' && !!currentUserId && replay.host_id === currentUserId;
  });

  selectReplay(replay: ClassReplay): void {
    this.selectedId.set(replay.id);
    this.retryFailed.set(false);
  }

  refresh(): void {
    this.replaysResource.reload();
    if (this.selectedId()) {
      this.playbackResource.reload();
    }
  }

  async retrySelected(): Promise<void> {
    const replay = this.selectedReplay();
    if (!replay || this.retrying()) return;

    this.retrying.set(true);
    this.retryFailed.set(false);
    try {
      await this.replayService.retryReplay(replay.id);
      this.replaysResource.reload();
      this.playbackResource.reload();
    } catch {
      this.retryFailed.set(true);
    } finally {
      this.retrying.set(false);
    }
  }

  statusKey(replay: ClassReplay | ClassReplayPlayback): string {
    return `classReplays.status.${replay.status}`;
  }

  hasPlaybackSource(playback: ClassReplayPlayback | null): boolean {
    return Boolean(playback?.hls_url || playback?.dash_url || playback?.download_url);
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      dateStyle: 'medium',
    }).format(new Date(value));
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null || seconds < 0) return '';
    const wholeSeconds = Math.round(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = wholeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }
}
