---
name: my-style-guide
description: Universal coding style and best practices for all my projects
---

# Universal Style Guide

This skill enforces universal coding and project management best practices across all languages and frameworks.

## 1. Code Quality & Formatting

- **Clarity over Cleverness:** Write code that is easy to read and understand.
- **DRY & SOLID principles:** Ensure code is modular, reusable, and follows single-responsibility principles.
- **Strong Typing:** Always use strong static typing where available (e.g., TypeScript over JS).
- **No Deprecated Packages:** You must never pick npm packages that are deprecated, but still feel free to pick any tools or packages widely in use. Always verify dependencies before adding them.

- **Self-Documenting Code:** Use descriptive variable and function names.
- **Inline Comments:** Only use comments to explain _why_ something is done, not _what_ is done (the code should explain the what).
- **READMEs:** Every new module or significant directory must have a brief README.

## 3. Git & Version Control

- **Conventional Commits:** Follow the conventional commit format (e.g., `feat:`, `fix:`, `chore:`, `refactor:`).
- **Atomic Commits:** Each commit should represent a single logical change.

## 4. Testing

- **Test-Driven:** Write unit tests for all business logic and edge cases.
- **Continuous Verification:** Ensure all tests pass locally before committing.

## 5. Angular Modern Patterns (Non-Negotiable)

- **ZERO TOLERANCE for decorators:** NEVER `@Input()`, `@Output()`, `@ViewChild()`, `@ViewChildren()`, `@ContentChild()`, `@ContentChildren()`, `@HostBinding()`, `@HostListener()`. Use `input()`, `output()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`, and `host: {}` property.
- **ZERO TOLERANCE for legacy state:** NEVER `Subject` / `BehaviorSubject` for state (use `signal<T>()`). NEVER `.subscribe()` (use `toSignal()`, `resource()`, or `async` pipe). NEVER `setTimeout` / `setInterval` for data (use `resource()` with polling).
- **Mandatory signals:** ALL component inputs use `input.required<T>()` / `input<T>(default)`. ALL outputs use `output<T>()`. ALL async data uses `resource<T>()`. ALL template queries use `viewChild()` / `viewChildren()`.
- **Mandatory injection:** ALL dependencies use `inject()` function. NEVER constructor injection.
- **Mandatory standalone:** ALL components are standalone (default in v20+). NEVER `@NgModule`. NEVER `standalone: true` in decorator.
- **Mandatory control flow:** NEVER `*ngIf`/`*ngFor`/`*ngSwitch`. Use `@if`/`@for`/`@switch`.

## 6. Agent Instructions

- **MANDATORY TESTING RULE:** For absolutely everything we do, we must build a test. Code should never be generated, modified, or considered complete without a corresponding test verifying its functionality.
- Whenever generating code or refactoring, ensure strict adherence to these rules without exception.
