import { SpamDetectionService } from './spam-detection.service';

describe('SpamDetectionService', () => {
  let service: SpamDetectionService;

  beforeEach(() => {
    service = new SpamDetectionService();
  });

  it('does not classify empty content as spam', () => {
    expect(service.isSpam('')).toBe(false);
  });

  it('flags a repeated identical message after the duplicate threshold', () => {
    expect(service.isSpam('buy cheap coins now')).toBe(false);
    expect(service.isSpam('buy cheap coins now')).toBe(false);
    expect(service.isSpam('buy cheap coins now')).toBe(true);
  });

  it('keeps unrelated messages out of the spam verdict', () => {
    service.isSpam('hola, como estas?');

    expect(service.isSpam('the weather is nice in Lisbon today')).toBe(false);
  });
});
