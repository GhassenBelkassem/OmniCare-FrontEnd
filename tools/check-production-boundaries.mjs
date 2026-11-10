import { readFileSync } from 'node:fs';

const productionCompositionFiles = [
  'src/app/app.config.ts',
  'src/app/core/auth/auth.service.ts',
  'src/app/features/login/login-page.ts',
  'src/app/features/doctor/doctor.routes.ts',
  'src/app/features/doctor/doctor-shell.ts',
  'src/app/features/doctor/patient-lookup-dialog.ts',
  'src/app/features/doctor/command/command-center-page.ts',
  'src/app/features/doctor/requests/requests-page.ts',
];

const forbiddenImports = [
  'static-demo-api.interceptor',
  'DoctorMockService',
  'doctor-mock',
  'demo-auth',
];

const violations = [];
for (const file of productionCompositionFiles) {
  const source = readFileSync(file, 'utf8');
  for (const forbidden of forbiddenImports) {
    if (source.includes(forbidden)) violations.push(`${file}: imports or references ${forbidden}`);
  }
}

const appConfig = readFileSync('src/app/app.config.ts', 'utf8');
if (!appConfig.includes('APPLICATION_HTTP_INTERCEPTORS')) {
  violations.push(
    'src/app/app.config.ts: HTTP interceptors are not composed through the build boundary',
  );
}

const productionInterceptors = readFileSync(
  'src/app/core/http/application-http-interceptors.ts',
  'utf8',
);
if (
  !productionInterceptors.includes('authInterceptor') ||
  productionInterceptors.includes('staticDemoApiInterceptor')
) {
  violations.push('production HTTP pipeline must contain authInterceptor and no demo interceptor');
}

const angularConfiguration = JSON.parse(readFileSync('angular.json', 'utf8'));
const buildConfigurations =
  angularConfiguration.projects?.omniCareDash?.architect?.build?.configurations ?? {};
const staticDemoReplacements = buildConfigurations['static-demo']?.fileReplacements ?? [];
const staticDemoReplacementMap = new Map(
  staticDemoReplacements.map(({ replace, with: target }) => [replace, target]),
);
for (const [source, target] of [
  [
    'src/app/core/http/application-http-interceptors.ts',
    'src/app/core/http/application-http-interceptors.static-demo.ts',
  ],
  ['src/app/core/auth/auth-mode.ts', 'src/app/core/auth/auth-mode.static-demo.ts'],
  [
    'src/app/features/doctor/doctor.routes.ts',
    'src/app/features/doctor/doctor.routes.static-demo.ts',
  ],
]) {
  if (staticDemoReplacementMap.get(source) !== target) {
    violations.push(`angular.json: missing static-demo replacement ${source} -> ${target}`);
  }
}

const developmentRoutesSource = 'src/app/development.routes.ts';
const optimizedRoutesSource = 'src/app/development.routes.production.ts';
const optimizedStylesSource = 'src/styles/vendor/spartan-tailwind.production.css';
for (const configurationName of ['production', 'static-demo']) {
  const configuredReplacements = buildConfigurations[configurationName]?.fileReplacements ?? [];
  const configuredReplacementMap = new Map(
    configuredReplacements.map(({ replace, with: target }) => [replace, target]),
  );
  if (configuredReplacementMap.get(developmentRoutesSource) !== optimizedRoutesSource) {
    violations.push(
      `angular.json: missing ${configurationName} replacement ${developmentRoutesSource} -> ${optimizedRoutesSource}`,
    );
  }
  const configuredStyles = buildConfigurations[configurationName]?.styles ?? [];
  if (
    !configuredStyles.includes(optimizedStylesSource) ||
    configuredStyles.includes('src/styles/vendor/spartan-tailwind.css')
  ) {
    violations.push(
      `angular.json: ${configurationName} must compose ${optimizedStylesSource} and exclude the development harness entry`,
    );
  }
}

const optimizedDevelopmentRoutes = readFileSync(optimizedRoutesSource, 'utf8');
if (
  !optimizedDevelopmentRoutes.includes('DEVELOPMENT_ROOT_ROUTES: Routes = []') ||
  !optimizedDevelopmentRoutes.includes('DEVELOPMENT_SHELL_ROUTES: Routes = []') ||
  optimizedDevelopmentRoutes.includes('import(')
) {
  violations.push(
    'development.routes.production.ts: optimized route replacement must export empty routes and no dynamic imports',
  );
}

const optimizedDevelopmentStyles = readFileSync(optimizedStylesSource, 'utf8');
if (
  optimizedDevelopmentStyles.includes('spartan-helm-harness') ||
  optimizedDevelopmentStyles.includes('oc-spartan-compat')
) {
  violations.push(
    'spartan-tailwind.production.css: optimized global styles must exclude the development harness',
  );
}

const doctorRoutes = readFileSync('src/app/features/doctor/doctor.routes.ts', 'utf8');
for (const path of ['waiting-room', 'prescriptions', 'results', 'analytics']) {
  const routeStart = doctorRoutes.indexOf(`path: '${path}'`);
  const nextRoute = doctorRoutes.indexOf('doctorOnly({', routeStart + 1);
  const routeSource = doctorRoutes.slice(routeStart, nextRoute === -1 ? undefined : nextRoute);
  if (routeStart === -1 || !routeSource.includes('ProductionUnavailablePage')) {
    violations.push(`doctor.routes.ts: ${path} must resolve to ProductionUnavailablePage`);
  }
}

if (violations.length > 0) {
  console.error('Production boundary violations:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Production/demo boundary checks passed.');
}
