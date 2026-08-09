const fs = require('fs');

const files = [
  'backend/src/users/dto/update-profile.dto.ts',
  'backend/src/users/entities/user.entity.ts',
  'backend/src/users/interfaces/user-profile.interface.ts',
  'backend/src/users/users.service.spec.ts',
  'backend/src/users/users.service.ts',
  'backend/src/database/seed.ts',
  'backend/src/notifications/interfaces/notification.interface.ts',
  'backend/src/notifications/notifications.service.ts',
  'backend/src/mock-data.ts',
  'backend/src/profile-visits/profile-visits.service.ts',
  'backend/src/profile-visits/profile-visits.service.spec.ts',
  'backend/src/discovery/dto/search-query.dto.ts',
  'backend/src/discovery/discovery.controller.spec.ts',
  'backend/src/discovery/discovery.service.spec.ts',
  'backend/src/discovery/discovery.service.ts',
  'backend/src/feed/feed.service.ts',
  'frontend/src/app/components/visitor-logs/visitor-logs.component.html',
  'frontend/src/app/components/profile/profile.component.ts',
  'frontend/src/app/components/profile/profile.component.html',
  'frontend/src/app/components/user-detail/user-detail.component.html',
  'frontend/src/app/components/profile-edit/profile-edit.component.html',
  'frontend/src/app/components/developer-dashboard/developer-dashboard.component.html',
  'frontend/src/app/components/profile-visitors/profile-visitors.component.ts',
  'frontend/src/app/components/discovery/global-search/global-search.component.ts',
  'frontend/src/app/components/discovery/discovery.component.ts',
  'frontend/src/app/services/feed.service.ts',
  'frontend/src/app/services/mock-data.ts',
  'frontend/src/app/services/user.service.ts',
  'frontend/src/app/services/discovery.service.ts',
  'frontend/src/app/services/notification.service.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // TypeScript Typings
  content = content.replace(/native_language\?: string;/g, 'native_languages?: string[];');
  content = content.replace(/native_language: string;/g, 'native_languages: string[];');
  content = content.replace(/native_language!: string \| null;/g, 'native_languages!: string[];');

  // Seed/Mock Data formatting: native_language: 'en' => native_languages: ['en']
  content = content.replace(/native_language: (['"].*?['"])/g, 'native_languages: [$1]');

  // Variable references
  content = content.replace(/\bnative_language\b/g, 'native_languages');

  // CamelCase standard replacements (e.g., in profile.component.ts)
  content = content.replace(/\bnativeLanguage\b/g, 'nativeLanguages');
  content = content.replace(/nativeLanguages: string;/g, 'nativeLanguages: string[];');
  content = content.replace(/nativeLanguages = 'en';/g, "nativeLanguages: string[] = ['en'];");

  // Discovery array checks (Supabase JS requires contains for array)
  content = content.replace(
    /queryBuilder = queryBuilder\.eq\('native_languages', query\.native_languages\);/g,
    "queryBuilder = queryBuilder.contains('native_languages', [query.native_languages]);",
  );

  // Discovery spec array mock check
  content = content.replace(
    /expect\(mockQueryBuilder\.eq\)\.toHaveBeenCalledWith\('native_languages', 'ES'\);/g,
    "expect(mockQueryBuilder.contains).toHaveBeenCalledWith('native_languages', ['ES']);",
  );

  // Profile Visited spec
  content = content.replace(
    /expect\(result\[0\]\.visitor\.native_languages\)\.toBe\(\['en'\]\);/g,
    "expect(result[0].visitor.native_languages).toEqual(['en']);",
  );

  // Discovery Target Lang logic (frontend)
  content = content.replace(
    /u => u\.native_languages === query\.native_languages/g,
    'u => u.native_languages?.includes(query.native_languages!)',
  );

  // feed.service.ts
  content = content.replace(/u\.profile\.native_languages/g, 'u.profile.native_languages?.[0]');

  fs.writeFileSync(file, content);
}
console.log('Refactor complete');
