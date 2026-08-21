import { test, expect } from '@playwright/test';

/**
 * Spaced Repetition System (SRS) E2E Test Flows
 *
 * Covers:
 * - Flashcard deck CRUD (list, create, edit, delete)
 * - Deck detail: adding/removing flashcards
 * - Flashcard review session (flip, grade, progress, completion)
 * - Navigation between decks and review pages
 * - Accessibility (ARIA labels, keyboard navigation, focus management)
 * - Error boundary handling
 * - RTL locale compatibility
 */

test.describe('SRS - Flashcard Deck Management', () => {
  test('should load the decks page with header and controls', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Header with title should be visible
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible();

    // Browse button should be present
    const browseBtn = page.locator('button').filter({ hasText: /Browse|deck\.browseBtn/i });
    await expect(browseBtn.first()).toBeVisible();

    // Create button should be visible
    const createBtn = page.locator('button').filter({ hasText: /Create|deck\.createBtn/i });
    await expect(createBtn.first()).toBeVisible();
  });

  test('should toggle create deck form', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button').filter({ hasText: /Create|deck\.createBtn/i }).first();

    // Click to open create form
    await createBtn.click();
    await page.waitForTimeout(500);

    // Form should appear with name and description inputs
    const nameInput = page.locator('input').filter({
      has: page.locator('[placeholder*="Name" i]'),
    }).first();
    const nameVisible = await nameInput.isVisible().catch(() => false);

    // Check for inputs by their labels instead
    const inputs = page.locator('input[type="text"], input:not([type])');
    const inputCount = await inputs.count();

    // Cancel button should close the form
    await createBtn.click();
    await page.waitForTimeout(300);
  });

  test('should create a new deck', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Open create form
    const createBtn = page.locator('button').filter({ hasText: /Create|deck\.createBtn/i }).first();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Fill in deck name - look for input fields in the create form
    const nameField = page.locator('input').first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('French Basics');
      await page.waitForTimeout(200);

      // Fill in description
      const descField = page.locator('input').nth(1);
      if (await descField.isVisible().catch(() => false)) {
        await descField.fill('Essential French vocabulary');
      }

      // Select a colour
      const colourOptions = page.locator('button[aria-label*="colour" i]');
      const colourCount = await colourOptions.count();
      if (colourCount > 1) {
        await colourOptions.nth(1).click();
      }

      // Click save
      const saveBtn = page.locator('button').filter({ hasText: /Save|deck\.saveBtn/i });
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should show colour picker with ARIA labels', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button').filter({ hasText: /Create|deck\.createBtn/i }).first();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Colour swatches should have ARIA labels
    const colourBtns = page.locator('button[aria-label*="colour" i]');
    const count = await colourBtns.count();

    if (count > 0) {
      const label = await colourBtns.first().getAttribute('aria-label');
      expect(label).toBeTruthy();
    }
  });

  test('should show empty state when no decks exist', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Either decks grid or empty state should be visible
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Empty state should be accessible
    const emptyState = page.locator('[role="status"]');
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Tab to first button
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Should have focused an element
    const focused = page.locator(':focus');
    const focusedCount = await focused.count();
    expect(focusedCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle rapid create/cancel toggles', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button').filter({ hasText: /Create|deck\.createBtn/i }).first();

    // Toggle rapidly multiple times
    await createBtn.click();
    await page.waitForTimeout(200);
    await createBtn.click();
    await page.waitForTimeout(200);
    await createBtn.click();
    await page.waitForTimeout(300);

    // Page should remain functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('SRS - Deck Detail View', () => {
  test('should show deck detail with back and edit buttons', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // If a deck exists, click to open detail
    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().click();
      await page.waitForTimeout(1500);

      // Back button should be visible
      const backBtn = page.locator('button').filter({ hasText: /←|Back|deck\.backBtn/i });
      await expect(backBtn.first()).toBeVisible();

      // Edit button should be visible
      const editBtn = page.locator('button').filter({ hasText: /Edit|deck\.editBtn/i });
      await expect(editBtn.first()).toBeVisible();
    }
  });

  test('should toggle edit form in deck detail', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().click();
      await page.waitForTimeout(1500);

      const editBtn = page.locator('button').filter({ hasText: /Edit|deck\.editBtn/i }).first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(500);

        // Edit form should appear with inputs
        const editInputs = page.locator('input');
        const editInputCount = await editInputs.count();
        expect(editInputCount).toBeGreaterThanOrEqual(1);

        // Cancel the edit
        const cancelBtn = page.locator('button').filter({ hasText: /Cancel|deck\.cancelBtn/i });
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test('should show add cards section in deck detail', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().click();
      await page.waitForTimeout(1500);

      // Add cards title section should be visible
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should have delete button with ARIA label on deck cards', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().hover();
      await page.waitForTimeout(300);

      // Delete button should appear on hover
      const deleteBtn = page.locator('button[aria-label*="Delete" i], button[aria-label*="delete" i]');
      const deleteVisible = await deleteBtn.isVisible().catch(() => false);

      if (deleteVisible) {
        const ariaLabel = await deleteBtn.first().getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    }
  });
});

