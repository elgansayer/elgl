# Hourly Angular Signal Refactor

## Objective
Eliminate legacy Angular decorators and RxJS patterns in favor of modern Signals.

## Instructions
1. Search the frontend codebase for banned decorators: `@Input()`, `@Output()`, `@ViewChild()`, `@HostListener()`.
2. Search for banned lifecycle hooks: `ngOnChanges`, `ngOnInit` (for data loading).
3. Search for `.subscribe()` outside of async pipes.
4. Refactor all found instances into modern Angular Signal patterns (`input.required()`, `computed()`, `effect()`, `resource()`).
5. Ensure the verification build passes cleanly.
