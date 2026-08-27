import os
import re
import json
import subprocess
import shutil

WIKI_DIR = os.environ.get("WIKI_DIR", "hellotalk.wiki")
os.makedirs(WIKI_DIR, exist_ok=True)

print("Fetching ALL GitHub issues (open and closed)...")
try:
    result = subprocess.run(
        ['gh', 'issue', 'list', '--state', 'all', '--limit', '5000', '--json', 'number,title,state,labels'],
        capture_output=True, text=True, check=True
    )
    all_issues = json.loads(result.stdout)
except Exception as e:
    print(f"Failed to fetch issues: {e}")
    all_issues = []

# Build exhaustive feature list from issues
features_from_issues = {}
for issue in all_issues:
    state = issue.get('state', 'UNKNOWN')
    title = issue.get('title', '')
    number = issue.get('number', '')
    if state not in features_from_issues:
        features_from_issues[state] = []
    features_from_issues[state].append(f"- [#{number}] {title}")

# Parse codebase for granular method-level details
def get_ts_files(root_dir):
    ts_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or 'dist' in dirpath:
            continue
        for f in filenames:
            if f.endswith('.ts') and not f.endswith('.spec.ts'):
                ts_files.append(os.path.join(dirpath, f))
    return ts_files

def extract_granular_details(filepath):
    details = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find classes
            classes = re.findall(r'export\s+class\s+([a-zA-Z0-9_]+)', content)
            if classes:
                details.append(f"**Classes**: {', '.join(classes)}")
            # Find methods
            methods = re.findall(r'^\s*(?:public\s+|private\s+|protected\s+|async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[a-zA-Z0-9_<>, \[\]|]+)?\s*\{', content, re.MULTILINE)
            methods = [m for m in methods if m not in ['constructor', 'if', 'switch', 'for', 'catch']]
            if methods:
                details.append(f"**Methods**: {', '.join(methods)}")
    except:
        pass
    return details

frontend_files = get_ts_files(os.environ.get("FRONTEND_DIR", "frontend/src"))
backend_files = get_ts_files(os.environ.get("BACKEND_DIR", "backend/src"))

with open(os.path.join(WIKI_DIR, 'Exhaustive-Minute-Feature-List.md'), 'w', encoding='utf-8') as f:
    f.write("# Exhaustive Minute Feature List\n\n")
    f.write("This document is an aggressively comprehensive scan of every single minute feature, task, and bugfix from the entire history of the project, combined with every single method deployed in the codebase.\n\n")
    
    f.write("## 1. Feature History (From GitHub Issues)\n\n")
    for state, items in features_from_issues.items():
        f.write(f"### {state} Features / Tasks\n")
        for item in items:
            f.write(item + "\n")
        f.write("\n")
        
    f.write("## 2. Granular Codebase Feature Implementations\n\n")
    
    f.write("### Backend (NestJS)\n")
    for filepath in backend_files:
        details = extract_granular_details(filepath)
        if details:
            clean_path = filepath
            f.write(f"#### `{clean_path}`\n")
            for d in details:
                f.write(f"- {d}\n")
            f.write("\n")
            
    f.write("### Frontend (Angular)\n")
    for filepath in frontend_files:
        details = extract_granular_details(filepath)
        if details:
            clean_path = filepath
            f.write(f"#### `{clean_path}`\n")
            for d in details:
                f.write(f"- {d}\n")
            f.write("\n")

# Copy the previous wiki files as well
source_wiki = os.environ.get("WIKI_SOURCE_DIR", "wiki")
if os.path.exists(source_wiki):
    for filename in os.listdir(source_wiki):
        src_path = os.path.join(source_wiki, filename)
        dst_path = os.path.join(WIKI_DIR, filename)
        if os.path.isfile(src_path):
            shutil.copy(src_path, dst_path)

# Update Wiki Sidebar
with open(os.path.join(WIKI_DIR, '_Sidebar.md'), 'w', encoding='utf-8') as f:
    f.write("- [Home](Home)\n")
    f.write("- [Exhaustive Minute Feature List](Exhaustive-Minute-Feature-List)\n")
    f.write("- [Features](Features)\n")
    f.write("- [Codebase Reference](Codebase_Reference)\n")
    f.write("- [Issues Backlog](Issues_Backlog)\n")

print("Done building granular wiki!")
