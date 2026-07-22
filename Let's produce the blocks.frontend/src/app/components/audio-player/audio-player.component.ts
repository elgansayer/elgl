import { Component, input, signal, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-audio-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <button (click)="togglePlay()" 
              class="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              [attr.aria-label]="isPlaying() ? 'Pause' : 'Play'">
        @if (isPlaying()) {
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        } @else {
          <svg class="w-5 h-5 ms-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>
      
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        <!-- Progress Bar (Mock Waveform) -->
        <input type="range" 
               [min]="0" 
               [max]="duration() || 100" 
               [ngModel]="currentTime()" 
               (ngModelChange)="seek($event)"
               class="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
        
        <!-- Timestamps -->
        <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
          <span>{{ formatTime(currentTime()) }}</span>
          <span>{{ formatTime(duration()) }}</span>
        </div>
      </div>
      
      <audio #audioElement 
             [src]="audioUrl()" 
             (timeupdate)="onTimeUpdate()" 
             (loadedmetadata)="onLoadedMetadata()" 
             (ended)="onEnded()"
             class="hidden"></audio>
    </div>
  `
})
export class AudioPlayerComponent implements OnDestroy {
  audioUrl = input.required<string>();
  
  @ViewChild('audioElement') audioRef!: ElementRef<HTMLAudioElement>;
  
  isPlaying = signal(false);
  currentTime = signal(0);
  duration = signal(0);

  togglePlay() {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    
    if (this.isPlaying()) {
      audio.pause();
      this.isPlaying.set(false);
    } else {
      audio.play();
      this.isPlaying.set(true);
    }
  }

  onTimeUpdate() {
    if (this.audioRef?.nativeElement) {
      this.currentTime.set(this.audioRef.nativeElement.currentTime);
    }
  }

  onLoadedMetadata() {
    if (this.audioRef?.nativeElement) {
      this.duration.set(this.audioRef.nativeElement.duration);
    }
  }

  onEnded() {
    this.isPlaying.set(false);
    this.currentTime.set(0);
  }

  seek(value: number) {
    if (this.audioRef?.nativeElement) {
      this.audioRef.nativeElement.currentTime = value;
      this.currentTime.set(value);
    }
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  ngOnDestroy() {
    if (this.audioRef?.nativeElement) {
      this.audioRef.nativeElement.pause();
    }
  }
}
