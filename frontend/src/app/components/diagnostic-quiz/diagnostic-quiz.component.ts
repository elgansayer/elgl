import { Component, computed, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizService, QuizQuestion } from '../../services/quiz.service';

@Component({
  selector: 'app-diagnostic-quiz',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostic-quiz.component.html',
})
export class DiagnosticQuizComponent implements OnInit {
  private quizService = inject(QuizService);
  quizCompleted = output<{ score: number; suggestedLevel: string }>();

  questions = signal<QuizQuestion[]>([]);
  currentIndex = signal<number>(0);
  answers = signal<Record<string, number>>({});

  currentQuestion = computed(() => this.questions()[this.currentIndex()]);
  progressPercentage = computed(() => {
    if (this.questions().length === 0) return 0;
    return (this.currentIndex() / this.questions().length) * 100;
  });
  isLastQuestion = computed(() => {
    if (this.questions().length === 0) return false;
    return this.currentIndex() === this.questions().length - 1;
  });
  canProceed = computed(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    return this.answers()[q.id] !== undefined;
  });

  ngOnInit(): void {
    this.quizService.getQuestions('en').subscribe(data => {
      this.questions.set(data);
    });
  }

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
