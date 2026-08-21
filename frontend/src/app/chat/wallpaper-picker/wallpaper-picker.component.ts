import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatService } from '../../services/chat.service';

interface WallpaperOption {
  id: string;
  labelKey: string;
  imageUrl: string;
}

@Component({
  selector: 'app-wallpaper-picker',
  imports: [HlmInput, HlmButton, TranslatePipe],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
        tabindex="0"
        (keydown.enter)="$event.preventDefault(); close()"
        (click)="close()"
      >
        <div
          class="fixed bottom-0 start-0 end-0 bg-surface-200 rounded-t-sheet p-4 shadow-lift max-h-80 overflow-y-auto"
          tabindex="0"
          (keydown.enter)="$event.preventDefault(); $event.stopPropagation()"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between mb-4 ps-1 pe-1">
            <span class="text-lg font-semibold text-text-primary">{{
              'chat.wallpaper.title' | t
            }}</span>
            <button
              hlmBtn
              type="button"
              class="p-2 rounded-app text-text-muted hover:text-text-primary focus:outline-none"
              (click)="close()"
              [attr.aria-label]="'common.close' | t"
            >
              ✕
            </button>
          </div>

          <div class="grid grid-cols-3 gap-3">
            @for (option of wallpaperOptions(); track option.id) {
              <button
                hlmBtn
                type="button"
                (click)="select(option)"
                class="focus:outline-none rounded-card overflow-hidden border-2 border-surface-100 hover:border-surface-300 transition-colors"
                [attr.aria-label]="option.labelKey | t"
              >
                <span
                  class="block h-20 w-full bg-cover bg-center"
                  [style.background-image]="'url(' + option.imageUrl + ')'"
                ></span>
              </button>
            }
          </div>

          <div class="mt-5">
            <label for="wallpaper-custom-url" class="block text-sm text-text-secondary mb-2 ps-1">
              {{ 'chat.wallpaper.custom_url_label' | t }}
            </label>
            <div class="flex gap-2">
              <input
                hlmInput
                #customUrlInput
                id="wallpaper-custom-url"
                type="text"
                [value]="customUrl()"
                (input)="customUrl.set(customUrlInput.value)"
                placeholder="{{ 'chat.wallpaper.custom_url_placeholder' | t }}"
                class="flex-1 min-w-0 rounded-app border border-surface-100 bg-surface-300 px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                hlmBtn
                type="button"
                (click)="applyCustomUrl()"
                class="shrink-0 rounded-app bg-primary px-4 py-2 text-on-fill font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {{ 'chat.wallpaper.apply' | t }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class WallpaperPickerComponent {
  readonly roomId = input.required<string>();
  readonly wallpaperSelected = output<string>();
  readonly pickerClosed = output<void>();

  private readonly chatService = inject(ChatService);

  protected readonly isOpen = signal(false);
  protected readonly customUrl = signal('');
  protected readonly wallpaperOptions = signal<WallpaperOption[]>([
    {
      id: 'classic-dark',
      labelKey: 'chat.wallpaper.option.classic',
      imageUrl: 'https://picsum.photos/seed/hellotalk-dark/800/600',
    },
    {
      id: 'midnight',
      labelKey: 'chat.wallpaper.option.midnight',
      imageUrl: 'https://picsum.photos/seed/hellotalk-midnight/800/600',
    },
    {
      id: 'ocean',
      labelKey: 'chat.wallpaper.option.ocean',
      imageUrl: 'https://picsum.photos/seed/hellotalk-ocean/800/600',
    },
    {
      id: 'sunset',
      labelKey: 'chat.wallpaper.option.sunset',
      imageUrl: 'https://picsum.photos/seed/hellotalk-sunset/800/600',
    },
    {
      id: 'forest',
      labelKey: 'chat.wallpaper.option.forest',
      imageUrl: 'https://picsum.photos/seed/hellotalk-forest/800/600',
    },
    {
      id: 'aurora',
      labelKey: 'chat.wallpaper.option.aurora',
      imageUrl: 'https://picsum.photos/seed/hellotalk-aurora/800/600',
    },
    {
      id: 'neon-cities',
      labelKey: 'chat.wallpaper.option.neon',
      imageUrl: 'https://picsum.photos/seed/hellotalk-neon/800/600',
    },
    {
      id: 'paper',
      labelKey: 'chat.wallpaper.option.paper',
      imageUrl: 'https://picsum.photos/seed/hellotalk-paper/800/600',
    },
    {
      id: 'minimal',
      labelKey: 'chat.wallpaper.option.minimal',
      imageUrl: 'https://picsum.photos/seed/hellotalk-minimal/800/600',
    },
  ]);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.pickerClosed.emit();
  }

  async select(option: WallpaperOption): Promise<void> {
    await this.chatService.setChatWallpaper(this.roomId(), option.imageUrl);
    this.wallpaperSelected.emit(option.imageUrl);
    this.close();
  }

  async applyCustomUrl(): Promise<void> {
    const url = this.customUrl().trim();
    if (!url) return;
    await this.chatService.setChatWallpaper(this.roomId(), url);
    this.wallpaperSelected.emit(url);
    this.close();
  }
}
