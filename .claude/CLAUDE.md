# HelloTalk Project Instructions for Claude

## Design System

This project has a `DESIGN.md` at the repo root. Use it for design context.

## Open CoDesign (Local Desktop Tool)

Open CoDesign v0.2.1 is installed at `~/.local/bin/open-codesign`.
Launch it to generate prototypes and UI mockups locally with your own API key.
It reads `DESIGN.md` from the project root for brand tokens and component primitives.

## Claude Design (Web)

When working on UI changes, run `/design-sync` to pull the latest design system into Claude Design.
Use `/design` to prototype new components and pages before implementing them.

## Claude Code Integration

- `@design` — reference the DESIGN.md for visual context
- The project uses Angular v22 (standalone, signals, control flow) and NestJS
- See `AGENTS.md` for the full engineering constitution

## Key Files

- `DESIGN.md` — design system tokens and guidelines
- `AGENTS.md` — engineering standards and conventions
- `specs/` — feature specifications
- `original-hello-talk-screenshots/` — reference screenshots for visual parity

## Frontend Stack

- Angular v22+, Tailwind CSS v3
- No NgModules — all standalone components
- No decorator Input/Output — use signal input()/output()
- No *ngIf/*ngFor — use @if/@for control flow
- No hardcoded strings — use TranslatePipe (`| t`)
- No physical direction CSS — use logical properties (ps/pe/ms/me)
