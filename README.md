# OmniCareDash

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.20.

## Phase 0 verification

```bash
npm run test:ci
npm run build:ci
# Runs both commands in that order
npm run check
```

Public runtime configuration is loaded from `public/config/runtime-config.js`.
Set `apiBaseUrl` there for each deployment; never put tokens, credentials, or
other secrets in that file. Authentication tokens for the first dashboard MVP
are kept in memory only.

The dashboard is built as a browser application for the MVP. SSR is deferred
because the v1 in-memory bearer session intentionally does not survive a page
reload. Angular's persistent disk cache is disabled after a reproducible native
cache crash on the current toolchain; CI builds remain deterministic.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Standalone demo

The static demo is a compile-time-isolated build with local fictional data. It does not
authenticate against, request data from, or open a realtime connection to the backend.
Its login screen offers every role that currently has an Angular workspace: platform
administrator, doctor, secretary, and the five clinic roles.

```bash
# Development server for the standalone demo
npm run start:static-demo

# Deployable static artifact
npm run build:static-demo
```

The deployable files are written directly to `dist/omniCareDash-static`. Configure the
static host to fall back to `index.html` for client routes such as `/doctor/command` and
`/clinic/requests`. The normal `npm start` and `npm run build:ci` commands remain connected
to the configured backend.

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

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
