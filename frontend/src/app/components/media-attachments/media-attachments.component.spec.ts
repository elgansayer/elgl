import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { MediaAttachmentsComponent, MultiMediaMessage } from './media-attachments.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('MediaAttachmentsComponent', () => {
  let component: MediaAttachmentsComponent;
  let fixture: ComponentFixture<MediaAttachmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaAttachmentsComponent],
    })
      .overrideComponent(MediaAttachmentsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MediaAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('message', { text: 'hello' } satisfies MultiMediaMessage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render text only', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('hello');
  });

  it('should render images grid', () => {
    fixture.componentRef.setInput('message', {
      images: ['a.jpg', 'b.jpg'],
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs.length).toBe(2);
  });
});
