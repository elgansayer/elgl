#!/bin/bash

mkdir -p .tasks

current_file=""
is_writing=0

while IFS= read -r line || [ -n "$line" ]; do
    # Strip invisible carriage returns
    line=$(echo "$line" | tr -d '\r')

    # Look for anything resembling a .tasks/ filename anywhere in the line
    if [[ "$line" =~ \.tasks/([a-zA-Z0-9_-]+\.md) ]]; then
        current_file=".tasks/${BASH_REMATCH[1]}"
        is_writing=0
        continue
    fi

    # Toggle writing when encountering triple backticks
    if [[ "$line" == \`\`\`* ]] && [[ -n "$current_file" ]]; then
        if [[ $is_writing -eq 0 ]]; then
            is_writing=1
            > "$current_file"
            echo "Created: $current_file"
        else
            is_writing=0
            current_file=""
        fi
        continue
    fi

    # Write to the file if we are inside a block
    if [[ $is_writing -eq 1 ]]; then
        echo "$line" >> "$current_file"
    fi

done < raw_tasks.txt

echo "Extraction complete."