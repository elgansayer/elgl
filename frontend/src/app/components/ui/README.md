# Owned Spartan Helm layer

This directory contains the repository-owned Spartan Helm sources used by product code. Keep these files aligned with Spartan's generated APIs and Relay's semantic tokens.

Current generated/owned surface: Button, Dialog, Input, Textarea and shared Helm utilities.

Feature code should import through `@spartan-ng/helm/*` aliases, not deep relative paths into this directory.
