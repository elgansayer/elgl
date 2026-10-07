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
    path: 'vocabulary',
    redirectTo: 'learn/vocabulary',
    pathMatch: 'full',
  },
  {
    path: 'decks',
    redirectTo: 'learn/vocabulary',
    pathMatch: 'full',
  },
  {
    path: 'review',
    redirectTo: 'learn/vocabulary',
    pathMatch: 'full',
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
    path: 'learn/assessment',
    loadComponent: () =>
      import('../components/proficiency-assessment/proficiency-assessment.component').then(
        (m) => m.ProficiencyAssessmentComponent,
      ),
    title: 'Proficiency Assessment - HelloTalk',
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
    path: 'learn/lessons',
    loadComponent: () =>
      import('../pages/lessons/lessons.component').then((m) => m.LessonsComponent),
    title: 'Lessons - HelloTalk',
  },
  {
    path: 'lessons',
    redirectTo: 'learn/lessons',
    pathMatch: 'full',
  },
  {
    path: 'quests',
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
    path: 'read',
    redirectTo: 'learn/read',
    pathMatch: 'full',
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
    redirectTo: 'learn/assessment',
    pathMatch: 'full',
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
    path: 'learn/ai-chat',
    loadComponent: () =>
      import('../ai-conversation/ai-conversation.component').then((m) => m.AiConversationComponent),
    title: 'AI Conversation - HelloTalk',
  },
  {
    path: 'ai-conversation',
    redirectTo: 'learn/ai-chat',
    pathMatch: 'full',
  },
];
