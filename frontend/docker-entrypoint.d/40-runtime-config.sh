#!/bin/sh
set -eu

required_variables='PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY PUBLIC_CENTRIFUGO_URL PUBLIC_LIVEKIT_URL'

for variable_name in $required_variables; do
  eval "variable_value=\${$variable_name:-}"
  if [ -z "$variable_value" ]; then
    echo "Missing required production variable: $variable_name" >&2
    exit 1
  fi
  case "$variable_value" in
    *'"'*|*'\'*)
      echo "Invalid character in production variable: $variable_name" >&2
      exit 1
      ;;
  esac
done

envsubst '${PUBLIC_SUPABASE_URL} ${PUBLIC_SUPABASE_ANON_KEY} ${PUBLIC_CENTRIFUGO_URL} ${PUBLIC_LIVEKIT_URL}' \
  < /opt/hellotalk/runtime-config.js.template \
  > /usr/share/nginx/html/runtime-config.js