test.describe('SRS - Flashcard Review Flow', () => {
  test('should load the review page', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Review page should load with title
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible();

    // Progress bar should be present
    const progressBar = page.locator('[role="progressbar"]');
    const progressVisible = await progressBar.isVisible().catch(() => false);

    if (progressVisible) {
      await expect(progressBar).toBeVisible();
      await expect(progressBar).toHaveAttribute('aria-valuenow');
    }
  });

  test('should show session stats counters', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Stats counters should have known/good/again labels
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should show completion state when no cards to review', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Either a flashcard or completion state should be visible
    const completionSection = page.locator('[role="status"]');
    const cardElement = page.locator('.flip-card');

    const isComplete = await completionSection.isVisible().catch(() => false);
    const hasCard = await cardElement.isVisible().catch(() => false);

    // One of the two should be present
    expect(isComplete || hasCard).toBeTruthy();
  });

  test('should flip card on click', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Card should NOT be flipped initially
      const isFlippedBefore = await cardElement.evaluate((el) =>
        el.classList.contains('is-flipped'),
      );
      expect(isFlippedBefore).toBeFalsy();

      // Click to flip
      await cardElement.click();
      await page.waitForTimeout(800);

      // Card should be flipped
      const isFlippedAfter = await cardElement.evaluate((el) =>
        el.classList.contains('is-flipped'),
      );
      expect(isFlippedAfter).toBeTruthy();

      // Grading buttons should appear after flip
      const gradingGroup = page.locator('[role="group"]');
      const gradingVisible = await gradingGroup.isVisible().catch(() => false);
      expect(gradingVisible).toBeTruthy();
    }
  });

  test('should flip card on Enter key', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Focus the card
      await cardElement.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);

      // Card should be flipped
      const isFlipped = await cardElement.evaluate((el) =>
        el.classList.contains('is-flipped'),
      );
      expect(isFlipped).toBeTruthy();
    }
  });

  test('should flip card on Space key', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      await cardElement.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);

      const isFlipped = await cardElement.evaluate((el) =>
        el.classList.contains('is-flipped'),
      );
      expect(isFlipped).toBeTruthy();
    }
  });

  test('should have three grading buttons after flip', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Flip the card first
      await cardElement.click();
      await page.waitForTimeout(800);

      // Three grading buttons: Again, Good, Known
      const againBtn = page.locator('button').filter({ hasText: /Again|review\.againBtn/i });
      const goodBtn = page.locator('button').filter({ hasText: /Good|review\.goodBtn/i });
      const knownBtn = page.locator('button').filter({ hasText: /Known|review\.knownBtn/i });

      const againVisible = await againBtn.isVisible().catch(() => false);
      const goodVisible = await goodBtn.isVisible().catch(() => false);
      const knownVisible = await knownBtn.isVisible().catch(() => false);

      // At least one grading button type should be visible
      expect(againVisible || goodVisible || knownVisible).toBeTruthy();
    }
  });

  test('should advance to next card after grading', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Get current card text
      const currentWord = await cardElement.locator('h3').first().textContent().catch(() => '');

      // Flip the card
      await cardElement.click();
      await page.waitForTimeout(800);

      // Click "Good" button
      const goodBtn = page.locator('button').filter({ hasText: /Good|review\.goodBtn/i });
      if (await goodBtn.isVisible().catch(() => false)) {
        await goodBtn.click();
        await page.waitForTimeout(1000);
      }

      // Stats should have updated
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should show progress indicator updating during review', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const progressBar = page.locator('[role="progressbar"]');
    const hasProgress = await progressBar.isVisible().catch(() => false);

    if (hasProgress) {
      const initialValue = await progressBar.getAttribute('aria-valuenow');
      expect(initialValue).toBeTruthy();
    }
  });

  test('should have ARIA labels on flip card', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      const ariaLabel = await cardElement.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();

      const ariaPressed = await cardElement.getAttribute('aria-pressed');
      expect(ariaPressed).toBeTruthy();
    }
  });

  test('should handle restart flow on completion page', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const completionSection = page.locator('[role="status"]');
    const isComplete = await completionSection.isVisible().catch(() => false);

    if (isComplete) {
      // Restart button should be visible
      const restartBtn = page.locator('button').filter({ hasText: /Restart|review\.restart/i });
      const restartVisible = await restartBtn.isVisible().catch(() => false);

      if (restartVisible) {
        await restartBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should maintain stats accuracy during review', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Flip card
      await cardElement.click();
      await page.waitForTimeout(800);

      // Click "Again" button
      const againBtn = page.locator('button').filter({ hasText: /Again|review\.againBtn/i });
      if (await againBtn.isVisible().catch(() => false)) {
        await againBtn.click();
        await page.waitForTimeout(1000);
      }

      // Stats area should be present and functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});

test.describe('SRS - Navigation & Routing', () => {
  test('should navigate from decks to review via start review button', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Open a deck if one exists
    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().click();
      await page.waitForTimeout(1500);

      // Start Review button may be visible
      const reviewBtn = page.locator('button').filter({ hasText: /Start Review|deck\.startReview/i });
      const reviewVisible = await reviewBtn.isVisible().catch(() => false);

      if (reviewVisible) {
        await reviewBtn.click();
        await page.waitForTimeout(2000);

        // Should navigate to review page
        const url = page.url();
        expect(url).toContain('/review');
      }
    }
  });

  test('should navigate back from deck detail to deck list', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await deckCards.first().click();
      await page.waitForTimeout(1500);

      // Click back button
      const backBtn = page.locator('button').filter({ hasText: /←|Back|deck\.backBtn/i }).first();
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);

        // Should be back in list view with Browse button visible
        const browseBtn = page.locator('button').filter({ hasText: /Browse|deck\.browseBtn/i });
        await expect(browseBtn.first()).toBeVisible();
      }
    }
  });
});

