import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-business-profile',
  imports: [HlmTextarea, HlmInput, HlmButton, TranslatePipe],
  template: `
    <section class="mx-auto max-w-2xl px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">{{ 'profile.businessTitle' | t }}</h1>
      <p class="text-text-secondary mb-6">{{ 'businessProfile.subtitle' | t }}</p>

      <div class="rounded-2xl bg-surface-200 p-6">
        <label class="mb-1 block text-sm font-medium" for="businessName">{{
          'profile.businessName' | t
        }}</label>
        <input
          hlmInput
          id="businessName"
          class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
          [value]="businessName()"
          (input)="onBusinessNameInput($event)"
          [placeholder]="'profile.businessNamePlaceholder' | t"
        />

        <label class="mb-1 mt-4 block text-sm font-medium" for="businessHours">{{
          'profile.businessHours' | t
        }}</label>
        <input
          hlmInput
          id="businessHours"
          class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
          [value]="businessHours()"
          (input)="onBusinessHoursInput($event)"
          [placeholder]="'profile.businessHoursPlaceholder' | t"
        />

        <label class="mb-1 mt-4 block text-sm font-medium" for="website">{{
          'profile.website' | t
        }}</label>
        <input
          hlmInput
          id="website"
          type="url"
          class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
          [value]="website()"
          (input)="onWebsiteInput($event)"
          [placeholder]="'profile.websitePlaceholder' | t"
        />
      </div>

      <h2 class="mt-8 mb-2 text-xl font-bold">{{ 'profile.catalogTitle' | t }}</h2>

      @for (item of catalogItems(); track item.id) {
        <div class="mb-4 rounded-xl bg-surface-200 p-4">
          <label for="catalog-name-{{ item.id }}" class="mb-1 block text-sm font-medium">{{
            'profile.catalogNamePlaceholder' | t
          }}</label>
          <input
            hlmInput
            id="catalog-name-{{ item.id }}"
            class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
            [value]="item.name"
            (input)="onCatalogNameInput($event, item.id)"
            [placeholder]="'profile.catalogNamePlaceholder' | t"
          />

          <label for="catalog-desc-{{ item.id }}" class="mb-1 mt-3 block text-sm font-medium">{{
            'profile.catalogDescPlaceholder' | t
          }}</label>
          <textarea
            hlmTextarea
            id="catalog-desc-{{ item.id }}"
            class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
            [value]="item.description"
            (input)="onCatalogDescriptionInput($event, item.id)"
            [placeholder]="'profile.catalogDescPlaceholder' | t"
            rows="2"
          ></textarea>

          <label for="catalog-price-{{ item.id }}" class="mb-1 mt-3 block text-sm font-medium">{{
            'profile.catalogPricePlaceholder' | t
          }}</label>
          <input
            hlmInput
            id="catalog-price-{{ item.id }}"
            class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
            [value]="item.price"
            (input)="onCatalogPriceInput($event, item.id)"
            [placeholder]="'profile.catalogPricePlaceholder' | t"
          />

          <label for="catalog-image-{{ item.id }}" class="mb-1 mt-3 block text-sm font-medium">{{
            'profile.catalogImagePlaceholder' | t
          }}</label>
          <input
            hlmInput
            id="catalog-image-{{ item.id }}"
            class="w-full rounded-lg border border-surface-100 bg-surface-100 px-3 py-2 text-text-primary"
            [value]="item.imageUrl ?? ''"
            (input)="onCatalogImageInput($event, item.id)"
            [placeholder]="'profile.catalogImagePlaceholder' | t"
          />

          <button
            hlmBtn
            type="button"
            class="mt-3 rounded-lg bg-danger px-3 py-1 text-on-fill hover:bg-danger/90"
            (click)="removeItem(item.id)"
          >
            {{ 'profile.removeCatalogItem' | t }}
          </button>
        </div>
      } @empty {
        <p class="text-text-muted">{{ 'profile.noCatalogItems' | t }}</p>
      }

      <button
        hlmBtn
        type="button"
        class="mt-2 rounded-lg bg-primary px-4 py-2 font-medium text-on-fill hover:bg-primary-dark"
        (click)="addItem()"
      >
        {{ 'profile.addCatalogItem' | t }}
      </button>

      <div class="mt-8 flex items-center gap-3">
        <button
          hlmBtn
          type="button"
          class="rounded-lg bg-success px-4 py-2 font-medium text-on-fill hover:bg-success/90"
          (click)="save()"
        >
          {{ 'businessProfile.saveButton' | t }}
        </button>
        @if (saved()) {
          <p class="text-success">{{ 'businessProfile.saveSuccess' | t }}</p>
        }
      </div>
    </section>
  `,
})
export class BusinessProfileComponent {
  readonly businessName = signal('');
  readonly businessHours = signal('');
  readonly website = signal('');
  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly saved = signal(false);

  private nextId = 0;

  addItem(): void {
    const id = `cat-${++this.nextId}`;
    this.catalogItems.update((items) => [
      ...items,
      { id, name: '', description: '', price: '', imageUrl: '' },
    ]);
  }

  removeItem(id: string): void {
    this.catalogItems.update((items) => items.filter((item) => item.id !== id));
  }

  private updateCatalogItem(
    id: string,
    field: 'name' | 'description' | 'price' | 'imageUrl',
    value: string,
  ): void {
    this.catalogItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  onBusinessNameInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.businessName.set(target.value);
    }
  }

  onBusinessHoursInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.businessHours.set(target.value);
    }
  }

  onWebsiteInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.website.set(target.value);
    }
  }

  onCatalogNameInput(event: Event, id: string): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.updateCatalogItem(id, 'name', target.value);
    }
  }

  onCatalogDescriptionInput(event: Event, id: string): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.updateCatalogItem(id, 'description', target.value);
    }
  }

  onCatalogPriceInput(event: Event, id: string): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.updateCatalogItem(id, 'price', target.value);
    }
  }

  onCatalogImageInput(event: Event, id: string): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.updateCatalogItem(id, 'imageUrl', target.value);
    }
  }

  save(): void {
    this.saved.set(true);
  }
}
