import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { AdminGuard } from './guards/admin-guard';
import { AffiliateGuard } from './guards/affiliate-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'products',
    loadComponent: () => import('./components/products/product-list/product-list.component').then(m => m.ProductListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'products/:id',
    loadComponent: () => import('./components/products/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'affiliate',
    canActivate: [AuthGuard, AffiliateGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/affiliate/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'referrals',
        loadComponent: () => import('./components/affiliate/referrals/referrals.component').then(m => m.ReferralsComponent)
      },
      {
        path: 'commissions',
        loadComponent: () => import('./components/affiliate/commissions/commissions.component').then(m => m.CommissionsComponent)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./components/affiliate/analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      {
        path: 'apply',
        loadComponent: () => import('./components/affiliate/apply/apply.component').then(m => m.ApplyComponent)
      }
    ]
  },
  {
    path: 'admin',
    canActivate: [AuthGuard, AdminGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./components/admin/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'affiliates',
        loadComponent: () => import('./components/admin/affiliates/affiliates.component').then(m => m.AffiliatesComponent)
      },
      {
        path: 'commissions',
        loadComponent: () => import('./components/admin/commissions/commissions.component').then(m => m.CommissionsComponent)
      },
      {
        path: 'applications',
        loadComponent: () => import('./components/admin/applications/applications.component').then(m => m.ApplicationsComponent)
      }
    ]
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'track/:code',
    loadComponent: () => import('./components/tracking/tracking.component').then(m => m.TrackingComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];

