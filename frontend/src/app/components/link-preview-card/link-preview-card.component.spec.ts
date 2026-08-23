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

  it('renders a normalised HTTP destination as the anchor href', () => {
    setInputs({ url: 'https://example.com/article' });
    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.href).toBe('https://example.com/article');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'mailto:test@example.com',
    'ftp://example.com/file',
    'https://user:password@example.com/private',
    'not a url',
  ])('does not render a card for an unsafe destination URL: %s', (url) => {
    setInputs({
      url,
      title: 'Unsafe preview',
    });

    expect(fixture.debugElement.query(By.css('a'))).toBeNull();
  });

  it('renders sanitised title, description, and site name as plain text', () => {
    setInputs({
      url: 'https://example.com',
      title: '<strong>Test Title</strong>',
      description: '<script>alert(1)</script>Test Description',
      siteName: '<span>Example Site</span>',
    });

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test Title');
    expect(el.textContent).toContain('Test Description');
    expect(el.textContent).toContain('Example Site');
    expect(el.querySelector('strong')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
  });

  it('bounds untrusted OpenGraph metadata before rendering', () => {
    setInputs({
      url: 'https://example.com',
      title: 't'.repeat(350),
      description: 'd'.repeat(1100),
      siteName: 's'.repeat(250),
    });

    expect(fixture.componentInstance.displayTitle()).toHaveLength(300);
    expect(fixture.componentInstance.displayDescription()).toHaveLength(1000);
    expect(fixture.componentInstance.displaySiteName()).toHaveLength(200);
  });

  it('falls back to the destination hostname when site name is unavailable', () => {
    setInputs({ url: 'https://news.example.com/story', siteName: '   ' });

    expect(fixture.componentInstance.displaySiteName()).toBe('news.example.com');
    expect(fixture.nativeElement.textContent).toContain('news.example.com');
  });

  it('does not duplicate query strings or fragments in the display address', () => {
    setInputs({
      url: 'https://example.com/path/to/article?secret=token#fragment',
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('example.com/path/to/article');
    expect(text).not.toContain('secret=token');
    expect(text).not.toContain('fragment');

    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.href).toBe(
      'https://example.com/path/to/article?secret=token#fragment',
    );
  });

  it('renders an image when a safe HTTP image URL is provided', () => {
    setInputs({
      url: 'https://example.com',
      image: 'https://example.com/img.png',
    });

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toBe('https://example.com/img.png');
    expect(img.nativeElement.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.nativeElement.getAttribute('decoding')).toBe('async');
  });

  it.each([
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/image.png',
    'https://user:password@example.com/image.png',
  ])('does not render an unsafe image URL: %s', (image) => {
    setInputs({
      url: 'https://example.com',
      image,
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
    expect(fixture.debugElement.query(By.css('img'))).toBeNull();
  });

  it('opens the link in a new tab without opener or referrer access', () => {
    setInputs({ url: 'https://example.com' });
    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.target).toBe('_blank');
    expect(anchor.nativeElement.rel).toBe('noopener noreferrer');
    expect(anchor.nativeElement.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('uses automatic direction for external metadata and LTR for the URL', () => {
    setInputs({
      url: 'https://example.com',
      title: 'مرحبا بالعالم',
      description: 'שלום עולם',
      siteName: 'مثال',
    });

    const autoDirection = fixture.debugElement.queryAll(By.css('[dir="auto"]'));
    const address = fixture.debugElement.query(By.css('[dir="ltr"]'));

    expect(autoDirection).toHaveLength(3);
    expect(address).toBeTruthy();
  });
});
