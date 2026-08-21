import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal, inject } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-topic-following',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  templateUrl: './topic-following.html',
  styleUrls: ['./topic-following.scss'],
})
export class TopicFollowingComponent {
  readonly i18n = inject(I18nService);
  readonly topics = signal<{ id: string; name: string; isFollowing: boolean }[]>([
    { id: '1', name: '#languagelearning', isFollowing: false },
    { id: '2', name: '#polyglot', isFollowing: true },
    { id: '3', name: '#culturalexchange', isFollowing: false },
  ]);

  toggleFollow(topicId: string) {
    this.topics.update((topics) =>
      topics.map((t) => (t.id === topicId ? { ...t, isFollowing: !t.isFollowing } : t)),
    );
  }
}
