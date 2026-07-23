import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { HobbyTag } from '../../services/hobby-tags.service';

@Component({
  selector: 'app-hobby-tag-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <h3 class="text-lg font-bold text-slate-200">Select your hobbies & interests</h3>
      <p class="text-sm text-text-muted">Choose tags to get personalised vocabulary recommendations</p>

      @for (category of categories(); track category) {
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">{{ category }}</h4>
          <div class="flex flex-wrap gap-2">
            @for (tag of tagsByCategory().get(category); track tag.id) {
              <button
                (click)="toggleTag(tag)"
                [class]="getTagButtonClass(tag.id)"
                [disabled]="loading()"
              >
                <span class="text-base">{{ tag.icon }}</span>
                <span>{{ tag.name }}</span>
                @if (isSelected(tag.id)) {
                  <svg class="w-4 h-4 ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
              </button>
            }
          </div>
        </div>
      }

      @if (selectedTags().length > 0) {
        <div class="mt-6 p-4 bg-surface-800/50 rounded-xl border border-slate-700">
          <h4 class="text-sm font-semibold text-slate-300 mb-3">Your selected interests</h4>
          <div class="flex flex-wrap gap-2">
            @for (tag of selectedTags(); track tag.id) {
              <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-sm border border-indigo-500/30">
                <span>{{ tag.icon }}</span>
                <span>{{ tag.name }}</span>
                <button (click)="removeTag(tag.id)" class="ms-1 hover:text-indigo-100">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class HobbyTagSelectorComponent {
  private readonly store = inject(HobbyTagsStore);

  readonly loading = computed(() => this.store.loading());
  readonly tagsByCategory = computed(() => this.store.tagsByCategory());
  readonly categories = computed(() => Array.from(this.tagsByCategory().keys()));
  readonly selectedTags = computed(() =>
    this.store.allTags().filter(t => this.store.userTagIds().has(t.id))
  );

  constructor() {
    this.store.loadUserTags();
  }

  toggleTag(tag: HobbyTag): void {
    if (this.isSelected(tag.id)) {
      this.store.removeTag(tag.id);
    } else {
      this.store.addTag(tag.id);
    }
  }

  removeTag(tagId: string): void {
    this.store.removeTag(tagId);
  }

  isSelected(tagId: string): boolean {
    return this.store.userTagIds().has(tagId);
  }

  getTagButtonClass(tagId: string): string {
    const base = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border';
    if (this.isSelected(tagId)) {
      return `${base} bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm`;
    }
    return `${base} bg-surface-800/50 text-slate-300 border-slate-700/50 hover:bg-surface-200/50 hover:border-slate-600`;
  }
}
