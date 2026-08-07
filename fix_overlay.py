import os
import sys

def fix_overlay():
    path = "frontend/src/app/components/live-chat-overlay/live-chat-overlay.component.spec.ts"
    with open(path, "r") as f:
        content = f.read()
    
    conflict_start = "<<<<<<< HEAD"
    conflict_mid = "======="
    conflict_end = ">>>>>>> origin/main"
    
    if conflict_start in content:
        start_idx = content.find(conflict_start)
        end_idx = content.find(conflict_end) + len(conflict_end)
        
        mid_idx = content.find(conflict_mid, start_idx)
        
        main_content = content[mid_idx + len(conflict_mid):content.find(conflict_end, mid_idx)].strip('\n')
        
        new_content = content[:start_idx] + main_content + content[end_idx:]
        with open(path, "w") as f:
            f.write(new_content)
            
fix_overlay()
