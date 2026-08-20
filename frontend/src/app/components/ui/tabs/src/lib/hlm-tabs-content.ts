import { Directive, input } from '@angular/core';
import { BrnTabsContent } from '@spartan-ng/brain/tabs';

@Directive({
  selector: '[hlmTabsContent]',
  hostDirectives: [{ directive: BrnTabsContent, inputs: ['brnTabsContent: hlmTabsContent'] }],
  host: {
    'data-slot': 'tabs-content',
  },
})
export class HlmTabsContent {
  readonly contentFor = input.required<string>({ alias: 'hlmTabsContent' });
}
