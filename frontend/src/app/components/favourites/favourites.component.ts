import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatService, FavouriteRecord } from '../../services/chat.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';

@Component({
  selector: 'app-favourites',
  imports: [CommonModule, VisualDiffComponent, TranslatePipe],
  templateUrl: './favourites.component.html',
  styleUrls: ['./favourites.component.scss']
})
export class FavouritesComponent implements OnInit {
  private chatService = inject(ChatService);

  readonly favourites = signal<FavouriteRecord[]>([]);
  readonly isLoading = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    await this.loadFavourites();
  }

  async loadFavourites(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.chatService.getFavourites();
      this.favourites.set(data);
    } catch (e) {
      console.error('Failed to load favourites:', e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
