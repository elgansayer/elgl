import { Language } from 'node-nlp';

describe('language detector runtime dependency', () => {
  it('loads the lightweight language-only runtime behind the node-nlp alias', () => {
    const detector = new Language();

    expect(detector.guess).toBeTypeOf('function');
    expect(detector.guess('This is a short English sentence.', undefined, 1)).toEqual(
      expect.any(Array),
    );
  });
});
