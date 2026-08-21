"""Secret-safe structured logging helpers."""

from __future__ import annotations

import re
from collections.abc import Mapping

SECRET_KEY = re.compile(r"(api[_-]?key|token|secret|password|authorization|cookie)", re.I)
BEARER = re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/-]+=*")
KEY_VALUE = re.compile(r"(?i)(api[_-]?key|token|secret|password)=([^\s&]+)")


def redact_text(value: str) -> str:
    value = BEARER.sub("Bearer [REDACTED]", value)
    return KEY_VALUE.sub(lambda match: f"{match.group(1)}=[REDACTED]", value)


def redact_mapping(value: Mapping[str, object]) -> dict[str, object]:
    redacted: dict[str, object] = {}
    for key, item in value.items():
        if SECRET_KEY.search(key):
            redacted[key] = "[REDACTED]"
        elif isinstance(item, str):
            redacted[key] = redact_text(item)
        elif isinstance(item, Mapping):
            redacted[key] = redact_mapping(item)
        else:
            redacted[key] = item
    return redacted
