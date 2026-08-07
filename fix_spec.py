import os
import sys

def fix_spec():
    path = "frontend/src/app/pages/chat-settings/chat-settings.component.spec.ts"
    with open(path, "r") as f:
        content = f.read()
    
    # Block 1
    c1 = """<<<<<<< HEAD
=======
    resetToDefaults: ReturnType<typeof vi.fn>;
>>>>>>> origin/main"""
    content = content.replace(c1, "    resetToDefaults: ReturnType<typeof vi.fn>;")

    # Block 2
    c2 = """<<<<<<< HEAD
=======
      resetToDefaults: vi.fn(),
>>>>>>> origin/main"""
    content = content.replace(c2, "      resetToDefaults: vi.fn(),")

    # Block 3
    c3 = """<<<<<<< HEAD
  it('should call loadSettings on init', () => {
    expect(mockService.loadSettings).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(mockService.loadSettings).toHaveBeenCalledTimes(1);
  });

=======
  it('should call loadSettings on construction', () => {
    expect(mockService.loadSettings).toHaveBeenCalledTimes(1);
  });

  it('should not call loadSettings more than once on detectChanges', () => {
    mockService.loadSettings.mockClear();
    fixture.detectChanges();
    expect(mockService.loadSettings).not.toHaveBeenCalled();
  });

>>>>>>> origin/main"""
    r3 = """  it('should call loadSettings on construction', () => {
    expect(mockService.loadSettings).toHaveBeenCalledTimes(1);
  });

  it('should not call loadSettings more than once on detectChanges', () => {
    mockService.loadSettings.mockClear();
    fixture.detectChanges();
    expect(mockService.loadSettings).not.toHaveBeenCalled();
  });
"""
    content = content.replace(c3, r3)

    # Block 4
    c4 = """<<<<<<< HEAD
});
=======

  it('should display description subtitles', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('chat_settings.auto_translate_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.read_receipts_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.enter_to_send_desc');
  });

  it('should render a reset to defaults button', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    expect(resetBtn).toBeTruthy();
    expect(resetBtn.textContent).toContain('chat_settings.reset_defaults');
  });

  it('should call resetToDefaults on service when reset button clicked', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    resetBtn.click();
    expect(mockService.resetToDefaults).toHaveBeenCalledTimes(1);
  });
});
>>>>>>> origin/main"""
    r4 = """
  it('should display description subtitles', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('chat_settings.auto_translate_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.read_receipts_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.enter_to_send_desc');
  });

  it('should render a reset to defaults button', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    expect(resetBtn).toBeTruthy();
    expect(resetBtn.textContent).toContain('chat_settings.reset_defaults');
  });

  it('should call resetToDefaults on service when reset button clicked', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    resetBtn.click();
    expect(mockService.resetToDefaults).toHaveBeenCalledTimes(1);
  });
});
"""
    content = content.replace(c4, r4.strip('\n'))

    with open(path, "w") as f:
        f.write(content)

fix_spec()
