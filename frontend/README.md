# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

The production build deliberately leaves external font CSS uninlined. This keeps builds deterministic when
the Google Fonts endpoint is unavailable; browsers retain the platform-font fallback declared in
`tailwind.config.js` if the optional display font cannot be loaded at runtime.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

End-to-end tests use [Cypress](https://docs.cypress.io/), a development dependency of this package. It is configured in `cypress.config.ts` (base URL `http://localhost:4200`, specs in `cypress/e2e/**/*.cy.ts`). `ng e2e` is not available because no Angular e2e builder is registered.

```bash
npm start                      # in one terminal: serve the app on port 4200
npm run cypress:open           # interactive runner
npm run e2e                    # headless run of every spec against the running app
npm run e2e:ci                 # start the app, wait for port 4200, then run the specs
npm run check:cypress-types    # type-check the Cypress support files and specs
```

See [`docs/CYPRESS_FRONTEND.md`](../docs/CYPRESS_FRONTEND.md) for the installation contract, CI behaviour, and test ownership.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
