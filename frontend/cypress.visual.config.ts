import { defineConfig } from 'cypress';

export default defineConfig({
  screenshotsFolder: 'cypress/visual-artifacts',
  trashAssetsBeforeRuns: true,
  video: false,
  e2e: {
    baseUrl: 'http://127.0.0.1:4300',
    supportFile: false,
    specPattern: 'cypress/visual/**/*.cy.ts',
  },
});
