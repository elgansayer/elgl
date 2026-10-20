"""Three-way reconciliation for operator-owned Factory provider configuration."""

from __future__ import annotations

import argparse
import copy
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from openhands_factory.config import AgentsConfig

_MISSING = object()


def _clone(value: object) -> object:
    if value is _MISSING:
        return _MISSING
    return copy.deepcopy(value)


def _merge_value(base: object, local: object, desired: object) -> object:
    """Apply repository changes while preserving explicit local overrides."""
    if local == base:
        return _clone(desired)
    if desired == base:
        return _clone(local)

    if isinstance(base, Mapping) and isinstance(local, Mapping) and isinstance(desired, Mapping):
        merged: dict[str, object] = {}
        keys = list(desired)
        keys.extend(key for key in local if key not in desired)
        keys.extend(key for key in base if key not in desired and key not in local)
        for key in keys:
            value = _merge_value(
                base.get(key, _MISSING),
                local.get(key, _MISSING),
                desired.get(key, _MISSING),
            )
            if value is not _MISSING:
                merged[key] = value
        return merged

    return _clone(local)


def reconcile_agents_config(
    base: Mapping[str, Any],
    local: Mapping[str, Any],
    desired: Mapping[str, Any],
) -> dict[str, Any]:
    """Return desired policy plus operator changes made relative to the old policy."""
    merged = _merge_value(base, local, desired)
    if not isinstance(merged, dict):
        raise ValueError("reconciled provider configuration must be an object")
    AgentsConfig.model_validate(merged)
    return merged


def _load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"provider configuration must be an object: {path}")
    return value


def reconcile_files(
    base_path: Path, local_path: Path, desired_path: Path, output_path: Path
) -> None:
    merged = reconcile_agents_config(
        _load_object(base_path),
        _load_object(local_path),
        _load_object(desired_path),
    )
    output_path.write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reconcile canonical Factory provider policy with operator overrides."
    )
    parser.add_argument("base", type=Path)
    parser.add_argument("local", type=Path)
    parser.add_argument("desired", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    reconcile_files(args.base, args.local, args.desired, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
