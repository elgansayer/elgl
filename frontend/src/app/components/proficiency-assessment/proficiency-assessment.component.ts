import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-proficiency-assessment',
  imports: [HlmButton, FormsModule, TranslatePipe],
  template: `
    <div class="ps-4 pe-4 pt-4 pb-4 bg-surface-200 text-text-primary rounded-lg">
      <h2 class="text-xl font-bold mb-4">{{ 'proficiency.title' | t }}</h2>
      <p class="mb-3">{{ 'proficiency.instruction' | t }}</p>

      <label class="block mb-2" for="scoreSlider">
        {{ 'proficiency.scoreLabel' | t }}: {{ scoreValue() }}
      </label>
      <input
        id="scoreSlider"
        type="range"
        min="0"
        max="100"
        [value]="scoreValue()"
        (input)="scoreValue.set(+$any($event.target).value)"
        class="w-full mb-4"
      />

      <button
        hlmBtn
        class="bg-primary text-on-fill px-6 py-2 rounded-lg"
        (click)="submitAssessment()"
      >
        {{ 'proficiency.submit' | t }}
      </button>

      @if (resultLevel(); as level) {
        <div class="mt-4 p-3 bg-surface-100 rounded">
          <p>{{ 'proficiency.result' | t: { level: level } }}</p>
        </div>
      }
    </div>
  `,
  styles: [],
})
export class ProficiencyAssessmentComponent {
  private userService = inject(UserService);

  readonly scoreValue = signal<number>(50);
  readonly resultLevel = signal<string | null>(null);

  async submitAssessment(): Promise<void> {
    const level = await this.userService.assessProficiency(this.scoreValue());
    this.resultLevel.set(level);
  }
}
