import { test, expect, type Page } from '@playwright/test';

const createdAt = '2026-08-25T12:00:00.000Z';

async function installMomentsApi(page: Page): Promise<void> {
  await page.route('**/api/moments/feed**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-user-123',
        display_name: 'E2E Learner',
        native_languages: ['en'],
        target_languages: ['ja'],
        is_vip: false,
        vip_tier: 'free',
        coins_balance: 0,
        study_streak_days: 0,
        correction_ratio: 0,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_from_search: false,
        privacy_hide_gender: false,
        created_at: createdAt,
      }),
    });
  });

  await page.route('**/api/nlp/grammar-check', async (route) => {
    const requestBody = route.request().postDataJSON() as { text?: string };
    const text = requestBody.text ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        original: text,
        corrected: text,
        explanation: 'No corrections needed.',
        errors_found: 0,
      }),
    });
  });
}

async function openComposer(page: Page) {
  const composeButton = page.locator('header button').last();
  await expect(composeButton).toBeVisible();
  await composeButton.click();

  const composer = page.locator('section').first();
  const textarea = composer.locator('textarea');
  await expect(textarea).toBeVisible();
  return { composeButton, composer, textarea };
}

test.describe('HelloTalk Moment Creation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await installMomentsApi(page);
  });

  test('creates a text Moment through the grammar-check and Moments API boundaries', async ({
    page,
  }) => {
    let momentPayload: unknown;

    await page.route('**/api/moments', async (route) => {
      momentPayload = route.request().postDataJSON();
      const requestBody = momentPayload as {
        text_content?: string;
        media_type?: 'none' | 'images' | 'audio';
        target_language?: string;
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'moment_e2e_created',
          user_id: 'mock-user-123',
          text_content: requestBody.text_content,
          media_urls: [],
          media_type: requestBody.media_type ?? 'none',
          target_language: requestBody.target_language ?? 'ja',
          is_pinned: false,
          likes_count: 0,
          comments_count: 0,
          created_at: createdAt,
          author: { id: 'mock-user-123', display_name: 'E2E Learner', avatar_url: null },
        }),
      });
    });

    const profileResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/users/me') && response.request().method() === 'GET',
    );
    await page.goto('/moments');
    await profileResponse;

    const { composer, textarea } = await openComposer(page);
    const text = '今日は日本語をれんしゅうしました。';
    await textarea.fill(text);

    const createRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/moments'),
    );
    await composer.locator('button').last().click();
    await createRequest;

    expect(momentPayload).toMatchObject({
      text_content: text,
      media_urls: [],
      media_type: 'none',
      target_language: 'ja',
    });
    await expect(page.locator('article').filter({ hasText: text })).toBeVisible();
  });

  test('retains a failed Moment draft so the user can retry without retyping', async ({ page }) => {
    await page.route('**/api/moments', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Temporarily unavailable' }),
      });
    });

    await page.goto('/moments');

    const { composeButton, composer, textarea } = await openComposer(page);
    const text = 'Retry-safe draft text';
    await textarea.fill(text);

    const failedResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/moments') && response.request().method() === 'POST',
    );
    await composer.locator('button').last().click();
    await failedResponse;

    await composeButton.click();
    await expect(page.locator('section').first().locator('textarea')).toHaveValue(text);
  });
});
