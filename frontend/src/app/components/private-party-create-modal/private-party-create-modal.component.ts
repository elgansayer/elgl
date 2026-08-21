import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, output, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

export interface PrivatePartyCreatePayload {
  title: string;
  languagePair: string;
  topicTag: string;
  isVideoStream: boolean;
  invitedUserIds: string[];
}

interface SelectOption {
  value: string;
  labelKey: string;
}

interface FriendProfile {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
}

@Component({
  selector: 'app-private-party-create-modal',
  imports: [HlmCheckbox, HlmNativeSelect, HlmInput, HlmButton, FormsModule, TranslatePipe],
  templateUrl: './private-party-create-modal.component.html',
})
export class PrivatePartyCreateModalComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  readonly closed = output<void>();
  readonly created = output<PrivatePartyCreatePayload>();

  readonly LANGUAGE_PAIR_OPTIONS: readonly SelectOption[] = [
    { value: 'en-es', labelKey: 'audioRoom.languagePair.en-es' },
    { value: 'en-fr', labelKey: 'audioRoom.languagePair.en-fr' },
    { value: 'en-ja', labelKey: 'audioRoom.languagePair.en-ja' },
    { value: 'ar-en', labelKey: 'audioRoom.languagePair.ar-en' },
    { value: 'en-ko', labelKey: 'audioRoom.languagePair.en-ko' },
    { value: 'en-zh', labelKey: 'audioRoom.languagePair.en-zh' },
    { value: 'en-pt', labelKey: 'audioRoom.languagePair.en-pt' },
    { value: 'en-ru', labelKey: 'audioRoom.languagePair.en-ru' },
    { value: 'en-de', labelKey: 'audioRoom.languagePair.en-de' },
    { value: 'en-it', labelKey: 'audioRoom.languagePair.en-it' },
    { value: 'en-hi', labelKey: 'audioRoom.languagePair.en-hi' },
    { value: 'en-tr', labelKey: 'audioRoom.languagePair.en-tr' },
    { value: 'ja-en', labelKey: 'audioRoom.languagePair.ja-en' },
    { value: 'ko-en', labelKey: 'audioRoom.languagePair.ko-en' },
    { value: 'zh-en', labelKey: 'audioRoom.languagePair.zh-en' },
    { value: 'fr-en', labelKey: 'audioRoom.languagePair.fr-en' },
    { value: 'es-en', labelKey: 'audioRoom.languagePair.es-en' },
    { value: 'de-en', labelKey: 'audioRoom.languagePair.de-en' },
    { value: 'pt-en', labelKey: 'audioRoom.languagePair.pt-en' },
    { value: 'it-en', labelKey: 'audioRoom.languagePair.it-en' },
    { value: 'ru-en', labelKey: 'audioRoom.languagePair.ru-en' },
    { value: 'ar-fr', labelKey: 'audioRoom.languagePair.ar-fr' },
    { value: 'fr-ar', labelKey: 'audioRoom.languagePair.fr-ar' },
  ];

  readonly TOPIC_OPTIONS: readonly SelectOption[] = [
    { value: 'Pronunciation', labelKey: 'audioRoom.topic.Pronunciation' },
    { value: 'Beginners', labelKey: 'audioRoom.topic.Beginners' },
    { value: 'Cultural Exchange', labelKey: 'audioRoom.topic.CulturalExchange' },
    { value: 'Grammar Help', labelKey: 'audioRoom.topic.GrammarHelp' },
    { value: 'Free Talk', labelKey: 'audioRoom.topic.FreeTalk' },
    { value: 'Business English', labelKey: 'audioRoom.topic.BusinessEnglish' },
  ];

  readonly languagePairOptions = signal<readonly SelectOption[]>(this.LANGUAGE_PAIR_OPTIONS);
  readonly topicOptions = signal<readonly SelectOption[]>(this.TOPIC_OPTIONS);

  title = signal<string>('');
  languagePair = signal<string>('en-es');
  topicTag = signal<string>('Free Talk');
  isVideoStream = signal<boolean>(false);
  selectedFriendIds = signal<string[]>([]);
  friendSearchQuery = signal<string>('');
  friends = signal<FriendProfile[]>([]);
  isLoadingFriends = signal<boolean>(false);

  readonly isValid = computed(
    () =>
      this.title().trim().length > 0 &&
      this.languagePair().length > 0 &&
      this.topicTag().length > 0 &&
      this.selectedFriendIds().length > 0,
  );

  readonly filteredFriends = computed(() => {
    const query = this.friendSearchQuery().toLowerCase().trim();
    if (!query) return this.friends();
    return this.friends().filter((f) => (f.display_name ?? '').toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.loadFriends();
  }

  private async loadFriends(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) return;
    this.isLoadingFriends.set(true);
    try {
      const result = await this.userService.getFollowing(currentUser.id, 50, 0);
      this.friends.set(result.data);
    } catch {
      this.friends.set([]);
    } finally {
      this.isLoadingFriends.set(false);
    }
  }

  getFriendById(friendId: string): FriendProfile | undefined {
    return this.friends().find((f) => f.id === friendId);
  }

  toggleFriend(friendId: string): void {
    this.selectedFriendIds.update((ids) =>
      ids.includes(friendId) ? ids.filter((id) => id !== friendId) : [...ids, friendId],
    );
  }

  closeModal(): void {
    this.closed.emit();
    this.resetForm();
  }

  submit(): void {
    if (!this.isValid()) return;

    this.created.emit({
      title: this.title().trim(),
      languagePair: this.languagePair(),
      topicTag: this.topicTag(),
      isVideoStream: this.isVideoStream(),
      invitedUserIds: this.selectedFriendIds(),
    });

    this.closeModal();
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
    this.isVideoStream.set(false);
    this.selectedFriendIds.set([]);
    this.friendSearchQuery.set('');
  }
}
