import { GENERATED_APP_VERSION, GENERATED_BUILD_NUMBER } from './generated/build-info.generated';

/** The current application version as deployed to the stores. */
export const APP_VERSION = GENERATED_APP_VERSION;

/** Build metadata generated from CI run and commit information. */
export const BUILD_NUMBER = GENERATED_BUILD_NUMBER;

/** Versions lower than this are considered deprecated and will be blocked. */
export const MIN_SUPPORTED_VERSION = '2.0.0';
