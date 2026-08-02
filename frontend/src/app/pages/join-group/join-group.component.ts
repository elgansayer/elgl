import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { GroupsService } from '../../services/groups.service';

@Component({
  selector: 'app-join-group',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './join-group.component.html',
})
export class JoinGroupComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupsService = inject(GroupsService);

  private readonly codeFromPath = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('code') ?? '')),
  );

  private readonly codeFromQuery = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('code') ?? '')),
  );

  readonly code = computed(() => this.codeFromPath() || this.codeFromQuery());

  readonly roomInfo = resource({
    params: () => this.code() || undefined,
    loader: ({ params }) => this.groupsService.getInviteInfo(params),
  });

  readonly joinPending = signal(false);
  readonly joinFailed = signal(false);

  async join(roomId: string): Promise<void> {
    if (this.joinPending()) return;
    const code = this.code();
    if (!code) return;
    this.joinPending.set(true);
    this.joinFailed.set(false);
    try {
      await this.groupsService.joinGroupByCode(code);
      await this.router.navigate(['/chat', roomId]);
    } catch {
      this.joinFailed.set(true);
    } finally {
      this.joinPending.set(false);
    }
  }
}
