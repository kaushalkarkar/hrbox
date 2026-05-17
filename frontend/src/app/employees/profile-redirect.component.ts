import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

/**
 * Resolves /profile to the logged-in user's employee profile route.
 * Falls back to /employees if the user has no employee record linked.
 */
@Component({
  selector: 'app-profile-redirect',
  standalone: true,
  template: `<div class="empty">Loading profile…</div>`
})
export class ProfileRedirectComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const empId = this.auth.user()?.employee?.id;
    if (empId) this.router.navigate(['/employees', empId], { replaceUrl: true });
    else this.router.navigate(['/employees'], { replaceUrl: true });
  }
}
