import { Directive } from '@angular/core';
import { BrnTabsList } from '@spartan-ng/brain/tabs';

@Directive({
  selector: '[hlmTabsList],hlm-tabs-list',
  hostDirectives: [BrnTabsList],
  host: {
    'data-slot': 'tabs-list',
  },
})
export class HlmTabsList {}
