import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkPreviewCardComponent } from './link-preview-card.component';

describe('LinkPreviewCardComponent', () => {
  let fixture: ComponentFixture<LinkPreviewCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkPreviewCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkPreviewCardComponent);
  });

  function setInputs(inputs: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  }): void {
    fixture.componentRef.setInput('url', inputs.url);
    fixture.componentRef.setInput('title', inputs.title ?? '');
    fixture.componentRef.setInput('description', inputs.description ?? '');
    fixture.componentRef.setInput('image', inputs.image ?? '');
    fixture.componentRef.setInput('siteName', inputs.siteName ?? '');
    fixture.detectChanges();
  }

  it('renders the link URL as the anchor href', () => {
    setInputs({ url: 'https://example.com/article' });
    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.href).toBe('https://example.com/article');
  });

  it('does not render a card for an unsafe destination URL', () => {
    setInputs({
      url: 'javascript:alert(1)',
      title: 'Unsafe preview',
    });

    expect(fixture.debugElement.query(By.css('a'))).toBeNull();
  });

  it('renders title, description, and site name', () => {
    setInputs({
      url: 'https://example.com',
      title: 'Test Title',
      description: 'Test Description',
      siteName: 'Example Site',
    });

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test Title');
    expect(el.textContent).toContain('Test Description');
    expect(el.textContent).toContain('Example Site');
  });

  it('renders an image when provided', () => {
    setInputs({
      url: 'https://example.com',
      image: 'https://example.com/img.png',
    });

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toBe('https://example.com/img.png');
  });

  it('does not render an unsafe image URL', () => {
    setInputs({
      url: 'https://example.com',
      image: 'data:text/html,<script>alert(1)</script>',
    });

    expect(fixture.debugElement.query(By.css('img'))).toBeNull();
  });

  it('removes a preview image after the browser reports a load failure', () => {
    setInputs({
      url: 'https://example.com',
      image: 'https://example.com/broken.png',
    });

    fixture.debugElement.query(By.css('img')).triggerEventHandler('error');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('img'))).toBeNull();
    expect(fixture.debugElement.query(By.css('a'))).toBeTruthy();
  });

  it('renders a replacement image after an earlier image failed', () => {
    setInputs({
      url: 'https://example.com',
      image: 'https://example.com/broken.png',
    });
    fixture.debugElement.query(By.css('img')).triggerEventHandler('error');
    fixture.detectChanges();

    setInputs({
      url: 'https://example.com',
      image: 'https://example.com/replacement.png',
    });

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toBe('https://example.com/replacement.png');
  });

  it('does not render an image element when no image input is given', () => {
    setInputs({ url: 'https://example.com' });
    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeNull();
  });

  it('opens the link in a new tab without opener access', () => {
    setInputs({ url: 'https://example.com' });
    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.target).toBe('_blank');
    expect(anchor.nativeElement.rel).toBe('noopener noreferrer');
  });
});
