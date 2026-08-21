import { Directive, input } from '@angular/core';
import { BrnTabsTrigger } from '@spartan-ng/brain/tabs';

@Directive({
  selector: '[hlmTabsTrigger]',
  hostDirectives: [
    {
      directive: BrnTabsTrigger,
      inputs: ['brnTabsTrigger: hlmTabsTrigger', 'disabled'],
    },
  ],
  host: {
    'data-slot': 'tabs-trigger',
  },
})
export class HlmTabsTrigger {
  readonly triggerFor = input.required<string>({ alias: 'hlmTabsTrigger' });
}
