import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { AdminAppComponent } from './app/admin-app.component';
import { ADMIN_ROUTES } from './app/admin.routes';

bootstrapApplication(AdminAppComponent, {
  providers: [provideHttpClient(), provideRouter(ADMIN_ROUTES)],
}).catch((error: unknown) => console.error(error));
