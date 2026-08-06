import os
import re
import json
import subprocess

WIKI_DIR = "wiki"
os.makedirs(WIKI_DIR, exist_ok=True)

# 1. Parse all methods and files
def get_ts_files(root_dir):
    ts_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or 'dist' in dirpath:
            continue
        for f in filenames:
            if f.endswith('.ts') and not f.endswith('.spec.ts'):
                ts_files.append(os.path.join(dirpath, f))
    return ts_files

def extract_methods(filepath):
    methods = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Simple regex to catch method signatures in classes
            # Matches: async name(args) { or name(args): type {
            pattern = re.compile(r'^\s*(?:public\s+|private\s+|protected\s+|async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[a-zA-Z0-9_<>, \[\]|]+)?\s*\{', re.MULTILINE)
            for match in pattern.finditer(content):
                method_name = match.group(1)
                if method_name not in ['constructor', 'if', 'switch', 'for', 'catch']:
                    methods.append(method_name)
    except:
        pass
    return methods

print("Scanning frontend and backend codebases...")
frontend_files = get_ts_files('frontend/src')
backend_files = get_ts_files('backend/src')

with open(os.path.join(WIKI_DIR, 'Codebase_Reference.md'), 'w', encoding='utf-8') as f:
    f.write("# Codebase Reference\n\n")
    f.write("This document contains an exhaustive list of files and methods in the codebase.\n\n")
    
    f.write("## Backend (NestJS)\n")
    for filepath in backend_files:
        methods = extract_methods(filepath)
        f.write(f"### `{filepath}`\n")
        if methods:
            f.write("- Methods: `" + "`, `".join(methods) + "`\n")
        else:
            f.write("- *(No methods found or interface/type definition)*\n")
        f.write("\n")
        
    f.write("## Frontend (Angular)\n")
    for filepath in frontend_files:
        methods = extract_methods(filepath)
        f.write(f"### `{filepath}`\n")
        if methods:
            f.write("- Methods: `" + "`, `".join(methods) + "`\n")
        else:
            f.write("- *(No methods found or interface/type definition)*\n")
        f.write("\n")

# 2. Fetch all GitHub issues
print("Fetching GitHub issues...")
try:
    result = subprocess.run(
        ['gh', 'issue', 'list', '--state', 'open', '--limit', '1000', '--json', 'number,title,labels'],
        capture_output=True, text=True, check=True
    )
    issues = json.loads(result.stdout)
except Exception as e:
    print(f"Failed to fetch issues: {e}")
    issues = []

with open(os.path.join(WIKI_DIR, 'Issues_Backlog.md'), 'w', encoding='utf-8') as f:
    f.write("# GitHub Issues Backlog\n\n")
    f.write(f"Total open issues: {len(issues)}\n\n")
    
    for issue in issues:
        labels = [l['name'] for l in issue.get('labels', [])]
        label_str = f" [{', '.join(labels)}]" if labels else ""
        f.write(f"- **#{issue['number']}**: {issue['title']}{label_str}\n")

# 3. Create Feature List from FEATURES_SPEC.md
print("Copying and formatting Feature list...")
try:
    with open('FEATURES_SPEC.md', 'r', encoding='utf-8') as f:
        features = f.read()
    with open(os.path.join(WIKI_DIR, 'Features.md'), 'w', encoding='utf-8') as f:
        f.write(features)
except Exception as e:
    print(f"Failed to copy features: {e}")

# 4. Generate Home wiki page
with open(os.path.join(WIKI_DIR, 'Home.md'), 'w', encoding='utf-8') as f:
    f.write("# HelloTalk AI Clone Wiki\n\n")
    f.write("Welcome to the comprehensive documentation for the HelloTalk AI Clone.\n\n")
    f.write("## Navigation\n")
    f.write("- [Features List](Features.md): Exhaustive overview of all app features.\n")
    f.write("- [Codebase Reference](Codebase_Reference.md): Automatically generated index of every file and method.\n")
    f.write("- [Issues Backlog](Issues_Backlog.md): Overview of all pending tasks from GitHub.\n")

print("Done generating Wiki!")
