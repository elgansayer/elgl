export interface AppConfig {
  apiEndpoint: string;
  appName: string;
  version: string;
  environment: string;
  features?: {
    [key: string]: boolean;
  };
}
