import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-audio-equalizer',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex items-end justify-center gap-0.5 h-4" [class.opacity-30]="!isActive()">
      @for (bar of bars; track $index) {
        <div
          class="w-1 bg-green-500 rounded-full transition-all duration-150"
          [ngClass]="isActive() ? bar.activeClass : 'h-1'"
        ></div>
      }
    </div>
  `,
  styles: [`
    @keyframes eq-bounce-1 { 0%, 100% { height: 4px; } 50% { height: 12px; } }
    @keyframes eq-bounce-2 { 0%, 100% { height: 6px; } 50% { height: 16px; } }
    @keyframes eq-bounce-3 { 0%, 100% { height: 3px; } 50% { height: 10px; } }
    
    .animate-eq-1 { animation: eq-bounce-1 0.8s ease-in-out infinite; }
    .animate-eq-2 { animation: eq-bounce-2 0.6s ease-in-out infinite 0.1s; }
    .animate-eq-3 { animation: eq-bounce-3 0.9s ease-in-out infinite 0.2s; }
    .animate-eq-4 { animation: eq-bounce-1 0.7s ease-in-out infinite 0.3s; }
  `]
})
export class AudioEqualizerComponent {
  /** Indicates if the speaker is currently talking */
  isActive = input<boolean>(false);
  
  readonly bars = [
    { activeClass: 'animate-eq-1' },
    { activeClass: 'animate-eq-2' },
    { activeClass: 'animate-eq-3' },
    { activeClass: 'animate-eq-4' }
  ];
}
