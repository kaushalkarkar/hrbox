import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="left-panel">
        <div class="left-content">
          <div class="logo-row">
            <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-3.4 2.7-7 7-9 4.3 2 7 5.6 7 9a7 7 0 0 1-7 7Z"/><path d="M11 11v9"/></svg></div>
            <div class="logo-name">HRMS</div>
          </div>
          <h1>People & Operations,<br/>simplified.</h1>
          <p>Manage employees, attendance, leaves, payroll and more — all in one secure workspace.</p>

          <div class="features">
            <div class="feature">
              <span class="check">✓</span> Role-based access for HR, Managers and Employees
            </div>
            <div class="feature">
              <span class="check">✓</span> Real-time attendance & leave balance tracking
            </div>
            <div class="feature">
              <span class="check">✓</span> Secure document storage and audit trails
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="card-elevated login-card animate-in">
          <h2 style="margin: 0 0 4px 0;">Welcome back</h2>
          <p class="muted" style="margin: 0 0 24px 0;">Sign in to continue to your workspace.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Email</label>
              <input class="input" type="email" formControlName="email" autocomplete="username" />
            </div>
            <div class="field">
              <label>Password</label>
              <input class="input" type="password" formControlName="password" autocomplete="current-password" />
            </div>

            @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }

            <button class="btn btn-primary big" type="submit" [disabled]="busy() || form.invalid">
              {{ busy() ? 'Signing in…' : 'Sign in' }}
            </button>

            <div style="margin-top: 14px; text-align: center;">
              <a routerLink="/forgot-password">Forgot password?</a>
            </div>
          </form>

          <div class="hints">
            <div class="hints-title">Demo accounts</div>
            <div class="hint-row"><span class="role-pill admin">Admin</span> admin&#64;hrms.local · admin123</div>
            <div class="hint-row"><span class="role-pill mgr">Manager</span> manager&#64;hrms.local · manager123</div>
            <div class="hint-row"><span class="role-pill emp">Employee</span> employee&#64;hrms.local · employee123</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .auth-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
    }
    .left-panel {
      background: linear-gradient(135deg, #1b4d20 0%, #2e7d32 50%, #43a047 100%);
      color: #fff;
      padding: 60px 56px;
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .left-panel::before {
      content: '';
      position: absolute;
      width: 480px; height: 480px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      top: -180px; right: -180px;
    }
    .left-panel::after {
      content: '';
      position: absolute;
      width: 320px; height: 320px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      bottom: -140px; left: -100px;
    }
    .left-content { position: relative; max-width: 480px; }
    .logo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 60px; }
    .logo-mark {
      width: 44px; height: 44px;
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .logo-mark svg { width: 24px; height: 24px; }
    .logo-name { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; }
    h1 { color: #fff; font-size: 38px; line-height: 1.2; margin: 0 0 16px 0; font-weight: 800; }
    .left-panel p { font-size: 15px; line-height: 1.6; color: #d1ecd3; margin: 0 0 32px 0; max-width: 440px; }
    .features { display: flex; flex-direction: column; gap: 12px; }
    .feature { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #e8f5e9; }
    .check {
      display: inline-flex;
      align-items: center; justify-content: center;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(255,255,255,0.18);
      font-size: 12px; font-weight: 700;
      flex-shrink: 0;
    }

    .right-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      background: var(--gradient-page);
    }
    .login-card { width: 100%; max-width: 420px; }
    .btn.big { width: 100%; padding: 12px 20px; font-size: 15px; justify-content: center; }

    .hints {
      margin-top: 28px;
      padding: 16px;
      background: var(--surface-soft);
      border: 1px dashed var(--border-strong);
      border-radius: 10px;
    }
    .hints-title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--muted); letter-spacing: 0.06em; margin-bottom: 10px; }
    .hint-row { font-size: 12px; color: var(--text-soft); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .role-pill {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .role-pill.admin { background: var(--primary-soft); color: var(--primary-deep); }
    .role-pill.mgr   { background: #e0ecff; color: #1d4ed8; }
    .role-pill.emp   { background: #fff4d6; color: #8a5a00; }

    @media (max-width: 900px) {
      .auth-page { grid-template-columns: 1fr; }
      .left-panel { display: none; }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  busy = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['admin@hrms.local', [Validators.required, Validators.email]],
    password: ['admin123', [Validators.required]]
  });

  submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Invalid email or password');
        this.busy.set(false);
      }
    });
  }
}
