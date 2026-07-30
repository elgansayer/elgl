Convert any remaining @Module or @NgModule usage in the frontend to strictly use standalone components.

The AI recently introduced a `@Module({` when it should have been using standalone components.
- Audit the frontend codebase for any occurrences of `@Module` or `@NgModule`.
- Remove them and replace them with standalone component imports.
- Make sure to follow the new rules in `AGENTS.md` strictly prohibiting both decorators.
