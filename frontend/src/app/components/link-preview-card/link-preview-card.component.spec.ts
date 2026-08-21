import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkPreviewCardComponent } from './link-preview-card.component';
import { By } from '@angular/platform-browser';

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
  }) {
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

  it('does not render an image element when no image input is given', () => {
    setInputs({ url: 'https://example.com' });
    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeNull();
  });

  it('opens the link in a new tab', () => {
    setInputs({ url: 'https://example.com' });
    const anchor = fixture.debugElement.query(By.css('a'));
    expect(anchor.nativeElement.target).toBe('_blank');
    expect(anchor.nativeElement.rel).toBe('noopener noreferrer');
  });
});