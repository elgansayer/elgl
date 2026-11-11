/** Trims strings and turns blank optional strings into undefined. */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function trimEachString({ value }: { value: unknown }): unknown {
  return Array.isArray(value)
    ? value.map((entry: unknown) =>
        typeof entry === 'string' ? entry.trim() : entry,
      )
    : value;
}
