import { Component, input, output, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '../../services/translate.pipe';

interface LikedUser {
  id: string;
  avatar_url?: string;
  display_name: string;
  native_language: string;
  target_languages?: string[];
}

@Component({
  selector: 'app-liked-by-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" (click)="closeModal.emit()" (keydown.enter)="closeModal.emit()" tabindex="0">
      <div class="bg-[#121212] border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-slate-100">{{ 'moments.likedBy' | t }}</h2>
          <button class="text-slate-400 hover:text-white transition-colors" (click)="closeModal.emit()">✕</button>
        </div>
        
        @if (isLoading()) {
          <div class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        } @else {
          <div class="max-h-96 overflow-y-auto pe-2">
            @for (user of users(); track user.id) {
              <div class="flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer mb-1">
                <img [src]="user.avatar_url || 'assets/default-avatar.png'" class="w-12 h-12 rounded-full object-cover border border-slate-700" alt="Avatar">
                <div>
                  <div class="font-bold text-slate-200">{{ user.display_name }}</div>
                  <div class="text-xs font-medium text-slate-400 mt-0.5">
                    {{ user.native_language | uppercase }} ➔ {{ user.target_languages?.[0] | uppercase }}
                  </div>
                </div>
              </div>
            }
            @if (users().length === 0) {
              <div class="text-center text-slate-500 py-6 font-medium">{{ 'moments.noLikesYet' | t }}</div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class LikedByModalComponent implements OnInit {
  momentId = input.required<string>();
  closeModal = output<void>();
  
  private http = inject(HttpClient);
  
  users = signal<LikedUser[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.http.get<LikedUser[]>(`/api/moments/${this.momentId()}/likes`)
      .subscribe({
        next: (data) => {
          this.users.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load likes', err);
          this.isLoading.set(false);
        }
      });
  }
}
