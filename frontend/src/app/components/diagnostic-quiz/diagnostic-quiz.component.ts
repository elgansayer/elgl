import { Component, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; points: number }[];
}

@Component({
  selector: 'app-diagnostic-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostic-quiz.component.html',
})
export class DiagnosticQuizComponent {
  quizCompleted = output<{ score: number; suggestedLevel: string }>();

  // Mock diagnostic questions (in a real app, these might be fetched via an Input or Service)
  questions = signal<QuizQuestion[]>([
    {
      id: 'q1',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
      options: [
        { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
        { id: 'o2', text: 'I can do it with simple phrases if the other person speaks slowly.', points: 2 },
        { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
      ],
    },
    {
      id: 'q2',
      text: 'Can you understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.?',
      options: [
        { id: 'o1', text: 'No, I need translation for most things.', points: 1 },
        { id: 'o2', text: 'Yes, if the topic is very familiar to me.', points: 2 },
        { id: 'o3', text: 'Yes, I understand almost everything clearly.', points: 3 },
      ],
    },
    {
      id: 'q3',
      text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
      options: [
        { id: 'o1', text: 'I cannot do this yet.', points: 1 },
        { id: 'o2', text: 'I can give brief reasons and explanations.', points: 2 },
        { id: 'o3', text: 'I can express myself fluently and spontaneously.', points: 3 },
      ],
    }
  ]);

  currentIndex = signal<number>(0);
  answers = signal<Record<string, number>>({});

  currentQuestion = computed(() => this.questions()[this.currentIndex()]);
  progressPercentage = computed(() => (this.currentIndex() / this.questions().length) * 100);
  isLastQuestion = computed(() => this.currentIndex() === this.questions().length - 1);
  canProceed = computed(() => this.answers()[this.currentQuestion().id] !== undefined);

  selectOption(questionId: string, points: number): void {
    this.answers.update(prev => ({ ...prev, [questionId]: points }));
  }

  next(): void {
    if (this.isLastQuestion()) {
      this.finishQuiz();
    } else {
      this.currentIndex.update(i => i + 1);
    }
  }

  previous(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
    }
  }

  private finishQuiz(): void {
    const totalScore = Object.values(this.answers()).reduce((sum, pts) => sum + pts, 0);
    let suggestedLevel = 'A1';
    
    if (totalScore >= 8) suggestedLevel = 'C1/C2';
    else if (totalScore >= 6) suggestedLevel = 'B2';
    else if (totalScore >= 4) suggestedLevel = 'B1';
    else if (totalScore >= 3) suggestedLevel = 'A2';

    this.quizCompleted.emit({ score: totalScore, suggestedLevel });
  }
}
