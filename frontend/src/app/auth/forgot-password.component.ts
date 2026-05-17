import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="card login-card">
        <h1>Forgot password</h1>
        <p class="muted">Enter your email and we'll generate a reset token.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Email</label>
            <input class="input" type="email" formControlName="email" />
          </div>

          @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }

          @if (result()) {
            <div class="result">
              <div>{{ result()!.message }}</div>
              @if (result()!.devToken) {
                <div class="dev-token">
                  <strong>Dev token:</strong>
                  <code>{{ result()!.devToken }}</code>
                  <button type="button" class="btn btn-sm" (click)="useToken()">Use this token →</button>
                </div>
                <p class="muted small">In production this would be emailed instead.</p>
              }
            </div>
          }

          <button class="btn btn-primary" type="submit" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Working…' : 'Generate reset token' }}
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
    button[type=submit] { width: 100%; margin-top: 4px; }
    .result { background: #eef1fb; border: 1px solid #c7d2fe; padding: 12px; border-radius: 6px; margin-bottom: 12px; }
    .dev-token { margin-top: 8px; word-break: break-all; }
    .dev-token code { background: #fff; padding: 4px 6px; border-radius: 4px; font-size: 12px; display: inline-block; margin: 4px 0; }
    .small { font-size: 12px; margin: 4px 0 0 0; }
  `]
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  busy = signal(false);
  errorMsg = signal<string | null>(null);
  result = signal<{ message: string; devToken: string | null } | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => { this.result.set(res); this.busy.set(false); },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Could not generate token');
        this.busy.set(false);
      }
    });
  }

  useToken() {
    const tok = this.result()?.devToken;
    if (tok) this.router.navigate(['/reset-password'], { queryParams: { token: tok } });
  }
}
