import os
import re
import json

def find_files(directory, extensions):
    matched_files = []
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or 'dist' in root or 'e2e' in root or 'cypress' in root:
            continue
        for file in files:
            if any(file.endswith(ext) for ext in extensions):
                matched_files.append(os.path.join(root, file))
    return matched_files

def load_en_keys(filepath):
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        keys = set()
        def extract_keys(obj, prefix=''):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    new_prefix = f"{prefix}.{k}" if prefix else k
                    extract_keys(v, new_prefix)
            else:
                keys.add(prefix)
        extract_keys(data)
        return keys
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return set()

en_keys = load_en_keys('frontend/src/assets/i18n/en.json')
en_keys_app = load_en_keys('frontend/src/app/i18n/en.json')
en_keys.update(en_keys_app)

files = find_files('frontend/src/app', ['.html', '.ts'])

missing_keys = set()
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

        # Find translated keys using t pipe
        matches = re.findall(r"\'([a-zA-Z0-9_\.]+)\'\s*\|\s*t", content)
        for match in matches:
            if match not in en_keys:
                missing_keys.add((file, match))

        # Also check for translate pipe
        matches_translate = re.findall(r"\'([a-zA-Z0-9_\.]+)\'\s*\|\s*translate", content)
        for match in matches_translate:
            if match not in en_keys:
                missing_keys.add((file, match))


hardcoded = []
html_files = find_files('frontend/src/app', ['.html'])

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        matches = re.finditer(r'>\s*([a-zA-Z0-9\s\,\.\!\?]+)\s*<', content)
        for match in matches:
            text = match.group(1).strip()
            if len(text) > 2 and '{{' not in text and '}}' not in text and 't }}' not in text:
                hardcoded.append((file, text))

def group_by_module(items):
    grouped = {}
    for item in items:
        file = item[0]
        # Extremely basic module grouping: extract the first directory inside app/
        parts = file.split('/')
        try:
            app_idx = parts.index('app')
            if app_idx + 1 < len(parts):
                module = parts[app_idx + 1]
                if module not in grouped:
                    grouped[module] = []
                grouped[module].append(item)
        except ValueError:
            pass
    return grouped

missing_grouped = group_by_module(missing_keys)
hardcoded_grouped = group_by_module(hardcoded)


import subprocess

def get_existing_issues():
    try:
        # Fetch open issues that contain "i18n-fix-module"
        result = subprocess.run(
            ["gh", "issue", "list", "--state", "open", "--search", "in:title i18n-fix-module", "--json", "title"],
            capture_output=True, text=True, check=True
        )
        issues = json.loads(result.stdout)
        return {issue["title"] for issue in issues}
    except Exception as e:
        print(f"Failed to fetch existing issues: {e}")
        return set()

existing_issues = get_existing_issues()
tasks_to_create = {}

def add_to_task(module, impact, desc, tech):
    title = f"Task: i18n-fix-module-{module}"
    content = f"* Priority: {impact}\n* Description: {desc}\n* Technical Implementation: {tech}"
    if title in tasks_to_create:
        tasks_to_create[title] += f"\n\n{content}"
    else:
        tasks_to_create[title] = content

for module, items in missing_grouped.items():
    desc = f"Missing keys used in UI but not found in en.json for module '{module}':\n"
    for file, key in list(items)[:10]: # Limit to prevent huge descriptions
        desc += f"  - `{key}` in {file}\n"
    if len(items) > 10:
        desc += f"  - ... and {len(items) - 10} more."

    tech = f"Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `{module}.component.element` structure."
    add_to_task(module, "High Impact", desc, tech)

for module, items in hardcoded_grouped.items():
    desc = f"Hardcoded English strings found in templates for module '{module}':\n"
    for file, text in list(items)[:10]:
        desc += f"  - '{text}' in {file}\n"
    if len(items) > 10:
        desc += f"  - ... and {len(items) - 10} more."

    tech = f"Replace hardcoded strings with translation keys (e.g. `{{{{ '{module}.keyName' | t }}}}`) and add the corresponding entries to `frontend/src/assets/i18n/en.json`."
    add_to_task(module, "Medium Impact", desc, tech)

for title, body in tasks_to_create.items():
    if title in existing_issues:
        print(f"Issue '{title}' already exists. Skipping.")
        continue
    print(f"Creating issue: {title}")
    try:
        subprocess.run(
            ["gh", "issue", "create", "--title", title, "--body", body, "--label", "factory-active"],
            check=True
        )
    except Exception as e:
        print(f"Failed to create issue '{title}': {e}")

print("Generated comprehensive module tasks as GitHub Issues.")
