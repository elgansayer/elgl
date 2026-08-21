# Styling rules

Spartan Helm uses Tailwind and class-variance-authority. This repository layers its Relay semantic design system on top.

## Semantic colours only

Never introduce raw palette values when a semantic token exists. Prefer role-based background/foreground pairs and the repository's Relay semantic roles. New semantic roles must have light and dark parity.

## Prefer built-in variants

Use documented component `variant` and `size` APIs before restyling internals. If a product-wide visual contract must change, update the owned Helm implementation or shared token instead of scattering per-call-site overrides.

## Classes at call sites

Prefer call-site classes for layout and placement. Avoid overriding a component's internal colour, typography, padding, radius, or elevation when the shared Helm/Relay primitive should own that decision.

## Layout

- Prefer `gap-*` over `space-x-*` / `space-y-*`.
- Prefer `size-*` when width and height are equal.
- Prefer `truncate` over manually recreating truncation utilities.
- Follow the repository's mandatory logical RTL utilities (`ps`, `pe`, `ms`, `me`, `start`, `end`, `border-s`, `border-e`).

## Class merging

Use the project's Spartan `hlm()` / `classes()` utilities and established CVA patterns for owned Helm components. Do not hand-concatenate conflicting Tailwind class strings.

## Overlays

Let Spartan/Angular CDK own overlay stacking. Do not add arbitrary z-index values to dialogs, sheets, popovers, tooltips, dropdowns, or related overlay primitives.

## Project-specific precedence

`DESIGN.md`, Relay tokens, theme parity, per-user primary accent behaviour, accessibility, reduced motion, RTL, and translation requirements override generic examples from Spartan documentation.