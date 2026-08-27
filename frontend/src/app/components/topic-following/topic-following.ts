import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  HashtagTopicsService,
  type HashtagTopicSummary,
} from '../../services/hashtag-topics.service';

@Component({
  selector: 'app-topic-following',
  standalone: true,
  imports: [HlmButton, RouterLink, TranslatePipe],
  templateUrl: './topic-following.html',
  styleUrls: ['./topic-following.scss'],
})
export class TopicFollowingComponent {
  readonly i18n = inject(I18nService);
  private readonly hashtagTopicsService = inject(HashtagTopicsService);

  readonly topics = signal<HashtagTopicSummary[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly mutatingHashtag = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    this.hasError.set(false);
    try {
      this.topics.set(await this.hashtagTopicsService.getTrending(8));
    } catch {
      this.topics.set([]);
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleFollow(topic: HashtagTopicSummary): Promise<void> {
    if (this.mutatingHashtag()) return;
    this.mutatingHashtag.set(topic.hashtag);
    this.hasError.set(false);
    try {
      if (topic.is_following) {
        await this.hashtagTopicsService.unfollow(topic.hashtag);
      } else {
        await this.hashtagTopicsService.follow(topic.hashtag);
      }
      this.topics.update((topics) =>
        topics.map((candidate) =>
          candidate.hashtag === topic.hashtag
            ? { ...candidate, is_following: !topic.is_following }
            : candidate,
        ),
      );
    } catch {
      this.hasError.set(true);
    } finally {
      this.mutatingHashtag.set(null);
    }
  }
}
