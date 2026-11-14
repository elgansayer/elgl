import { HelpController } from './help.controller';
import { HelpService } from './help.service';

describe('HelpController', () => {
  const service = {
    findAll: vi
      .fn()
      .mockReturnValue({ items: [], total: 0, page: 1, limit: 10 }),
    getCategories: vi.fn().mockReturnValue(['account']),
    getQuickReplies: vi.fn().mockReturnValue(['Reset password']),
  };
  const controller = new HelpController(service as unknown as HelpService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the validated query to the service', () => {
    const query = { category: 'account', page: 1, limit: 10 };

    expect(controller.getArticles(query)).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('returns categories and quick replies', () => {
    expect(controller.getCategories()).toEqual(['account']);
    expect(controller.getQuickReplies()).toEqual(['Reset password']);
  });
});
