import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-voiceroom-creation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppButtonSecondaryComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 m-4">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Create Voice Room</h2>
          <button (click)="closed.emit()" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label for="voiceroomNameInput" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room Name</label>
            <input
              id="voiceroomNameInput"
              type="text"
              [ngModel]="roomName()"
              (ngModelChange)="roomName.set($event)"
              name="roomName"
              required
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. English Practice"
            >
          </div>

          <div>
            <label for="voiceroomLanguagePairInput" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language Pair</label>
            <input
              id="voiceroomLanguagePairInput"
              type="text"
              [ngModel]="languagePair()"
              (ngModelChange)="languagePair.set($event)"
              name="languagePair"
              required
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. en-es"
            >
          </div>

          <div>
            <label for="voiceroomTopicSelect" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Topic</label>
            <select
              id="voiceroomTopicSelect"
              [ngModel]="topicTag()"
              (ngModelChange)="topicTag.set($event)"
              name="topicTag"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Pronunciation">Pronunciation</option>
              <option value="Beginners">Beginners</option>
              <option value="Cultural Exchange">Cultural Exchange</option>
              <option value="General Chat">General Chat</option>
            </select>
          </div>

          <div class="pt-4 flex justify-end gap-3">
            <app-button-secondary (clicked)="closed.emit()">
              Cancel
            </app-button-secondary>
            <button 
              type="submit"
              [disabled]="!roomName() || !languagePair()"
              class="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Room
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class VoiceroomCreationModalComponent {
  readonly closed = output<void>();
  readonly create = output<{ roomName: string; languagePair: string; topicTag: string }>();

  roomName = signal('');
  languagePair = signal('');
  topicTag = signal('General Chat');

  onSubmit() {
    if (this.roomName() && this.languagePair()) {
      this.create.emit({
        roomName: this.roomName(),
        languagePair: this.languagePair(),
        topicTag: this.topicTag()
      });
    }
  }
}
