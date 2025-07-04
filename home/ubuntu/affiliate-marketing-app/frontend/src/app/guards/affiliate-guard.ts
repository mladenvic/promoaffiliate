import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AffiliateGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.authService.userProfile$.pipe(
      take(1),
      map(profile => {
        if (profile && (profile.role === 'affiliate' || profile.role === 'admin')) {
          return true;
        } else {
          this.router.navigate(['/affiliate/apply']);
          return false;
        }
      })
    );
  }
}

