import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subscription-success',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div class="text-center max-w-md">
        <div class="text-6xl mb-6">🎉</div>
        <h1 class="text-3xl font-bold text-white mb-4">Subscription Successful!</h1>
        <p class="text-slate-300 mb-8">
          Thank you for subscribing. Your premium features are now active.
        </p>
        <button
          (click)="goToDashboard()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  `,
})
export class SubscriptionSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];
      if (sessionId) {
        // Optionally verify the session with backend
        console.log('Session ID:', sessionId);
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
