import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunitiesComponent } from './communities.component';
import {
  CommunitiesService,
  Community,
  CreateCommunityPayload,
} from '../../services/communities.service';
import { I18nService } from '../../services/i18n.service';

const community: Community = {
  id: 'community-1',
  name: 'Spanish learners',
  description: 'Weekly conversation practice',
  owner_id: 'owner-1',
  created_at: '2026-08-19T00:00:00.000Z',
};

class MockCommunitiesService {
  listMine(): Promise<Community[]> {
    return Promise.resolve([community]);
  }

  create(payload: CreateCommunityPayload): Promise<Community> {
    return Promise.resolve({ ...community, ...payload });
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }
}

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

describe('CommunitiesComponent', () => {
  let fixture: ComponentFixture<CommunitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunitiesComponent],
      providers: [
        { provide: CommunitiesService, useClass: MockCommunitiesService },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunitiesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('uses Relay semantic surfaces, radius and elevation roles', () => {
    const page: HTMLElement = fixture.nativeElement.querySelector('main');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const card: HTMLLIElement = fixture.nativeElement.querySelector('ul li');

    expect([...page.classList]).toEqual(expect.arrayContaining(['bg-surface-500']));
    expect([...form.classList]).toEqual(
      expect.arrayContaining([
        'bg-surface-200',
        'border-surface-100',
        'rounded-card',
        'shadow-card',
      ]),
    );
    expect([...card.classList]).toEqual(
      expect.arrayContaining([
        'bg-surface-200',
        'border-surface-100',
        'rounded-card',
        'shadow-card',
      ]),
    );
    expect(fixture.nativeElement.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:black|white|slate|gray|red|blue|green|amber|purple|pink)(?:-|\b)/,
    );
  });

  it('exposes a named main landmark', () => {
    const main: HTMLElement = fixture.nativeElement.querySelector('main');
    const title: HTMLHeadingElement = fixture.nativeElement.querySelector('#communities-title');

    expect(main.getAttribute('aria-labelledby')).toBe('communities-title');
    expect(title.textContent).toContain('communities.title');
  });

  it('gives both inputs persistent translated labels without overriding Spartan focus treatment', () => {
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('input[name="name"]');
    const descriptionInput: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[name="description"]',
    );
    const nameLabel = nameInput.closest('label');
    const descriptionLabel = descriptionInput.closest('label');

    expect(nameLabel).toBeTruthy();
    expect(descriptionLabel).toBeTruthy();
    expect(nameLabel?.textContent).toContain('communities.nameLabel');
    expect(descriptionLabel?.textContent).toContain('communities.descriptionLabel');
    expect(nameLabel?.querySelector('.sr-only')).toBeTruthy();
    expect(descriptionLabel?.querySelector('.sr-only')).toBeTruthy();
    expect(nameInput.required).toBe(true);
    expect(nameInput.className).not.toContain('focus:outline-none');
    expect(descriptionInput.className).not.toContain('focus:outline-none');

    nameInput.focus();
    expect(document.activeElement).toBe(nameInput);
    descriptionInput.focus();
    expect(document.activeElement).toBe(descriptionInput);
  });

  it('keeps create and delete actions native, touch-sized and keyboard focusable', () => {
    const createButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    const deleteButton: HTMLButtonElement = fixture.nativeElement.querySelector('ul button');

    expect(createButton.getAttribute('size')).toBe('touch');
    expect(deleteButton.type).toBe('button');
    expect(deleteButton.getAttribute('size')).toBe('touch');
    expect(createButton.hasAttribute('role')).toBe(false);
    expect(deleteButton.hasAttribute('role')).toBe(false);
    expect(createButton.hasAttribute('tabindex')).toBe(false);
    expect(deleteButton.hasAttribute('tabindex')).toBe(false);

    createButton.focus();
    expect(document.activeElement).toBe(createButton);
    deleteButton.focus();
    expect(document.activeElement).toBe(deleteButton);
  });

  it('gives repeated delete actions contextual screen-reader naming', () => {
    const deleteButton: HTMLButtonElement = fixture.nativeElement.querySelector('ul button');
    const hiddenContext: HTMLSpanElement = deleteButton.querySelector('.sr-only')!;

    expect(deleteButton.textContent).toContain('communities.delete');
    expect(hiddenContext.textContent).toContain(community.name);
  });

  it('uses a mobile-first layout with tablet and desktop refinements', () => {
    const page: HTMLElement = fixture.nativeElement.querySelector('main');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const list: HTMLUListElement = fixture.nativeElement.querySelector('ul');
    const createButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    const deleteButton: HTMLButtonElement = fixture.nativeElement.querySelector('ul button');

    expect([...page.classList]).toEqual(
      expect.arrayContaining(['px-4', 'py-6', 'sm:px-6', 'sm:py-8', 'lg:px-8', 'lg:py-10']),
    );
    expect([...form.classList]).toEqual(
      expect.arrayContaining(['grid', 'md:grid-cols-2', 'lg:items-end']),
    );
    expect([...list.classList]).toEqual(expect.arrayContaining(['grid', 'md:grid-cols-2']));
    expect([...createButton.classList]).toEqual(expect.arrayContaining(['w-full', 'lg:w-auto']));
    expect([...deleteButton.classList]).toEqual(expect.arrayContaining(['w-full', 'sm:w-auto']));
  });

  it('uses fluid wrapping primitives that preserve required content at high zoom', () => {
    const section: HTMLElement = fixture.nativeElement.querySelector('main > section');
    const card: HTMLLIElement = fixture.nativeElement.querySelector('ul li');
    const name: HTMLSpanElement = fixture.nativeElement.querySelector('ul li span.font-semibold');
    const description: HTMLParagraphElement = fixture.nativeElement.querySelector('ul li p');
    const inputs: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('form input');

    expect([...section.classList]).toEqual(expect.arrayContaining(['w-full', 'max-w-5xl']));
    expect(card.classList).toContain('min-w-0');
    expect(name.classList).toContain('min-w-0');
    expect(name.classList).toContain('break-words');
    expect(description.classList).toContain('break-words');
    inputs.forEach((input) => {
      expect(input.classList).toContain('min-w-0');
      expect(input.classList).toContain('w-full');
    });
  });

  it('keeps directional styling RTL-safe', () => {
    const componentHtml = fixture.nativeElement.innerHTML;

    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bleft-\d/);
    expect(componentHtml).not.toMatch(/\bright-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });
});