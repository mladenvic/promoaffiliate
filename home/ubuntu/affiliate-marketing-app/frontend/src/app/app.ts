import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { AuthService, UserProfile } from './services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent implements OnInit {
  title = 'Affiliate Marketing Platform';
  userProfile$: Observable<UserProfile | null>;
  isAuthenticated$: Observable<boolean>;

  constructor(private authService: AuthService) {
    this.userProfile$ = this.authService.userProfile$;
    this.isAuthenticated$ = this.authService.currentUser$.pipe(map(user => !!user));
  }

  ngOnInit() {
    // Component initialization
  }

  async signOut() {
    try {
      await this.authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  get isAffiliate(): boolean {
    return this.authService.isAffiliate;
  }
}

