import os
import sys

def fix_backend():
    path = "backend/src/common/pipes/sanitise-html.pipe.spec.ts"
    with open(path, "r") as f:
        content = f.read()
    
    conflict = """<<<<<<< HEAD
  // Strip all HTML tags completely
  return dirty
    .replace(/<[^>]*>/g, '')
=======
  // Remove script/style elements and their content entirely (DOMPurify strips them)
  let result = dirty
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>/gi, '')
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style\\s*>/gi, '');
  // Strip all remaining HTML tags
  result = result.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  result = result
>>>>>>> origin/main
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
<<<<<<< HEAD
    .replace(/&#x27;/g, "'");
=======
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
  return result;
>>>>>>> origin/main"""
    
    fixed = """  // Remove script/style elements and their content entirely (DOMPurify strips them)
  let result = dirty
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>/gi, '')
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style\\s*>/gi, '');
  // Strip all remaining HTML tags
  result = result.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
  return result;"""
    
    if conflict in content:
        content = content.replace(conflict, fixed)
        with open(path, "w") as f:
            f.write(content)
        print("Fixed backend spec")
    else:
        print("Conflict not found in backend spec")

fix_backend()
