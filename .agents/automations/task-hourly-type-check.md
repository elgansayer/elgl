# Hourly Strict Type Safety Check

## Objective
Enforce the project's strict type safety and zero `any` policy.

## Instructions
1. Run TypeScript compilation checks (`tsc --noEmit`) in both `frontend/` and `backend/`.
2. Locate any usage of the `any` type or unsafe type assertions (`as Type`) introduced in the last hour.
3. Replace them with strict interfaces, `unknown` type narrowing, or Zod schema validation.
4. If testing mocks require type assertions, ensure they are strictly confined to `*.spec.ts` files.
