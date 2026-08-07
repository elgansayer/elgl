import os

path = "frontend/src/app/pages/chat-settings/chat-settings.component.spec.ts"
with open(path, "r") as f:
    content = f.read()

def resolve(text):
    while "<<<<<<< HEAD" in text:
        start = text.find("<<<<<<< HEAD")
        mid = text.find("=======", start)
        end = text.find(">>>>>>> origin/main", mid)
        if start == -1 or mid == -1 or end == -1:
            break
        
        main_part = text[mid + 7:end].strip('\n')
        text = text[:start] + main_part + "\n" + text[end + 19:]
    return text

new_content = resolve(content)

with open(path, "w") as f:
    f.write(new_content)
