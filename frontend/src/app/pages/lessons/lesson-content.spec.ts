import { lessonSections } from './lesson-content';

describe('lessonSections', () => {
  it('normalizes structured sections without interpreting HTML', () => {
    expect(
      lessonSections({
        sections: [
          { title: 'Greeting', body: '<script>alert(1)</script> こんにちは' },
          { text: 'Second section' },
          null,
        ],
      }),
    ).toEqual([
      { title: 'Greeting', body: '<script>alert(1)</script> こんにちは' },
      { title: null, body: 'Second section' },
    ]);
  });

  it('supports legacy flat content objects', () => {
    expect(lessonSections({ intro: 'Welcome', practice: 'Repeat this.' })).toEqual([
      { title: 'intro', body: 'Welcome' },
      { title: 'practice', body: 'Repeat this.' },
    ]);
  });

  it('ignores unsupported values', () => {
    expect(lessonSections({ sections: [{ title: 'No body' }, 42] })).toEqual([]);
  });
});
