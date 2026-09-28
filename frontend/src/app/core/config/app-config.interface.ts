export type MockBackendMode = 'disabled' | 'local' | 'test' | 'demo';

export interface AppConfig {
  apiEndpoint: string;
  appName: string;
  version: string;
  environment: string;
  mockBackendMode?: MockBackendMode;
  features?: {
    [key: string]: boolean;
  };
}
