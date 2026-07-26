import { Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-room',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full w-full bg-slate-900 p-4">
      <!-- Room Header -->
      <div class="flex justify-between items-center mb-4 text-white">
        <h2 class="text-xl font-bold">{{ roomName() }}</h2>
        
        @if (isHost() && !hasCoHost()) {
          <button 
            (click)="onInviteCoHost()" 
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full font-semibold transition-colors">
            Invite Co-Host
          </button>
        }
      </div>

      <!-- Dynamic Video Grid -->
      <div class="flex-1 grid gap-4 transition-all duration-300" [ngClass]="gridClass()">
        
        <!-- Host Video Stream -->
        <div class="relative bg-black rounded-xl overflow-hidden border-2 border-slate-700 flex items-center justify-center shadow-lg">
          <!-- LiveKit Video Track would bind here -->
          <video #hostVideo autoplay playsinline muted class="w-full h-full object-cover"></video>
          <div class="absolute bottom-4 start-4 bg-black/60 px-3 py-1 rounded-lg text-white text-sm backdrop-blur-sm">
            Host
          </div>
        </div>

        <!-- Co-Host Video Stream (Split Screen) -->
        @if (hasCoHost()) {
          <div class="relative bg-black rounded-xl overflow-hidden border-2 border-blue-500 flex items-center justify-center shadow-lg animate-fade-in">
            <!-- LiveKit Video Track would bind here -->
            <video #coHostVideo autoplay playsinline class="w-full h-full object-cover"></video>
            <div class="absolute bottom-4 start-4 bg-black/60 px-3 py-1 rounded-lg text-white text-sm backdrop-blur-sm">
              Co-Host
            </div>
            
            @if (isHost()) {
              <button 
                (click)="onRemoveCoHost()"
                class="absolute top-4 end-4 bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                <!-- Close Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class VideoRoomComponent {
  roomName = input<string>('Language Exchange Room');
  isHost = input<boolean>(false);
  hasCoHost = input<boolean>(false);

  inviteCoHost = output<void>();
  removeCoHost = output<void>();

  // Dynamically switch between single view and split-screen
  gridClass = computed(() => {
    return this.hasCoHost() 
      ? 'grid-cols-1 md:grid-cols-2' 
      : 'grid-cols-1 max-w-4xl mx-auto w-full';
  });

  onInviteCoHost(): void {
    this.inviteCoHost.emit();
  }

  onRemoveCoHost(): void {
    this.removeCoHost.emit();
  }
}
