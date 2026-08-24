const avatarDataUrl =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const baseMoment = {
  id: 'moment-1',
  user_id: 'partner-1',
  text_content: '今日は日本語を勉強しています。',
  media_urls: [],
  media_type: 'none',
  target_language: 'ja',
  is_pinned: false,
  likes_count: 2,
  comments_count: 0,
  created_at: '2026-08-24T12:00:00.000Z',
  is_liked_by_me: false,
  author: {
    id: 'partner-1',
    display_name: 'Aiko Test',
    avatar_url: avatarDataUrl,
  },
};

const followingMoment = {
  ...baseMoment,
  id: 'moment-following',
  text_content: 'Following feed moment',
  author: {
    id: 'partner-2',
    display_name: 'Following Partner',
    avatar_url: avatarDataUrl,
  },
};

describe('Moments Flow (Mocked)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/moments/feed*', (req) => {
      const filter = new URL(req.url).searchParams.get('filter');
      req.reply({
        statusCode: 200,
        body: filter === 'Following' ? [followingMoment] : [baseMoment],
      });
    }).as('getMomentsFeed');

    cy.intercept('POST', '**/api/nlp/grammar-check', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          original: req.body.text,
          corrected: req.body.text,
          explanation: '',
          errors_found: 0,
        },
      });
    }).as('grammarCheck');

    cy.intercept('POST', '**/api/moments', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          id: 'moment-created',
          user_id: 'mock-user-123',
          text_content: req.body.text_content,
          media_urls: req.body.media_urls ?? [],
          media_type: req.body.media_type ?? 'none',
          target_language: req.body.target_language,
          is_pinned: false,
          likes_count: 0,
          comments_count: 0,
          created_at: '2026-08-24T12:05:00.000Z',
          is_liked_by_me: false,
          author: {
            id: 'mock-user-123',
            display_name: 'Current User',
            avatar_url: avatarDataUrl,
          },
        },
      });
    }).as('createMoment');

    cy.intercept('POST', '**/api/moments/moment-1/like', {
      statusCode: 200,
      body: { likes_count: 3, is_liked: true },
    }).as('likeMoment');
  });

  it('loads the feed and switches to the Following filter', () => {
    cy.visit('/moments');

    cy.wait('@getMomentsFeed')
      .its('request.url')
      .should('include', 'filter=All');
    cy.get('article').should('have.length', 1);
    cy.contains('Aiko Test').should('be.visible');
    cy.contains('今日は日本語を勉強しています。').should('be.visible');

    cy.get('button[role="radio"][aria-label="Following"]').click();
    cy.wait('@getMomentsFeed')
      .its('request.url')
      .should('include', 'filter=Following');
    cy.contains('Following Partner').should('be.visible');
    cy.contains('Following feed moment').should('be.visible');
    cy.contains('Aiko Test').should('not.exist');
  });

  it('publishes a text Moment through grammar validation and the create API', () => {
    const text = 'My deterministic Cypress Moment';

    cy.visit('/moments');
    cy.wait('@getMomentsFeed');

    cy.get('header button').last().click();
    cy.get('textarea').should('be.visible').type(text);
    cy.contains('button', /^Post$/i).should('be.enabled').click();

    cy.wait('@grammarCheck').then(({ request }) => {
      expect(request.body).to.deep.equal({ text, language: 'en' });
    });
    cy.wait('@createMoment').then(({ request }) => {
      expect(request.body).to.deep.equal({
        text_content: text,
        media_urls: [],
        media_type: 'none',
        target_language: 'en',
      });
    });

    cy.contains(text).should('be.visible');
    cy.get('textarea').should('not.exist');
  });

  it('updates the visible like state from the authoritative API response', () => {
    cy.visit('/moments');
    cy.wait('@getMomentsFeed');

    cy.get('article').first().contains('button', '🤍').click();
    cy.wait('@likeMoment');

    cy.get('article').first().contains('button', '❤️').should('be.visible');
    cy.get('article').first().contains('button', /^3$/).should('be.visible');
  });
});
