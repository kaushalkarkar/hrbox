import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { HolidayService } from '../core/holiday.service';
import { Holiday } from '../core/models';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="breadcrumb"><a routerLink="/dashboard">Home</a> · Holidays</div>

    <div class="page-header">
      <div>
        <h2>Holiday Calendar</h2>
        <div class="muted" style="margin-top: 4px;">Public holidays observed by the company</div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn" (click)="prevYear()">‹ {{ year() - 1 }}</button>
        <div class="year-pill">{{ year() }}</div>
        <button class="btn" (click)="nextYear()">{{ year() + 1 }} ›</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="summary-grid">
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.cal"></div>
        <div>
          <div class="stat-tile-value">{{ holidays().length }}</div>
          <div class="stat-tile-label">Holidays in {{ year() }}</div>
        </div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.upcoming"></div>
        <div>
          <div class="stat-tile-value">{{ upcomingCount() }}</div>
          <div class="stat-tile-label">Upcoming</div>
        </div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.past"></div>
        <div>
          <div class="stat-tile-value">{{ pastCount() }}</div>
          <div class="stat-tile-label">Past</div>
        </div>
      </div>
    </div>

    <div class="layout">
      <!-- Holidays list -->
      <div class="card holiday-list-card">
        <div class="list-header">
          <h3 style="margin: 0;">All holidays</h3>
        </div>

        @if (loading()) {
          <div class="empty">Loading…</div>
        } @else if (holidays().length === 0) {
          <div class="empty">No holidays defined for {{ year() }}.</div>
        } @else {
          <div class="holiday-rows">
            @for (h of holidays(); track h.id) {
              <div class="holiday-row" [class.past]="isPast(h.date)" [class.today]="isToday(h.date)">
                <div class="date-block">
                  <div class="date-month">{{ monthShort(h.date) }}</div>
                  <div class="date-day">{{ dayOf(h.date) }}</div>
                  <div class="date-weekday">{{ weekdayShort(h.date) }}</div>
                </div>
                <div class="holiday-info">
                  <div class="holiday-name">{{ h.name }}</div>
                  @if (h.description) { <div class="holiday-desc muted">{{ h.description }}</div> }
                  <div class="holiday-meta muted">
                    {{ formatDate(h.date) }}
                    @if (isToday(h.date)) { <span class="badge badge-present" style="margin-left: 8px;">Today</span> }
                    @else if (isUpcoming(h.date)) { <span class="badge badge-leave" style="margin-left: 8px;">{{ daysUntil(h.date) }}</span> }
                  </div>
                </div>
                @if (isAdmin()) {
                  <div class="holiday-actions">
                    <button class="btn btn-sm" (click)="edit(h)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="remove(h)">Delete</button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Admin: add/edit form -->
      @if (isAdmin()) {
        <div class="card form-card">
          <h3 style="margin: 0 0 12px 0;">{{ editingId() ? 'Edit holiday' : 'Add holiday' }}</h3>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Date *</label>
              <input class="input" type="date" formControlName="date" />
            </div>
            <div class="field">
              <label>Name *</label>
              <input class="input" formControlName="name" placeholder="e.g. Republic Day" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea formControlName="description" rows="3" placeholder="Optional"></textarea>
            </div>

            @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }

            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="btn btn-primary" type="submit" [disabled]="busy() || form.invalid">
                {{ busy() ? 'Saving…' : (editingId() ? 'Save changes' : 'Add holiday') }}
              </button>
              @if (editingId()) {
                <button type="button" class="btn" (click)="cancelEdit()">Cancel</button>
              }
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .year-pill {
      font-size: 16px;
      font-weight: 800;
      color: var(--primary-deep);
      padding: 6px 14px;
      background: var(--primary-soft);
      border-radius: 999px;
      min-width: 70px;
      text-align: center;
    }
    .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .holiday-rows { display: flex; flex-direction: column; gap: 10px; }
    .holiday-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .holiday-row:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
    .holiday-row.past { opacity: 0.55; }
    .holiday-row.today { background: var(--primary-soft); border-color: var(--primary); }
    .date-block {
      flex-shrink: 0;
      width: 70px;
      text-align: center;
      padding: 8px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .date-month { font-size: 10px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; }
    .date-day { font-size: 22px; font-weight: 800; color: var(--text); line-height: 1; margin: 2px 0; }
    .date-weekday { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .holiday-info { flex: 1; min-width: 0; }
    .holiday-name { font-weight: 700; font-size: 15px; color: var(--text); }
    .holiday-desc { font-size: 13px; margin-top: 2px; }
    .holiday-meta { font-size: 12px; margin-top: 6px; }
    .holiday-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .form-card { position: sticky; top: 84px; height: fit-content; }
  `]
})
export class HolidaysComponent {
  private fb = inject(FormBuilder);
  private svc = inject(HolidayService);
  private auth = inject(AuthService);

  year = signal(new Date().getFullYear());
  holidays = signal<Holiday[]>([]);
  loading = signal(true);
  busy = signal(false);
  errorMsg = signal<string | null>(null);
  editingId = signal<number | null>(null);

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  upcomingCount = computed(() => this.holidays().filter(h => this.isUpcoming(h.date)).length);
  pastCount = computed(() => this.holidays().filter(h => this.isPast(h.date)).length);

  form = this.fb.nonNullable.group({
    date: ['', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['']
  });

  ic = {
    cal:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    upcoming: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    past:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 12 9 18 21 6"/></svg>`,
  };

  constructor() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.svc.list(this.year()).subscribe({
      next: r => { this.holidays.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  prevYear() { this.year.update(y => y - 1); this.reload(); }
  nextYear() { this.year.update(y => y + 1); this.reload(); }

  edit(h: Holiday) {
    this.editingId.set(h.id);
    this.form.setValue({ date: h.date, name: h.name, description: h.description ?? '' });
    this.errorMsg.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form.reset({ date: '', name: '', description: '' });
    this.errorMsg.set(null);
  }

  submit() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    const payload = { date: v.date, name: v.name, description: v.description || null };

    const obs = this.editingId()
      ? this.svc.update(this.editingId()!, payload)
      : this.svc.create(payload);

    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.cancelEdit();
        this.reload();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Save failed');
        this.busy.set(false);
      }
    });
  }

  remove(h: Holiday) {
    if (!confirm(`Delete "${h.name}" on ${h.date}?`)) return;
    this.svc.delete(h.id).subscribe({
      next: () => this.reload(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }

  // === date helpers ===
  private toDate(iso: string): Date { return new Date(iso + 'T00:00:00'); }
  private startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }

  isPast(iso: string): boolean { return this.toDate(iso) < this.startOfToday(); }
  isToday(iso: string): boolean { return this.toDate(iso).getTime() === this.startOfToday().getTime(); }
  isUpcoming(iso: string): boolean { return this.toDate(iso) > this.startOfToday(); }

  daysUntil(iso: string): string {
    const days = Math.round((this.toDate(iso).getTime() - this.startOfToday().getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  monthShort(iso: string): string { return this.toDate(iso).toLocaleDateString('en-US', { month: 'short' }); }
  dayOf(iso: string): number { return this.toDate(iso).getDate(); }
  weekdayShort(iso: string): string { return this.toDate(iso).toLocaleDateString('en-US', { weekday: 'short' }); }
  formatDate(iso: string): string {
    return this.toDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
}
