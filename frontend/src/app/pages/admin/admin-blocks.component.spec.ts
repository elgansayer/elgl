import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminBlocksComponent } from './admin-blocks.component';
import { AdminService, AdminBlockEntry, AdminBlocksListResult } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('AdminBlocksComponent RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(resolve(__dirname, 'admin-blocks.component.html'), 'utf-8');
  });

  it('should not contain any physical direction CSS utilities', () => {
    const violations = [
      /\bpl-\d/,
      /\bpr-\d/,
      /\bml-\d/,
      /\bmr-\d/,
      /\bleft-[0-9]/,
      /\bright-[0-9]/,
      /\bborder-l\b/,
      /\bborder-r\b/,
      /\btext-left\b/,
      /\btext-right\b/,
    ];
    for (const pattern of violations) {
      expect(templateContent).not.toMatch(pattern);
    }
  });

  it('should use logical text alignment for table headers', () => {
    expect(templateContent).toContain('text-start');
  });

  it('should not hardcode English user-facing strings', () => {
    const withoutI18n = templateContent
      .replace(/\{\{.*?\}\}/gs, '')
      .replace(/'[^']*'\s*\|\s*t/g, '');
    expect(withoutI18n).not.toMatch(/Blocker/);
    expect(withoutI18n).not.toMatch(/Blocked/);
    expect(withoutI18n).not.toMatch(/Unblock/);
    expect(withoutI18n).not.toMatch(/Actions/);
  });
});

describe('AdminBlocksComponent', () => {
  let component: AdminBlocksComponent;
  let fixture: ComponentFixture<AdminBlocksComponent>;
  let listAllBlocksSpy: ReturnType<typeof vi.fn>;
  let removeBlockSpy: ReturnType<typeof vi.fn>;

  const mockBlocks: AdminBlockEntry[] = [
    {
      id: 'block-1',
      blocker_id: 'user-1',
      blocked_id: 'user-2',
      blocker_name: 'Ada',
      blocked_name: 'Bob',
      blocker_avatar: null,
      blocked_avatar: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'block-2',
      blocker_id: 'user-3',
      blocked_id: 'user-4',
      blocker_name: 'Charlie',
      blocked_name: null,
      blocker_avatar: 'https://example.com/charlie.png',
      blocked_avatar: null,
      created_at: '2026-06-01T00:00:00Z',
    },
  ];

  const mockI18nService = {
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    listAllBlocksSpy = vi.fn().mockResolvedValue({
      blocks: mockBlocks,
      total: 2,
      page: 1,
      pageSize: 20,
    } satisfies AdminBlocksListResult);
    removeBlockSpy = vi.fn().mockResolvedValue({ success: true });

    await TestBed.configureTestingModule({
      imports: [AdminBlocksComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: AdminService,
          useValue: {
            listAllBlocks: listAllBlocksSpy,
            removeBlock: removeBlockSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBlocksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('displays the title', () => {
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('admin.blocks.title');
  });

  it('renders block rows', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const firstRow = rows[0].textContent;
    expect(firstRow).toContain('Ada');
    expect(firstRow).toContain('Bob');
  });

  it('shows unknown for missing names', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[1].textContent).toContain('admin.blocks.unknown');
  });

  it('renders avatar images when present', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const imgs = fixture.nativeElement.querySelectorAll('tbody img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/charlie.png');
  });

  it('renders avatar fallback when no avatar_url', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const fallbacks = fixture.nativeElement.querySelectorAll('tbody .bg-surface-100');
    expect(fallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('calls removeBlock and removes the row on success', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('tbody button');
    expect(buttons.length).toBe(2);

    buttons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(removeBlockSpy).toHaveBeenCalledWith('block-1');

    const rowsAfter = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rowsAfter.length).toBe(1);
  });

  it('disables the remove button while removing', async () => {
    removeBlockSpy.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('tbody button');
    expect(button.disabled).toBe(false);

    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('navigates pages correctly', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const prevBtn = fixture.nativeElement.querySelectorAll('nav button')[0];
    const nextBtn = fixture.nativeElement.querySelectorAll('nav button')[1];

    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true);

    listAllBlocksSpy.mockResolvedValue({
      blocks: mockBlocks,
      total: 40,
      page: 1,
      pageSize: 20,
    });
  });
});
