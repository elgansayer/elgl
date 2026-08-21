import { Routes } from '@angular/router';

export const learningRoutes: Routes = [
  {
    path: 'vocabulary',
    loadComponent: () =>
      import('../components/vocabulary-dashboard/vocabulary-dashboard.component').then(
        (m) => m.VocabularyDashboardComponent,
      ),
  },
  {
    path: 'decks',
    loadComponent: () =>
      import('../components/flashcard-deck/flashcard-deck.component').then(
        (m) => m.FlashcardDeckComponent,
      ),
    title: 'Flashcard Decks - HelloTalk',
  },
  {
    path: 'review',
    loadComponent: () =>
      import('../components/flashcard-review/flashcard-review.component').then(
        (m) => m.FlashcardReviewComponent,
      ),
    title: 'Flashcard Review - HelloTalk',
  },
  {
    path: 'suggest-flashcards',
    loadComponent: () =>
      import('../components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'suggest-flashcards/:message',
    loadComponent: () =>
      import('../components/suggest-flashcards/suggest-flashcards.component').then(
        (m) => m.SuggestFlashcardsComponent,
      ),
    title: 'Suggest Flashcards - HelloTalk',
  },
  {
    path: 'diagnostic-quiz',
    loadComponent: () =>
      import('../components/diagnostic-quiz/diagnostic-quiz.component').then(
        (m) => m.DiagnosticQuizComponent,
      ),
    title: 'Language Level Diagnostic - HelloTalk',
  },
  {
    path: 'proficiency',
    loadComponent: () =>
      import('../components/proficiency-assessment/proficiency-assessment.component').then(
        (m) => m.ProficiencyAssessmentComponent,
      ),
    title: 'Proficiency Assessment - HelloTalk',
  },
  {
    path: 'lessons',
    loadComponent: () =>
      import('../pages/lessons/lessons.component').then((m) => m.LessonsComponent),
    title: 'Lessons - HelloTalk',
  },
  {
    path: 'quests',
    loadComponent: () =>
      import('../components/quests/quests.component').then((m) => m.QuestsComponent),
    title: 'Quests - HelloTalk',
  },
  {
    path: 'read',
    loadComponent: () =>
      import('../components/reading-engine/reading-engine.component').then(
        (m) => m.ReadingEngineComponent,
      ),
    title: 'LingQ Reading Engine - HelloTalk',
  },
  {
    path: 'resource-library',
    loadComponent: () =>
      import('../components/resource-library/resource-library.component').then(
        (m) => m.ResourceLibraryComponent,
      ),
    title: 'Resource Library - HelloTalk',
  },
  {
    path: 'pronunciation-feedback',
    loadComponent: () =>
      import('../components/pronunciation-feedback/pronunciation-feedback.component').then(
        (m) => m.PronunciationFeedbackComponent,
      ),
    title: 'Pronunciation Feedback - HelloTalk',
  },
  {
    path: 'study-streak',
    loadComponent: () =>
      import('../components/study-streak-counter/study-streak-counter.component').then(
        (m) => m.StudyStreakCounterComponent,
      ),
    title: 'Study Streak - HelloTalk',
  },
  {
    path: 'study-buddy',
    loadComponent: () =>
      import('../components/study-buddy/study-buddy.component').then((m) => m.StudyBuddyComponent),
    title: 'Study Buddy Matching - HelloTalk',
  },
  {
    path: 'ai-conversation',
    loadComponent: () =>
      import('../ai-conversation/ai-conversation.component').then((m) => m.AiConversationComponent),
    title: 'AI Conversation - HelloTalk',
  },
  {
    path: 'language',
    loadComponent: () =>
      import('../pages/language-settings/language-settings.component').then(
        (m) => m.LanguageSettingsComponent,
      ),
    title: 'Language Settings - HelloTalk',
  },
];
