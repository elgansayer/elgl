import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

interface LanguageParty {
  id: string;
  title: string;
  target_language: string;
  language_pair: string;
  topic_tag?: string;
  host: { id: string; display_name: string; avatar_url: string | null };
  speakers: string[];
  listeners_count: number;
}

@Component({
  imports: [AsyncPipe, RouterLink, TranslatePipe],
  template: `
    <div class="min-h-screen bg-[#121212] text-white p-4">
      <h1 class="text-2xl font-bold mb-4">{{ 'language_parties' | t }}</h1>

      @if (parties$ | async; as parties) {
        @for (party of parties; track party.id) {
          <div class="bg-surface p-3 rounded-lg mb-2">
            <h2 class="text-lg">{{ party.title }}</h2>
            <p class="text-sm text-gray-300">
              {{ party.target_language }} / {{ party.language_pair }}
            </p>
            <p class="text-sm text-gray-400">
              {{ 'host_label' | t }}: {{ party.host.display_name }}
            </p>
            <p class="text-sm text-gray-400">
              {{ 'participants_count_label' | t }}:
              {{ (party.speakers?.length ?? 0) + (party.listeners_count ?? 0) }}
            </p>
            <button
              class="btn-primary mt-2"
              [routerLink]="['/audio-rooms', party.id]"
            >
              {{ 'join_button' | t }}
            </button>
          </div>
        } @empty {
          <p>{{ 'no_active_language_parties' | t }}</p>
        }
      } @else {
        <p>{{ 'loading' | t }}</p>
      }
    </div>
  `,
})
export class LanguagePartiesComponent {
  private http = inject(HttpClient);

  protected parties$: Observable<LanguageParty[]> = this.http.get<
    LanguageParty[]
  >(`${environment.apiUrl}/audio-rooms/list?type=language_party`);
}
