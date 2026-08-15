import { AdminOperationalEventsService } from './admin-operational-events.service';
import { AdminOperationalEventsV1Controller } from './admin-operational-events-v1.controller';

describe('AdminOperationalEventsV1Controller', () => {
  it('delegates bounded log queries to the operational event service', async () => {
    const events = {
      list: vi.fn().mockResolvedValue({ events: [], total: 0, page: 1, pageSize: 25 }),
    };
    const controller = new AdminOperationalEventsV1Controller(
      events as unknown as AdminOperationalEventsService,
    );
    const query = { page: 1, pageSize: 25, severity: 'warning' as const };

    await expect(controller.list(query)).resolves.toEqual({
      events: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    expect(events.list).toHaveBeenCalledWith(query);
  });
});
