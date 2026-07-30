import { Component, input, output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProficiencyService, AssessmentResult, AssessmentResultDto } from '../../services/proficiency.service';

@Component({
  selector: 'app-proficiency-assessment',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>Proficiency Level Assessment</h2>
    <label>
      Grammar Score:
      <input type="number" [(ngModel)]="grammarScore" min="0" max="100" />
    </label>
    <label>
      Vocabulary Score:
      <input type="number" [(ngModel)]="vocabularyScore" min="0" max="100" />
    </label>
    <label>
      Pronunciation Score:
      <input type="number" [(ngModel)]="pronunciationScore" min="0" max="100" />
    </label>
    <button (click)="onAssess()">Assess</button>
    @if (result(); as r) {
      <div>
        <p>Level: {{ r.level }}</p>
        <p>Overall Score: {{ r.overallScore }}</p>
        <p>Grammar: {{ r.grammarScore }}</p>
        <p>Vocabulary: {{ r.vocabularyScore }}</p>
        <p>Pronunciation: {{ r.pronunciationScore }}</p>
        <p>Tested At: {{ r.testedAt }}</p>
      </div>
    }
  `,
})
export class ProficiencyAssessmentComponent {
  private proficiencyService = inject(ProficiencyService);

  readonly userId = input<string>('');

  readonly assessedLevel = output<string>();

  grammarScore = 0;
  vocabularyScore = 0;
  pronunciationScore = 0;

  result = signal<AssessmentResult | null>(null);

  async onAssess(): Promise<void> {
    const dto: AssessmentResultDto = {
      userId: this.userId(),
      grammarScore: this.grammarScore,
      vocabularyScore: this.vocabularyScore,
      pronunciationScore: this.pronunciationScore,
    };
    try {
      const res = await this.proficiencyService.assess(dto).toPromise();
      this.result.set(res);
      this.assessedLevel.emit(res.level);
    } catch (err) {
      console.error('Assessment failed', err);
    }
  }
}
