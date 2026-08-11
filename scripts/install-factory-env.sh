#!/usr/bin/env bash
set -euo pipefail

TARGET=/etc/hellotalk-factory/factory.env
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE=${1:-"$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)/.env"}

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command as root.' >&2
  exit 1
fi
if [ ! -r "$SOURCE" ]; then
  echo "Cannot read source environment file: $SOURCE" >&2
  exit 1
fi

target_dir=$(dirname "$TARGET")
mkdir -p "$target_dir"
if [ -e "$TARGET" ] && [ ! -r "$TARGET" ]; then
  echo "Cannot read existing factory environment: $TARGET" >&2
  exit 1
fi
if [ ! -e "$TARGET" ]; then
  install -o root -g hellotalk-factory -m 0640 /dev/null "$TARGET"
fi

temporary=$(mktemp "$target_dir/.factory.env.XXXXXX")
trap 'rm -f "$temporary"' EXIT
umask 077

awk -v source="$SOURCE" '
  function is_factory_key(key) {
    return key ~ /^(OPENHANDS_OPENAI_MODEL$|OPENCODE_GO_|GEMINI_|GITHUB_TOKEN$|GITHUB_REPOSITORY$|TELEGRAM_)/
  }
  BEGIN {
    while ((getline line < source) > 0) {
      key = line
      sub(/^[[:space:]]*/, "", key)
      sub(/[[:space:]]*=.*$/, "", key)
      if (is_factory_key(key) && line ~ /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]/) {
        source_line[key] = line
        source_order[++source_count] = key
      }
    }
    close(source)
  }
  {
    key = $0
    sub(/^[[:space:]]*/, "", key)
    sub(/[[:space:]]*=.*$/, "", key)
    if (key in source_line) {
      print source_line[key]
      delete source_line[key]
      next
    }
    print
  }
  END {
    for (position = 1; position <= source_count; position++) {
      key = source_order[position]
      if (key in source_line) {
        print source_line[key]
        delete source_line[key]
      }
    }
  }
' "$TARGET" "$SOURCE" > "$temporary"

chown root:hellotalk-factory "$temporary"
chmod 0640 "$temporary"
mv -f "$temporary" "$TARGET"
trap - EXIT
echo "Factory environment updated from $SOURCE without printing secret values."
