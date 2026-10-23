import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import enGb from '@angular/common/locales/en-GB';
import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_GB, NZ_DATE_CONFIG, provideNzI18n } from 'ng-zorro-antd/i18n';

import { OMNICARE_ICONS } from './app.icons';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthBootstrapService } from './core/auth/auth-bootstrap.service';

registerLocaleData(enGb);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(AuthBootstrapService).initialize()),
    provideClientHydration(withEventReplay()),
    provideNzI18n(en_GB),
    provideNzIcons(OMNICARE_ICONS),
    { provide: LOCALE_ID, useValue: 'en-GB' },
    { provide: NZ_DATE_CONFIG, useValue: { firstDayOfWeek: 1 } },
  ],
};