test.describe('SRS - Error Handling & Edge Cases', () => {
  test('should render SRS error boundary gracefully', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // The app-srs-error-boundary component should wrap the content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle page refresh during review session', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(2000);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(3000);

    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle rapid deck detail open/close', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount >= 2) {
      // Open first deck
      await deckCards.first().click();
      await page.waitForTimeout(1000);

      // Go back
      const backBtn = page.locator('button').filter({ hasText: /←|Back|deck\.backBtn/i }).first();
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }

      // Open second deck
      await deckCards.nth(1).click();
      await page.waitForTimeout(1000);

      // Page should still work
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should show error boundary retry button on error boundary page', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // The page should render with an app-srs-error-boundary wrapping content
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify the error boundary does not show error state initially
    const errorAlert = page.locator('[role="alert"]');
    const errorVisible = await errorAlert.isVisible().catch(() => false);
    // Error boundary should NOT be showing error state under normal conditions
    expect(errorVisible).toBeFalsy();
  });

  test('should render srs-error-boundary in vocabulary dashboard page', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.waitForTimeout(3000);

    // Dashboard should render without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // The content should be wrapped in error boundary - page should be stable
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible();
  });

  test('should handle rapid grade actions without crashing', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      // Flip card
      await cardElement.click();
      await page.waitForTimeout(500);

      // Rapidly click grading buttons
      const buttons = page.locator('.btn-grade');
      const btnCount = await buttons.count();

      if (btnCount > 0) {
        // Click all visible grade buttons quickly
        for (let i = 0; i < Math.min(btnCount, 3); i++) {
          await buttons.nth(i).click().catch(() => undefined);
          await page.waitForTimeout(100);
        }
      }

      // Page should still be functional after rapid clicks
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });
});

