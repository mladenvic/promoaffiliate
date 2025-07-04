import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  constructor(public authService: AuthService) {}

  features = [
    {
      icon: 'link',
      title: 'Easy Referral Links',
      description: 'Generate custom referral links for any product with just one click.'
    },
    {
      icon: 'analytics',
      title: 'Real-time Analytics',
      description: 'Track your performance with detailed analytics and reporting.'
    },
    {
      icon: 'monetization_on',
      title: 'Flexible Commissions',
      description: 'Earn competitive commissions with multiple payout options.'
    },
    {
      icon: 'security',
      title: 'Secure Platform',
      description: 'Your data and earnings are protected with enterprise-grade security.'
    }
  ];
}

