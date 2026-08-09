# Hourly NestJS DTO Validation Check

## Objective
Ensure robust API security by strictly validating all incoming requests.

## Instructions
1. Review all modified or newly created NestJS Controllers (`backend/src/**/*.controller.ts`).
2. Verify that every endpoint accepting a payload utilizes a typed DTO class.
3. Ensure every property in the DTO uses `class-validator` decorators (e.g., `@IsString()`, `@IsUUID()`, `@IsOptional()`).
4. Ensure the `ValidationPipe` is correctly stripping unknown properties from incoming requests.
