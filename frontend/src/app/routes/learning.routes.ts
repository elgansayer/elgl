import { Routes } from '@angular/router';

export const learningRoutes: Routes = [
  {
    path: 'learn/vocabulary',
    loadComponent: () =>
      import('../components/vocabulary-dashboard/vocabulary-dashboard.component').then(
        (m) => m.VocabularyDashboardComponent,
      ),
  },
  {
    path: 'learn/vocabulary/decks',
    loadComponent: () =>
      import('../components/flashcard-deck/flashcard-deck.component').then(
        (m) => m.FlashcardDeckComponent,
      ),
    title: 'Flashcard Decks - HelloTalk',
  },
  {
    path: 'learn/vocabulary/review',
    loadComponent: () =>
      import('../components/flashcard-review/flashcard-review.component').then(
        (m) => m.FlashcardReviewComponent,
      ),
    title: 'Flashcard Review - HelloTalk',
  },
  {
    path: 'learn/vocabulary/suggest-flashcards',
    loadComponent: () =>
      import('../components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'learn/vocabulary/suggest-flashcards/:message',
    loadComponent: () =>
      import('../components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'learn/assessment/diagnostic-quiz',
    loadComponent: () =>
      import('../components/diagnostic-quiz/diagnostic-quiz.component').then(
        (m) => m.DiagnosticQuizComponent,
      ),
    title: 'Language Level Diagnostic - HelloTalk',
  },
  {
    path: 'learn/assessment/proficiency',
    loadComponent: () =>
      import('../components/proficiency-assessment/proficiency-assessment.component').then(
        (m) => m.ProficiencyAssessmentComponent,
      ),
    title: 'Proficiency Assessment - HelloTalk',
  },
  {
    path: 'learn/lessons',
    loadComponent: () =>
      import('../pages/lessons/lessons.component').then((m) => m.LessonsComponent),
    title: 'Lessons - HelloTalk',
  },
  {
    path: 'learn/quests',
    loadComponent: () =>
      import('../components/quests/quests.component').then((m) => m.QuestsComponent),
    title: 'Quests - HelloTalk',
  },
  {
    path: 'learn/read',
    loadComponent: () =>
      import('../components/reading-engine/reading-engine.component').then(
        (m) => m.ReadingEngineComponent,
      ),
    title: 'LingQ Reading Engine - HelloTalk',
  },
  {
    path: 'learn/resource-library',
    loadComponent: () =>
      import('../components/resource-library/resource-library.component').then(
        (m) => m.ResourceLibraryComponent,
      ),
    title: 'Resource Library - HelloTalk',
  },
  {
    path: 'learn/assessment/pronunciation-feedback',
    loadComponent: () =>
      import('../components/pronunciation-feedback/pronunciation-feedback.component').then(
        (m) => m.PronunciationFeedbackComponent,
      ),
    title: 'Pronunciation Feedback - HelloTalk',
  },
  {
    path: 'learn/study-streak',
    loadComponent: () =>
      import('../components/study-streak-counter/study-streak-counter.component').then(
        (m) => m.StudyStreakCounterComponent,
      ),
    title: 'Study Streak - HelloTalk',
  },
  {
    path: 'learn/study-buddy',
    loadComponent: () =>
      import('../components/study-buddy/study-buddy.component').then((m) => m.StudyBuddyComponent),
    title: 'Study Buddy Matching - HelloTalk',
  },
  {
    path: 'learn/ai-chat',
    loadComponent: () =>
      import('../ai-conversation/ai-conversation.component').then((m) => m.AiConversationComponent),
    title: 'AI Conversation - HelloTalk',
  },

  { path: 'vocabulary', redirectTo: 'learn/vocabulary', pathMatch: 'full' },
  { path: 'decks', redirectTo: 'learn/vocabulary/decks', pathMatch: 'full' },
  { path: 'review', redirectTo: 'learn/vocabulary/review', pathMatch: 'full' },
  { path: 'suggest-flashcards', redirectTo: 'learn/vocabulary/suggest-flashcards', pathMatch: 'full' },
  { path: 'suggest-flashcards/:message', redirectTo: 'learn/vocabulary/suggest-flashcards/:message', pathMatch: 'full' },
  { path: 'diagnostic-quiz', redirectTo: 'learn/assessment/diagnostic-quiz', pathMatch: 'full' },
  { path: 'proficiency', redirectTo: 'learn/assessment/proficiency', pathMatch: 'full' },
  { path: 'lessons', redirectTo: 'learn/lessons', pathMatch: 'full' },
  { path: 'quests', redirectTo: 'learn/quests', pathMatch: 'full' },
  { path: 'read', redirectTo: 'learn/read', pathMatch: 'full' },
  { path: 'resource-library', redirectTo: 'learn/resource-library', pathMatch: 'full' },
  { path: 'pronunciation-feedback', redirectTo: 'learn/assessment/pronunciation-feedback', pathMatch: 'full' },
  { path: 'study-streak', redirectTo: 'learn/study-streak', pathMatch: 'full' },
  { path: 'study-buddy', redirectTo: 'learn/study-buddy', pathMatch: 'full' },
  { path: 'ai-conversation', redirectTo: 'learn/ai-chat', pathMatch: 'full' },
];
