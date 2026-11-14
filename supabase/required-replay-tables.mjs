// Tables a clean replay of supabase/migrations must create.
//
// Every table in this list is queried by mounted NestJS code. A replay that
// silently omits one produces a database the API cannot serve, so
// scripts/prepare-supabase-clean-replay.mjs fails before writing a replay when
// any listed table is absent from the replay corpus.
export const requiredReplayTables = [
  'communities',
  'groups',
  'group_members',
  'group_announcements',
  'group_resources',
];

const CREATE_TABLE_PATTERN =
  /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi;

export function createdTableNames(sqlSources) {
  const names = new Set();
  for (const source of sqlSources) {
    const withoutComments = String(source)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--.*$/gm, ' ');
    for (const match of withoutComments.matchAll(CREATE_TABLE_PATTERN)) {
      names.add(match[1].toLowerCase());
    }
  }
  return names;
}

export function missingRequiredReplayTables(sqlSources) {
  const created = createdTableNames(sqlSources);
  return requiredReplayTables.filter((table) => !created.has(table));
}
