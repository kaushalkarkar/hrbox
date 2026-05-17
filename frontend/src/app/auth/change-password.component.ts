import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="header">
      <h2>Change password</h2>
      <a class="btn" routerLink="/dashboard">← Back</a>
    </div>

    <div class="card" style="max-width: 500px;">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field">
          <label>Current password</label>
          <input class="input" type="password" formControlName="currentPassword" autocomplete="current-password" />
        </div>
        <div class="field">
          <label>New password (min 6 chars)</label>
          <input class="input" type="password" formControlName="newPassword" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>Confirm new password</label>
          <input class="input" type="password" formControlName="confirm" autocomplete="new-password" />
        </div>

        @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }
        @if (success()) { <div class="success">Password changed.</div> }

        <button class="btn btn-primary" type="submit" [disabled]="busy() || form.invalid || mismatch()">
          {{ busy() ? 'Working…' : 'Update password' }}
        </button>
        @if (mismatch()) { <span class="muted" style="margin-left: 8px;">Passwords don't match</span> }
      </form>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h2 { margin: 0; }
    .success { color: var(--success); margin-bottom: 12px; font-weight: 500; }
  `]
})
export class ChangePasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  busy = signal(false);
  errorMsg = signal<string | null>(null);
  success = signal(false);

  form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', Validators.required]
  });

  mismatch(): boolean {
    const v = this.form.getRawValue();
    return v.confirm.length > 0 && v.newPassword !== v.confirm;
  }

  submit() {
    if (this.form.invalid || this.mismatch()) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    this.auth.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.success.set(true);
        this.busy.set(false);
        this.form.reset();
        setTimeout(() => this.router.navigateByUrl('/dashboard'), 800);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Change failed');
        this.busy.set(false);
      }
    });
  }
}
