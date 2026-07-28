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

## 2. Documentation

- **Self-Documenting Code:** Use descriptive variable and function names.
- **Inline Comments:** Only use comments to explain _why_ something is done, not _what_ is done (the code should explain the what).
- **READMEs:** Every new module or significant directory must have a brief README.

## 3. Git & Version Control

- **Conventional Commits:** Follow the conventional commit format (e.g., `feat:`, `fix:`, `chore:`, `refactor:`).
- **Atomic Commits:** Each commit should represent a single logical change.

## 4. Testing

- **Test-Driven:** Write unit tests for all business logic and edge cases.
- **Continuous Verification:** Ensure all tests pass locally before committing.

## 5. Agent Instructions

- **MANDATORY TESTING RULE:** For absolutely everything we do, we must build a test. Code should never be generated, modified, or considered complete without a corresponding test verifying its functionality.
- Whenever generating code or refactoring, ensure strict adherence to these rules without exception.
