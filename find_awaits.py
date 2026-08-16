import os
import re

for root, _, files in os.walk("backend/src"):
    for file in files:
        if file.endswith(".ts") and not file.endswith(".spec.ts"):
            path = os.path.join(root, file)
            with open(path, "r") as f:
                content = f.read()
            # Match loops that iterate over something and contain await
            matches = re.finditer(r'for\s*\([^{]+\)\s*\{([^}]*await[^}]*)\}', content)
            for m in matches:
                print(f"Found loop with await in {path}: {m.group(0)[:100].strip()}...")
