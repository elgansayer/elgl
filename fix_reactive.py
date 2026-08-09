with open('frontend/src/app/features/settings/components/profile-settings/profile-settings.component.ts', 'r') as f:
    content = f.read()

import re

# We will change the constructor effect to ngOnInit initial patch, and add debounceTime to valueChanges
# 1. Add debounceTime import
if "debounceTime" not in content:
    content = content.replace("import { FormBuilder", "import { debounceTime } from 'rxjs';\nimport { FormBuilder")

# 2. Extract effect contents to a method initializeForm
effect_content_match = re.search(r'effect\(\(\) => \{(.*?)\}\);', content, re.DOTALL)
if effect_content_match:
    effect_content = effect_content_match.group(1)

    # modify effect to just initialization
    new_init = f"""
  ngOnInit() {{
    const data = this.settingsService.profileSettings();
    if (data) {{
      this.profileForm.patchValue({{
        bio: data.bio,
        nativeLanguage: data.nativeLanguage,
        displayKana: data.displayKana,
        ageFilter: data.ageFilter,
        matchingPreferences: data.matchingPreferences
      }}, {{ emitEvent: false }});

      this.distanceRadius.set(data.distanceRadiusKm);

      // Clear and rebuild array
      while (this.targetLanguages.length !== 0) {{
        this.targetLanguages.removeAt(0);
      }}

      data.targetLanguages.forEach(lang => {{
        this.targetLanguages.push(this.fb.group({{
          language: [lang.language, Validators.required],
          level: [lang.level, Validators.required],
          jlptLevel: [lang.jlptLevel]
        }}));
      }});
    }}

    this.profileForm.valueChanges.pipe(debounceTime(500)).subscribe(() => {{
      if (this.profileForm.valid) {{
        this.persist();
      }}
    }});
  }}
"""
    # Replace ngOnInit entirely
    content = re.sub(r'ngOnInit\(\) \{.*?\}\}', new_init, content, flags=re.DOTALL)

    # Remove effect entirely from constructor
    content = re.sub(r'effect\(\(\) => \{.*?\}\);', '', content, flags=re.DOTALL)

with open('frontend/src/app/features/settings/components/profile-settings/profile-settings.component.ts', 'w') as f:
    f.write(content)