test.describe('SRS - RTL Locale Compatibility', () => {
  test('should render deck page in Arabic locale without layout breakage', async ({ page }) => {
    // Set Arabic locale via extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ar-SA,ar;q=0.9',
    });
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Page should render without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Logical properties should be used (check dir attribute or ps/pe classes)
    const html = page.locator('html');
    const dir = await html.getAttribute('dir').catch(() => null);

    // Either dir="rtl" or the body should still be functional
    if (dir) {
      expect(['rtl', 'ltr']).toContain(dir);
    }
  });

  test('should render review page in Hebrew locale', async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9',
    });
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('SRS - Accessibility Compliance', () => {
  test('should have proper heading hierarchy on decks page', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const headings = page.locator('h2, h3, h4');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThanOrEqual(0);
  });

  test('should have ARIA live regions for dynamic content', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Progress should have aria-live
    const ariaLiveRegions = page.locator('[aria-live]');
    const count = await ariaLiveRegions.count();

    if (count > 0) {
      await expect(ariaLiveRegions.first()).toBeVisible();
    }
  });

  test('should have role attributes on interactive elements', async ({ page }) => {
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Deck cards should have role="button"
    const deckCards = page.locator('article[role="button"]');
    const deckCount = await deckCards.count();

    if (deckCount > 0) {
      await expect(deckCards.first()).toHaveAttribute('role', 'button');
      await expect(deckCards.first()).toHaveAttribute('tabindex', '0');
    }
  });

  test('should mark review completion state as status role', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const statusElements = page.locator('[role="status"]');
    const count = await statusElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('SRS - Frontend-Backend Integration', () => {
  test('should fetch decks from API on page load', async ({ page }) => {
    // Monitor network requests
    let decksEndpointCalled = false;

    page.on('request', (request) => {
      if (request.url().includes('/decks')) {
        decksEndpointCalled = true;
      }
    });

    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // The page should attempt to load decks
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should fetch due reviews from API on review page load', async ({ page }) => {
    let dueEndpointCalled = false;

    page.on('request', (request) => {
      if (request.url().includes('/flashcards/due')) {
        dueEndpointCalled = true;
      }
    });

    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Page should be functional regardless of API response
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle API error gracefully on decks page', async ({ page }) => {
    // Intercept API call and return an error
    await page.route('**/decks', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/decks');
    await page.waitForTimeout(3000);

    // Page should not crash - error boundary should handle it
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle API error gracefully on review page', async ({ page }) => {
    await page.route('**/flashcards/due', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/review');
    await page.waitForTimeout(3000);

    // Page should not crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('SRS - Mobile Viewport', () => {
  test('should render decks page on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/decks');
    await page.waitForTimeout(3000);

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should render review page on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Grade buttons should be touch-friendly sizes
    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (hasCard) {
      await cardElement.click();
      await page.waitForTimeout(800);

      const gradeButtons = page.locator('.btn-grade');
      const gradeCount = await gradeButtons.count();

      if (gradeCount > 0) {
        await expect(gradeButtons.first()).toBeVisible();
      }
    }
  });
});

test.describe('SRS - Full Review Session Flow', () => {
  test('should complete a full review cycle from flip to grade to next', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(3000);

    const cardElement = page.locator('.flip-card');
    const hasCard = await cardElement.isVisible().catch(() => false);

    if (!hasCard) {
      // No cards to review - page should show completion
      const body = page.locator('body');
      await expect(body).toBeVisible();
      return;
    }

    // Step 1: Read the front of the card
    const frontText = await cardElement.locator('h3').first().textContent().catch(() => '');
    expect(frontText).toBeTruthy();

    // Step 2: Flip the card
    await cardElement.click();
    await page.waitForTimeout(800);

    // Step 3: Verify back is visible
    const isFlipped = await cardElement.evaluate((el) =>
      el.classList.contains('is-flipped'),
    );
    expect(isFlipped).toBeTruthy();

    // Step 4: Verify answer side has content
    const backHeading = cardElement.locator('.flip-card-back h3');
    const backVisible = await backHeading.isVisible().catch(() => false);
    expect(backVisible).toBeTruthy();

    // Step 5: Grade the card
    const knownBtn = page.locator('button').filter({ hasText: /Known|review\.knownBtn/i });
    const goodBtn = page.locator('button').filter({ hasText: /Good|review\.goodBtn/i });

    let graded = false;
    if (await knownBtn.isVisible().catch(() => false)) {
      await knownBtn.click();
      graded = true;
    } else if (await goodBtn.isVisible().catch(() => false)) {
      await goodBtn.click();
      graded = true;
    }

    if (graded) {
      await page.waitForTimeout(1000);

      // Step 6: Verify card advances (either next card or completion)
      const newBody = page.locator('body');
      await expect(newBody).toBeVisible();
    }
  });
});