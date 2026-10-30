/**
 * Stable NestJS configuration-validation entry point.
 *
 * The implementation lives beside the Joi schema so startup, tests and
 * operational tooling all use one validation pipeline.
 */
export {
  PRODUCTION_REQUIRED_ENV_KEYS,
  validateEnvironment,
} from './environment.validation';
