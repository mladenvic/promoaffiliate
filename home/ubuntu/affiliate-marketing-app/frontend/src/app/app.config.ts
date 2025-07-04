import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Import all components to ensure they are recognized by the compiler
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ProductListComponent } from './components/products/product-list/product-list.component';
import { ProductDetailComponent } from './components/products/product-detail/product-detail.component';
import { DashboardComponent as AffiliateDashboardComponent } from './components/affiliate/dashboard/dashboard.component';
import { ReferralsComponent } from './components/affiliate/referrals/referrals.component';
import { CommissionsComponent as AffiliateCommissionsComponent } from './components/affiliate/commissions/commissions.component';
import { AnalyticsComponent } from './components/affiliate/analytics/analytics.component';
import { ApplyComponent } from './components/affiliate/apply/apply.component';
import { DashboardComponent as AdminDashboardComponent } from './components/admin/dashboard/dashboard.component';
import { ProductsComponent as AdminProductsComponent } from './components/admin/products/products.component';
import { AffiliatesComponent } from './components/admin/affiliates/affiliates.component';
import { CommissionsComponent as AdminCommissionsComponent } from './components/admin/commissions/commissions.component';
import { ApplicationsComponent } from './components/admin/applications/applications.component';
import { ProfileComponent } from './components/profile/profile.component';
import { TrackingComponent } from './components/tracking/tracking.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions())
  ]
};

