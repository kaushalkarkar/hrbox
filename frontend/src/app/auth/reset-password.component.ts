import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card login-card">
        <h1>Reset password</h1>
        <p class="muted">Paste your reset token and choose a new password.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Reset token</label>
            <input class="input" formControlName="token" />
          </div>
          <div class="field">
            <label>New password (min 6 chars)</label>
            <input class="input" type="password" formControlName="newPassword" autocomplete="new-password" />
          </div>

          @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }
          @if (success()) { <div class="success">Password updated. Redirecting to sign in…</div> }

          <button class="btn btn-primary" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Working…' : 'Set new password' }}
          </button>
        </form>

        <div style="margin-top: 12px; text-align: center;">
          <a routerLink="/login">← Back to sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .login-card { width: 100%; max-width: 440px; }
    h1 { margin: 0 0 4px 0; }
    .success { color: var(--success); margin-bottom: 12px; font-weight: 500; }
    button[type=submit] { width: 100%; margin-top: 4px; }
  `]
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  busy = signal(false);
  errorMsg = signal<string | null>(null);
  success = signal(false);

  form = this.fb.nonNullable.group({
    token: [this.route.snapshot.queryParamMap.get('token') ?? '', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    this.auth.resetPassword(v.token, v.newPassword).subscribe({
      next: () => {
        this.success.set(true);
        setTimeout(() => this.router.navigateByUrl('/login'), 1200);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Reset failed');
        this.busy.set(false);
      }
    });
  }
}
