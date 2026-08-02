import { Component, inject, signal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  CommunitiesService,
  CommunityGroup,
  CreateCommunityPayload,
} from '../../services/communities.service';

@Component({
  selector: 'app-communities',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './communities.component.html',
})
export class CommunitiesComponent {
  private readonly communitiesService = inject(CommunitiesService);

  readonly communityName = signal('');
  readonly communityDescription = signal('');

  readonly communitiesResource = resource({
    loader: () => this.communitiesService.listMine(),
  });
  readonly communities = this.communitiesResource.value;

  readonly selectedCommunityId = signal<string | null>(null);

  readonly groupsResource = resource({
    loader: () => {
      const id = this.selectedCommunityId();
      if (!id) {
        return Promise.resolve<CommunityGroup[]>([]);
      }
      return this.communitiesService.getGroups(id);
    },
  });
  readonly groups = this.groupsResource.value;

  async createCommunity(): Promise<void> {
    const name = this.communityName().trim();
    if (!name) {
      return;
    }
    const payload: CreateCommunityPayload = {
      name,
      description: this.communityDescription().trim() || undefined,
    };
    await this.communitiesService.create(payload);
    this.communityName.set('');
    this.communityDescription.set('');
    this.communitiesResource.reload();
  }

  selectCommunity(id: string): void {
    this.selectedCommunityId.set(id);
  }
}
