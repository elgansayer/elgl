import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  GroupsService,
  type ChatAnnouncement,
  type GroupInfo,
  type GroupMember,
  type GroupSettings,
} from '../../services/groups.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface GroupProfileData {
  info: GroupInfo;
  members: GroupMember[];
  announcements: ChatAnnouncement[];
  settings: GroupSettings;
}

@Component({
  selector: 'app-group-profile',
  imports: [HlmButton, HlmTextarea, RouterLink, TranslatePipe],
  template: `
    <main class="mx-auto w-full max-w-3xl p-4" aria-labelledby="group-profile-title">
      <a
        [routerLink]="['/chat/groups']"
        class="mb-4 inline-flex min-h-11 items-center rounded-app text-sm font-semibold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {{ 'groupProfile.backToGroups' | t }}
      </a>

      @if (profile.isLoading()) {
        <p role="status" class="py-8 text-center text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (profile.error()) {
        <div role="alert" class="flex flex-col items-start gap-3 rounded-card bg-surface-300 p-4">
          <p class="text-danger-ink">{{ 'groupProfile.error' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="profile.reload()">
            {{ 'groupProfile.retry' | t }}
          </button>
        </div>
      } @else if (data(); as group) {
        <header class="rounded-card bg-surface-300 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 id="group-profile-title" class="text-2xl font-bold text-text-primary">
                {{ group.info.name }}
              </h1>
              <p class="mt-1 text-sm text-text-secondary">
                {{ 'groupProfile.memberCount' | t: { count: group.members.length, max: group.info.max_members } }}
              </p>
              @if (group.info.interest?.name) {
                <p class="mt-1 text-sm text-text-secondary">{{ group.info.interest?.name }}</p>
              }
            </div>

            <div class="flex flex-wrap gap-2">
              @if (!isMember()) {
                @if (group.members.length < group.info.max_members) {
                  <button
                    hlmBtn
                    type="button"
                    size="touch"
                    [disabled]="actionBusy()"
                    (click)="joinGroup()"
                  >
                    {{ 'groupProfile.join' | t }}
                  </button>
                } @else {
                  <span class="inline-flex min-h-11 items-center text-sm text-text-muted">
                    {{ 'groupProfile.full' | t }}
                  </span>
                }
              } @else {
                <span class="inline-flex min-h-11 items-center rounded-pill bg-surface-100 px-3 text-sm font-semibold text-text-secondary">
                  {{ 'groupProfile.joined' | t }}
                </span>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  [disabled]="actionBusy() || group.members.length < 2"
                  (click)="openGroupChat()"
                >
                  {{ openingChat() ? ('groupProfile.openingChat' | t) : ('groupProfile.openChat' | t) }}
                </button>
              }
            </div>
          </div>

          @if (!isMember() || group.members.length < 2) {
            <p class="mt-3 text-sm text-text-secondary">{{ 'groupProfile.chatUnavailable' | t }}</p>
          }

          @if (actionError()) {
            <p role="alert" class="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink">
              {{ actionError() | t }}
            </p>
          }
          @if (actionMessage()) {
            <p role="status" class="mt-3 rounded-lg bg-surface-100 px-3 py-2 text-sm text-text-primary">
              {{ actionMessage() | t }}
            </p>
          }
        </header>

        @if (group.settings.description || group.settings.rules) {
          <section class="mt-4 rounded-card bg-surface-300 p-5" [attr.aria-label]="'groupProfile.about' | t">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'groupProfile.about' | t }}</h2>
            @if (group.settings.description) {
              <p class="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{{ group.settings.description }}</p>
            }
            @if (group.settings.rules) {
              <h3 class="mt-4 text-sm font-semibold text-text-primary">{{ 'groupProfile.rules' | t }}</h3>
              <p class="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{{ group.settings.rules }}</p>
            }
          </section>
        }

        <section class="mt-4 rounded-card bg-surface-300 p-5" [attr.aria-label]="'groupProfile.members' | t">
          <h2 class="text-lg font-semibold text-text-primary">
            {{ 'groupProfile.members' | t }} ({{ group.members.length }})
          </h2>

          <ul class="mt-3 space-y-2">
            @for (member of group.members; track member.user_id) {
              <li class="flex flex-wrap items-center gap-3 rounded-lg bg-surface-400 p-3">
                <div class="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-100">
                  @if (member.user?.avatar_url) {
                    <img
                      [src]="member.user?.avatar_url"
                      [alt]="member.user?.display_name || ('common.unknownUser' | t)"
                      class="h-full w-full object-cover"
                    />
                  } @else {
                    <span class="flex h-full w-full items-center justify-center font-bold text-text-secondary" aria-hidden="true">
                      {{ memberInitial(member) }}
                    </span>
                  }
                </div>

                <div class="min-w-0 grow">
                  <p class="truncate text-sm font-semibold text-text-primary">
                    {{ member.user?.display_name || ('common.unknownUser' | t) }}
                  </p>
                  @if (member.user_id === group.info.owner_id) {
                    <p class="text-xs text-text-muted">{{ 'groupProfile.owner' | t }}</p>
                  }
                </div>

                @if (isAdmin() && member.user_id !== group.info.owner_id) {
                  @if (pendingRemovalId() === member.user_id) {
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm text-text-secondary">
                        {{ 'groupProfile.confirmRemove' | t: { name: member.user?.display_name || ('common.unknownUser' | t) } }}
                      </span>
                      <button
                        hlmBtn
                        type="button"
                        variant="secondary"
                        size="touch"
                        [disabled]="actionBusy()"
                        (click)="confirmRemoval(member.user_id)"
                      >
                        {{ 'groupProfile.confirm' | t }}
                      </button>
                      <button
                        hlmBtn
                        type="button"
                        variant="ghost"
                        size="touch"
                        [disabled]="actionBusy()"
                        (click)="cancelRemoval()"
                      >
                        {{ 'common.cancel' | t }}
                      </button>
                    </div>
                  } @else {
                    <button
                      hlmBtn
                      type="button"
                      variant="ghost"
                      size="touch"
                      [disabled]="actionBusy()"
                      (click)="requestRemoval(member.user_id)"
                    >
                      {{ 'groupProfile.removeMember' | t }}
                    </button>
                  }
                }
              </li>
            } @empty {
              <li class="text-sm text-text-secondary">{{ 'groupProfile.noMembers' | t }}</li>
            }
          </ul>
        </section>

        <section class="mt-4 rounded-card bg-surface-300 p-5" [attr.aria-label]="'groupProfile.announcements' | t">
          <h2 class="text-lg font-semibold text-text-primary">{{ 'groupProfile.announcements' | t }}</h2>

          @if (isAdmin()) {
            <div class="mt-3 rounded-lg border border-surface-100 p-3">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'groupProfile.admin' | t }}</h3>
              <label class="mt-2 block text-sm font-medium text-text-primary" for="groupAnnouncementInput">
                {{ 'groupProfile.announcements' | t }}
              </label>
              <p id="groupAnnouncementHint" class="mt-1 text-xs text-text-secondary">
                {{ 'groupProfile.announcementHint' | t }}
              </p>
              <textarea
                hlmTextarea
                id="groupAnnouncementInput"
                rows="3"
                maxlength="2000"
                class="mt-1 w-full"
                aria-describedby="groupAnnouncementHint"
                [value]="announcementDraft()"
                (input)="onAnnouncementInput($event)"
              ></textarea>
              <button
                hlmBtn
                type="button"
                size="touch"
                class="mt-2"
                [disabled]="actionBusy() || announcementDraft().trim().length === 0"
                (click)="postAnnouncement()"
              >
                {{ 'groupProfile.postAnnouncement' | t }}
              </button>
            </div>
          }

          @if (group.announcements.length === 0) {
            <p class="mt-3 text-sm text-text-secondary">{{ 'groupProfile.noAnnouncements' | t }}</p>
          } @else {
            <ul class="mt-3 space-y-2">
              @for (announcement of group.announcements; track announcement.id) {
                <li class="rounded-lg bg-surface-400 p-3">
                  <p class="whitespace-pre-wrap text-sm text-text-primary">{{ announcement.message }}</p>
                  <p class="mt-1 text-xs text-text-muted">{{ announcement.createdAt }}</p>
                </li>
              }
            </ul>
          }
        </section>
      }
    </main>
  `,
})
export class GroupProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupsService = inject(GroupsService);
  private readonly authService = inject(AuthService);

  private readonly groupId = this.route.snapshot.paramMap.get('groupId') ?? '';

  readonly actionBusy = signal(false);
  readonly openingChat = signal(false);
  readonly actionError = signal('');
  readonly actionMessage = signal('');
  readonly announcementDraft = signal('');
  readonly pendingRemovalId = signal<string | null>(null);

  readonly profile = resource({
    loader: async (): Promise<GroupProfileData> => {
      try {
        const [info, members, announcements, settings] = await Promise.all([
          this.groupsService.getGroupInfo(this.groupId),
          this.groupsService.getGroupMembers(this.groupId),
          this.groupsService.getAnnouncements(this.groupId),
          this.groupsService.getGroupSettings(this.groupId),
        ]);
        return { info, members, announcements, settings };
      } catch {
        throw new Error('group_profile_unavailable');
      }
    },
  });

  readonly data = computed(() => this.profile.value() ?? null);
  readonly isMember = computed(() => {
    const userId = this.authService.currentUser()?.id;
    const members = this.data()?.members ?? [];
    return Boolean(userId) && members.some((member) => member.user_id === userId);
  });
  readonly isAdmin = computed(() => {
    const userId = this.authService.currentUser()?.id;
    return Boolean(userId) && this.data()?.info.owner_id === userId;
  });

  memberInitial(member: GroupMember): string {
    const name = member.user?.display_name?.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  async joinGroup(): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await this.groupsService.joinGroup(this.groupId);
      this.profile.reload();
    } catch {
      this.actionError.set('groupProfile.error');
    } finally {
      this.actionBusy.set(false);
    }
  }

  async openGroupChat(): Promise<void> {
    if (this.actionBusy() || this.openingChat()) return;
    this.openingChat.set(true);
    this.actionError.set('');
    try {
      const { roomId } = await this.groupsService.openGroupChat(this.groupId);
      await this.router.navigate(['/chat', roomId]);
    } catch {
      this.actionError.set('groupProfile.chatUnavailable');
    } finally {
      this.openingChat.set(false);
    }
  }

  onAnnouncementInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.announcementDraft.set(target.value);
    }
  }

  async postAnnouncement(): Promise<void> {
    const message = this.announcementDraft().trim();
    if (this.actionBusy() || message.length === 0) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    this.actionMessage.set('');
    try {
      await this.groupsService.sendAnnouncement(this.groupId, message);
      this.announcementDraft.set('');
      this.actionMessage.set('groupProfile.announcementPosted');
      this.profile.reload();
    } catch {
      this.actionError.set('groupProfile.error');
    } finally {
      this.actionBusy.set(false);
    }
  }

  requestRemoval(userId: string): void {
    this.pendingRemovalId.set(userId);
    this.actionError.set('');
  }

  cancelRemoval(): void {
    this.pendingRemovalId.set(null);
  }

  async confirmRemoval(userId: string): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    this.actionMessage.set('');
    try {
      await this.groupsService.removeMember(this.groupId, userId);
      this.pendingRemovalId.set(null);
      this.actionMessage.set('groupProfile.memberRemoved');
      this.profile.reload();
    } catch {
      this.actionError.set('groupProfile.error');
    } finally {
      this.actionBusy.set(false);
    }
  }
}
