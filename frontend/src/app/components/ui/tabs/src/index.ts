import { HlmTabs } from './lib/hlm-tabs';
import { HlmTabsContent } from './lib/hlm-tabs-content';
import { HlmTabsList } from './lib/hlm-tabs-list';
import { HlmTabsTrigger } from './lib/hlm-tabs-trigger';

export * from './lib/hlm-tabs';
export * from './lib/hlm-tabs-content';
export * from './lib/hlm-tabs-list';
export * from './lib/hlm-tabs-trigger';

export const HlmTabsImports = [HlmTabs, HlmTabsList, HlmTabsTrigger, HlmTabsContent] as const;
