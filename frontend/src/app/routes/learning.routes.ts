import { Routes } from '@angular/router';

export const learningRoutes: Routes = [
  {
    path: 'vocabulary',
    redirectTo: 'learn/vocabulary',
    pathMatch: 'full',
  },
  {
    path: 'learn/vocabulary',
    loadComponent: () =>
      import('../components/vocabulary-dashboard/vocabulary-dashboard.component').then(
        (m) => m.VocabularyDashboardComponent,
      ),
  },
  {
    path: 'decks',
    redirectTo: 'learn/vocabulary/decks',
    pathMatch: 'full',
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
    path: 'review',
    redirectTo: 'learn/vocabulary/review',
    pathMatch: 'full',
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
    redirectTo: 'learn/assessment',
    pathMatch: 'full',
  },
  {
    path: 'proficiency',
    redirectTo: 'learn/assessment',
    pathMatch: 'full',
  },
  {
    path: 'learn/assessment',
    loadComponent: () =>
      import('../components/proficiency-assessment/proficiency-assessment.component').then(
        (m) => m.ProficiencyAssessmentComponent,
      ),
    title: 'Language Assessment - HelloTalk',
  },
  {
    path: 'lessons',
    redirectTo: 'learn/lessons',
    pathMatch: 'full',
  },
  {
    path: 'learn/lessons',
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
    redirectTo: 'learn/read',
    pathMatch: 'full',
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
    path: 'resource-library',
    loadComponent: () =>
      import('../components/resource-library/resource-library.component').then(
        (m) => m.ResourceLibraryComponent,
      ),
    title: 'Resource Library - HelloTalk',
  },
  {
    path: 'pronunciation-feedback',
    redirectTo: 'learn/assessment/pronunciation',
    pathMatch: 'full',
  },
  {
    path: 'learn/assessment/pronunciation',
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
    redirectTo: 'learn/ai-chat',
    pathMatch: 'full',
  },
  {
    path: 'learn/ai-chat',
    loadComponent: () =>
      import('../ai-conversation/ai-conversation.component').then((m) => m.AiConversationComponent),
    title: 'AI Conversation - HelloTalk',
  },
];
