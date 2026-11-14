import { HelpService } from './help.service';

describe('HelpService', () => {
  const service = new HelpService();

  it('returns a bounded page of FAQ articles', () => {
    const result = service.findAll({ page: 1, limit: 3 });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBeGreaterThan(3);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
  });

  it('filters by category and search text', () => {
    const account = service.findAll({ category: 'ACCOUNT' });
    expect(account.items.length).toBeGreaterThan(0);
    expect(account.items.every((item) => item.category === 'account')).toBe(
      true,
    );

    const search = service.findAll({ search: 'password' });
    expect(search.items.length).toBeGreaterThan(0);
    expect(
      search.items.every(
        (item) =>
          item.question.toLowerCase().includes('password') ||
          item.answer.toLowerCase().includes('password'),
      ),
    ).toBe(true);
  });

  it('returns an empty page when nothing matches', () => {
    const result = service.findAll({ search: 'zzzz-not-a-faq' });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('lists the available categories and quick replies', () => {
    expect(service.getCategories()).toEqual(
      expect.arrayContaining(['account', 'privacy', 'billing', 'general']),
    );
    expect(service.getQuickReplies().length).toBeGreaterThan(0);
  });
});
