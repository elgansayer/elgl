import { UserProfile, ProfileVisitor } from './user.service';
import { AppUser } from './auth.service';

export const MOCK_CURRENT_USER: AppUser = {
  id: 'mock-user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'mockuser@example.com',
  phone: '',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    display_name: 'Mock User',
    avatar_url: 'https://i.pravatar.cc/150?u=mock-user-123',
  },
  created_at: new Date().toISOString(),
  is_vip: true,
  vip_tier: 'premium',
};

export const MOCK_USER_PROFILE: UserProfile = {
  id: 'mock-user-123',
  display_name: 'Mock User',
  native_language: 'en',
  target_languages: ['es', 'ja'],
  bio_text: 'I am a mock user learning Spanish and Japanese.',
  avatar_url: 'https://i.pravatar.cc/150?u=mock-user-123',
  is_vip: true,
  vip_tier: 'premium',
  coins_balance: 500,
  study_streak_days: 12,
  correction_ratio: 0.9,
  is_serious_learner: true,
  privacy_hide_age: false,
  privacy_hide_location: false,
  privacy_hide_from_search: false,
  created_at: new Date().toISOString(),
};

export const MOCK_PARTNERS: UserProfile[] = [
  {
    id: 'partner-1',
    display_name: 'Kenji',
    native_language: 'ja',
    target_languages: ['en'],
    bio_text: 'Hello! I want to practice English and can help with Japanese.',
    avatar_url: 'https://i.pravatar.cc/150?u=partner-1',
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 100,
    study_streak_days: 4,
    correction_ratio: 0.5,
    is_serious_learner: true,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'partner-2',
    display_name: 'Maria',
    native_language: 'es',
    target_languages: ['en'],
    bio_text: 'Soy de Madrid. Let us talk in English!',
    avatar_url: 'https://i.pravatar.cc/150?u=partner-2',
    is_vip: true,
    vip_tier: 'premium',
    coins_balance: 100,
    study_streak_days: 20,
    correction_ratio: 0.8,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    created_at: new Date().toISOString(),
  }
];

export const MOCK_VISITORS: ProfileVisitor[] = [
  {
    id: 'visit-1',
    visitor_id: 'partner-1',
    viewed_id: 'mock-user-123',
    created_at: new Date().toISOString(),
    visitor: {
      id: 'partner-1',
      display_name: 'Kenji',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-1',
      native_language: 'ja',
      target_languages: ['en']
    }
  }
];

export const MOCK_MOMENTS = [
  {
    id: 'moment-1',
    user_id: 'partner-1',
    text_content: 'Today I went to the park. The weather is so nice!',
    target_language: 'en',
    native_language: 'ja',
    media_urls: [],
    media_type: null,
    location_name: null,
    created_at: new Date().toISOString(),
    likes_count: 5,
    comments_count: 2,
    is_pinned: false,
    is_liked_by_me: false,
    author: {
      id: 'partner-1',
      display_name: 'Kenji',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-1'
    },
    comments: []
  },
  {
    id: 'moment-2',
    user_id: 'partner-2',
    text_content: 'Hola a todos! Quiero aprender más inglés.',
    target_language: 'en',
    native_language: 'es',
    media_urls: ['https://via.placeholder.com/400'],
    media_type: 'images',
    location_name: 'Madrid',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    likes_count: 12,
    comments_count: 5,
    is_pinned: false,
    is_liked_by_me: true,
    author: {
      id: 'partner-2',
      display_name: 'Maria',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-2'
    },
    comments: []
  }
];
