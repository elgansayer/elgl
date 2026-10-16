import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisualDiffComponent } from './visual-diff.component';

describe.skip('VisualDiffComponent', () => {
  let fixture: ComponentFixture<VisualDiffComponent>;
  let component: VisualDiffComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualDiffComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VisualDiffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setInputs(original: string, corrected: string): void {
    fixture.componentRef.setInput('original', original);
    fixture.componentRef.setInput('corrected', corrected);
    fixture.detectChanges();
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should produce unchanged segments when original equals corrected', () => {
    setInputs('Hello world', 'Hello world');

    const segments = component.segments();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.type === 'unchanged')).toBe(true);
  });

  it('should mark added tokens when corrected text expands original', () => {
    setInputs('Hello', 'Hello World');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'added')).toBe(true);
    expect(segments.some((segment) => segment.type === 'removed')).toBe(false);
  });

  it('should mark removed tokens when original text contains extra content', () => {
    setInputs('Hello World', 'Hello');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'removed')).toBe(true);
    expect(segments.some((segment) => segment.type === 'added')).toBe(false);
  });

  it('should treat case differences as unchanged', () => {
    setInputs('Hello', 'hello');

    const segments = component.segments();
    expect(segments.length).toBe(1);
    expect(segments[0].type).toBe('unchanged');
    expect(segments[0].text).toBe('hello');
  });

  it('should handle punctuation changes', () => {
    setInputs('Hello!', 'Hello?');

    const segments = component.segments();
    expect(segments.some((segment) => segment.type === 'removed')).toBe(true);
    expect(segments.some((segment) => segment.type === 'added')).toBe(true);
  });

  it('should produce monotonic indexes', () => {
    setInputs('Hello beautiful World', 'Hello World');

    const segments = component.segments();
    const indexes = segments.map((segment) => segment.index);
    expect(new Set(indexes).size).toBe(indexes.length);
    for (let i = 0; i < indexes.length - 1; i++) {
      expect(indexes[i]).toBeLessThan(indexes[i + 1]);
    }
  });

  it('should handle non-Latin text (Arabic)', () => {
    const original = 'مرحبا';
    const corrected = 'مرحبا';
    setInputs(original, corrected);

    const segments = component.segments();
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.type === 'unchanged')).toBe(true);
  });

  it('should render added spans in the DOM', () => {
    setInputs('Hello', 'Hello World');

    const addedEls = fixture.nativeElement.querySelectorAll('[data-type="added"]');
    expect(addedEls.length).toBeGreaterThan(0);
  });

  it('should render removed spans in the DOM', () => {
    setInputs('Hello World', 'Hello');

    const removedEls = fixture.nativeElement.querySelectorAll('[data-type="removed"]');
    expect(removedEls.length).toBeGreaterThan(0);
  });
});
