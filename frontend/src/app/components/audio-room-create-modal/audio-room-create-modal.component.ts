import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

export interface CreateAudioRoomPayload {
  title: string;
  language_pair: string;
  topic_tag: string;
}

@Component({
  selector: 'app-audio-room-create-modal',
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div class="w-full max-w-md bg-[#121212] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 class="text-xl font-bold text-slate-100">{{ 'audioRoom.modalTitle' | t }}</h2>
            <button 
              (click)="closeModal()"
              class="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-800"
              aria-label="Close">
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 flex flex-col gap-5">
            <p class="text-sm text-slate-400 mb-2">{{ 'audioRoom.modalSubtitle' | t }}</p>

            <!-- Title Input -->
            <div class="flex flex-col gap-2">
              <label for="roomTitle" class="text-sm font-medium text-slate-300">
                {{ 'audioRoom.roomTitleLabel' | t }}
              </label>
              <input 
                id="roomTitle"
                type="text" 
                [(ngModel)]="title"
                [placeholder]="'audioRoom.roomTitlePlaceholder' | t"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                maxlength="100"
              />
            </div>

            <!-- Language Pair Select -->
            <div class="flex flex-col gap-2">
              <label for="langPair" class="text-sm font-medium text-slate-300">
                {{ 'audioRoom.languagePairLabel' | t }}
              </label>
              <select 
                id="langPair"
                [(ngModel)]="languagePair"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none">
                <option value="en-es">English ↔ Spanish</option>
                <option value="en-fr">English ↔ French</option>
                <option value="en-ja">English ↔ Japanese</option>
                <option value="ar-en">Arabic ↔ English</option>
              </select>
            </div>

            <!-- Topic Select -->
            <div class="flex flex-col gap-2">
              <label for="topicTag" class="text-sm font-medium text-slate-300">
                {{ 'audioRoom.topicLabel' | t }}
              </label>
              <select 
                id="topicTag"
                [(ngModel)]="topicTag"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none">
                <option value="Pronunciation">{{ 'audioRoom.topic.Pronunciation' | t }}</option>
                <option value="Beginners">{{ 'audioRoom.topic.Beginners' | t }}</option>
                <option value="Cultural Exchange">{{ 'audioRoom.topic.CulturalExchange' | t }}</option>
                <option value="Grammar Help">{{ 'audioRoom.topic.GrammarHelp' | t }}</option>
                <option value="Free Talk">{{ 'audioRoom.topic.FreeTalk' | t }}</option>
                <option value="Business English">{{ 'audioRoom.topic.BusinessEnglish' | t }}</option>
              </select>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
            <button 
              (click)="closeModal()"
              class="px-5 py-2.5 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors">
              {{ 'audioRoom.cancelBtn' | t }}
            </button>
            <button 
              (click)="submit()"
              [disabled]="!isValid()"
              class="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20">
              {{ 'audioRoom.launchStageBtn' | t }}
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class AudioRoomCreateModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly closed = output<void>();
  readonly created = output<CreateAudioRoomPayload>();

  title = signal<string>('');
  languagePair = signal<string>('en-es');
  topicTag = signal<string>('Free Talk');

  isValid(): boolean {
    return this.title().trim().length > 0 && this.languagePair().length > 0 && this.topicTag().length > 0;
  }

  closeModal(): void {
    this.closed.emit();
    this.resetForm();
  }

  submit(): void {
    if (!this.isValid()) return;
    
    this.created.emit({
      title: this.title().trim(),
      language_pair: this.languagePair(),
      topic_tag: this.topicTag()
    });
    
    this.closeModal();
  }

  private resetForm(): void {
    this.title.set('');
    this.languagePair.set('en-es');
    this.topicTag.set('Free Talk');
  }
}
