import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import fr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { fr_FR, NZ_DATE_CONFIG, provideNzI18n } from 'ng-zorro-antd/i18n';

import { OMNICARE_ICONS } from './app.icons';
import { routes } from './app.routes';
import { AuthBootstrapService } from './core/auth/auth-bootstrap.service';
import { APPLICATION_HTTP_INTERCEPTORS } from './core/http/application-http-interceptors';
import { TokenRefreshScheduler } from './core/auth/token-refresh.scheduler';

registerLocaleData(fr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([...APPLICATION_HTTP_INTERCEPTORS])),
    provideAppInitializer(() => inject(AuthBootstrapService).initialize()),
    // G-1 D5: refresh the access token about a minute before it expires.
    provideAppInitializer(() => inject(TokenRefreshScheduler).start()),
    provideClientHydration(withEventReplay()),
    provideNzI18n(fr_FR),
    provideNzIcons(OMNICARE_ICONS),
    { provide: LOCALE_ID, useValue: 'fr' },
    { provide: NZ_DATE_CONFIG, useValue: { firstDayOfWeek: 1 } },
  ],
};
