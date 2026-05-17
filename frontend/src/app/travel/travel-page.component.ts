import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { TravelService } from '../core/travel.service';
import {
  TravelMode, TravelRequest, TravelStats, TravelStatus
} from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'mine' | 'approvals' | 'all';

const MODE_META: Record<TravelMode, { label: string; icon: string; color: string; }> = {
  FLIGHT:       { label: 'Flight',       icon: '✈', color: '#2566e8' },
  TRAIN:        { label: 'Train',        icon: '🚆', color: '#388e3c' },
  BUS:          { label: 'Bus',          icon: '🚌', color: '#f5a623' },
  CAB:          { label: 'Cab',          icon: '🚕', color: '#e91e63' },
  OWN_VEHICLE:  { label: 'Own vehicle',  icon: '🚗', color: '#5e35b1' },
  OTHER:        { label: 'Other',        icon: '🧳', color: '#6b7280' },
};

const STATUS_BADGE: Record<TravelStatus, string> = {
  PENDING:   'badge-pending',
  APPROVED:  'badge-approved',
  REJECTED:  'badge-rejected',
  BOOKED:    'badge-leave',
  COMPLETED: 'badge-present',
  CANCELLED: 'badge-weekend',
};

@Component({
  selector: 'app-travel-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>Travel</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'mine'"      (click)="onTab('mine')">My Trips</button>
        @if (canApprove()) {
          <button class="tab" [class.active]="tab() === 'approvals'" (click)="onTab('approvals')">Approvals</button>
        }
        @if (isAdmin()) {
          <button class="tab" [class.active]="tab() === 'all'"       (click)="onTab('all')">All Travel</button>
        }
      </div>
      <button class="btn btn-primary" (click)="openSubmit()">+ Plan a trip</button>
    </div>

    <!-- Stats -->
    @if (tab() === 'mine' && stats(); as s) {
      <div class="stats-row">
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.clock | safeHtml"></div><div><div class="stat-tile-value">{{ s.pendingCount }}</div><div class="stat-tile-label">Pending</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.check | safeHtml"></div><div><div class="stat-tile-value">{{ s.approvedCount }}</div><div class="stat-tile-label">Approved</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.luggage | safeHtml"></div><div><div class="stat-tile-value">{{ s.bookedCount }}</div><div class="stat-tile-label">Booked</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.flag | safeHtml"></div><div><div class="stat-tile-value">{{ s.completedCount }}</div><div class="stat-tile-label">Completed</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.money | safeHtml"></div><div><div class="stat-tile-value">₹ {{ formatMoney(s.totalApprovedCost) }}</div><div class="stat-tile-label">Approved spend</div></div></div>
      </div>
    }

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (visible().length === 0) {
      <div class="empty">
        @if (tab() === 'approvals') { Nothing pending. } @else { No travel requests yet. }
        @if (tab() === 'mine') {
          <div style="margin-top: 10px;"><button class="btn btn-primary" (click)="openSubmit()">Plan your first trip</button></div>
        }
      </div>
    } @else {
      @if (tab() === 'approvals') {
        <!-- Approvals: stacked cards with inline action buttons -->
        <div class="approval-grid">
          @for (t of visible(); track t.id) {
            <div class="trip-card">
              <div class="trip-head">
                <div>
                  <strong>{{ t.employeeName }}</strong>
                  <span class="muted small"> · {{ t.employeeCode }}</span>
                </div>
                <span class="badge" [class]="statusBadge(t.status)">{{ t.status }}</span>
              </div>
              <div class="route">
                <span class="city">{{ t.origin }}</span>
                <span class="route-arrow">→</span>
                <span class="city">{{ t.destination }}</span>
                <span class="mode-chip" [style.background]="modeColor(t.mode)">{{ modeIcon(t.mode) }} {{ modeLabel(t.mode) }}</span>
              </div>
              <div class="trip-meta muted small">
                {{ t.departureDate }} → {{ t.returnDate }} · Est. {{ formatCurrency(t.estimatedCost, t.currency) }}
              </div>
              <p class="trip-purpose">{{ t.purpose }}</p>
              @if (t.accommodation) { <div class="muted small">🏨 {{ t.accommodation }}</div> }

              <div class="approval-actions">
                <input class="input" placeholder="Optional comment" [(ngModel)]="comments[t.id]" />
                <button class="btn btn-sm btn-success" (click)="approve(t)" [disabled]="busyId() === t.id">Approve</button>
                <button class="btn btn-sm btn-danger" (click)="reject(t)" [disabled]="busyId() === t.id">Reject</button>
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- My / All: ticket-style cards -->
        <div class="trip-grid">
          @for (t of visible(); track t.id) {
            <div class="trip-card">
              <div class="trip-head">
                <span class="mode-chip" [style.background]="modeColor(t.mode)">{{ modeIcon(t.mode) }} {{ modeLabel(t.mode) }}</span>
                <span class="badge" [class]="statusBadge(t.status)">{{ t.status }}</span>
              </div>
              <div class="route">
                <span class="city">{{ t.origin }}</span>
                <span class="route-arrow">→</span>
                <span class="city">{{ t.destination }}</span>
              </div>
              <div class="trip-meta muted small">
                {{ t.departureDate }} → {{ t.returnDate }} · {{ daysBetween(t.departureDate, t.returnDate) }} day(s)
              </div>
              <p class="trip-purpose">{{ t.purpose }}</p>
              @if (t.accommodation) { <div class="muted small">🏨 {{ t.accommodation }}</div> }
              <div class="muted small" style="margin-top: 4px;">
                Est. <strong>{{ formatCurrency(t.estimatedCost, t.currency) }}</strong>
              </div>
              @if (tab() === 'all') {
                <div class="muted small">By <strong>{{ t.employeeName }}</strong> ({{ t.employeeCode }})</div>
              }
              @if (t.decidedByName) {
                <div class="muted small">
                  {{ t.status === 'APPROVED' || t.status === 'BOOKED' || t.status === 'COMPLETED' ? '✓' : '✗' }}
                  by {{ t.decidedByName }}
                  @if (t.decisionComment) { · "{{ t.decisionComment }}" }
                </div>
              }
              <div class="trip-actions">
                @if (tab() === 'mine' && t.status === 'PENDING') {
                  <button class="btn btn-sm btn-danger" (click)="onDelete(t)">Cancel</button>
                }
                @if (tab() === 'mine' && (t.status === 'APPROVED' || t.status === 'BOOKED')) {
                  <button class="btn btn-sm" (click)="markCompleted(t)">Mark completed</button>
                }
                @if (tab() === 'mine' && (t.status === 'APPROVED' || t.status === 'BOOKED' || t.status === 'PENDING')) {
                  <button class="btn btn-sm btn-danger" (click)="cancel(t)">Cancel trip</button>
                }
                @if (canApprove() && t.status === 'APPROVED') {
                  <button class="btn btn-sm" (click)="markBooked(t)">Mark booked</button>
                }
              </div>
            </div>
          }
        </div>
      }
    }

    <!-- Submit drawer -->
    @if (submitOpen()) {
      <div class="drawer-backdrop" (click)="closeSubmit()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>New travel request</h2>
          <button class="close-btn" (click)="closeSubmit()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="row two">
              <div class="field">
                <label>Origin <span class="req">*</span></label>
                <input class="input" formControlName="origin" placeholder="Mumbai" />
              </div>
              <div class="field">
                <label>Destination <span class="req">*</span></label>
                <input class="input" formControlName="destination" placeholder="Bengaluru" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Departure <span class="req">*</span></label>
                <input class="input" type="date" formControlName="departureDate" />
              </div>
              <div class="field">
                <label>Return <span class="req">*</span></label>
                <input class="input" type="date" formControlName="returnDate" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Mode <span class="req">*</span></label>
                <select class="select" formControlName="mode">
                  <option value="" disabled>Select…</option>
                  <option value="FLIGHT">Flight</option>
                  <option value="TRAIN">Train</option>
                  <option value="BUS">Bus</option>
                  <option value="CAB">Cab</option>
                  <option value="OWN_VEHICLE">Own vehicle</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div class="field">
                <label>Estimated cost</label>
                <div style="display: flex; gap: 6px;">
                  <select class="select" formControlName="currency" style="width: 90px;">
                    <option value="INR">₹</option>
                    <option value="USD">$</option>
                    <option value="EUR">€</option>
                    <option value="GBP">£</option>
                  </select>
                  <input class="input" type="number" min="0" step="0.01" formControlName="estimatedCost" />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Purpose <span class="req">*</span></label>
              <textarea formControlName="purpose" rows="3" placeholder="Client meeting / conference / training / vendor visit…"></textarea>
            </div>
            <div class="field">
              <label>Accommodation</label>
              <input class="input" formControlName="accommodation" placeholder="Hotel name, address, or 'company guest house'" />
            </div>
            @if (submitErr()) { <div class="error">{{ submitErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeSubmit()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="form.invalid || submitBusy()">
            {{ submitBusy() ? 'Submitting…' : 'Submit request' }}
          </button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; gap: 24px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; flex-wrap: wrap; }
    .page-bar h2 { margin: 0; flex: 0 0 auto; }
    .tabs { display: flex; gap: 28px; flex: 1; }
    .tab { background: transparent; border: none; padding: 6px 0; font-size: 14px; font-weight: 600; color: var(--text-soft); cursor: pointer; font-family: inherit; position: relative; }
    .tab:hover { color: var(--primary); }
    .tab.active { color: var(--primary); }
    .tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -15px; height: 3px; background: var(--primary); border-radius: 2px 2px 0 0; }
    .small { font-size: 12px; }

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 18px; }

    .trip-grid, .approval-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 14px;
    }
    .approval-grid { grid-template-columns: 1fr; }

    .trip-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .trip-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .trip-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .mode-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.03em;
    }
    .route {
      display: flex; align-items: center; gap: 10px;
      margin: 14px 0 6px 0;
      font-size: 16px; font-weight: 700;
      flex-wrap: wrap;
    }
    .city { color: var(--text); }
    .route-arrow {
      color: var(--accent);
      font-size: 18px;
      font-weight: 800;
    }
    .trip-meta { margin-top: 2px; }
    .trip-purpose {
      color: var(--text-soft);
      margin: 10px 0 8px 0;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .trip-actions { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; justify-content: flex-end; }

    .approval-actions {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      margin-top: 14px;
    }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .drawer-head { padding: 22px 26px 16px 26px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .drawer-head h2 { margin: 0; font-size: 20px; }
    .close-btn { width: 36px; height: 36px; border: none; background: transparent; color: var(--text-soft); border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .drawer-body { flex: 1; overflow-y: auto; padding: 22px 26px; }
    .drawer-foot { padding: 16px 26px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
    .req { color: var(--danger); margin-left: 2px; }
    .row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  `]
})
export class TravelPageComponent {
  private svc = inject(TravelService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('mine');
  loading = signal(false);

  mine = signal<TravelRequest[]>([]);
  pendingList = signal<TravelRequest[]>([]);
  allList = signal<TravelRequest[]>([]);
  stats = signal<TravelStats | null>(null);

  busyId = signal<number | null>(null);
  comments: Record<number, string> = {};

  submitOpen = signal(false);
  submitBusy = signal(false);
  submitErr = signal<string | null>(null);

  form = this.fb.group({
    origin: ['', [Validators.required, Validators.maxLength(120)]],
    destination: ['', [Validators.required, Validators.maxLength(120)]],
    departureDate: [new Date().toISOString().slice(0, 10), Validators.required],
    returnDate: [new Date(Date.now() + 86400000).toISOString().slice(0, 10), Validators.required],
    mode: ['' as TravelMode | '', Validators.required],
    purpose: ['', Validators.required],
    estimatedCost: [0],
    currency: ['INR'],
    accommodation: ['']
  });

  canApprove = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));
  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  visible = computed(() => {
    switch (this.tab()) {
      case 'mine':      return this.mine();
      case 'approvals': return this.pendingList();
      case 'all':       return this.allList();
    }
  });

  ic = {
    clock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    luggage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="7" width="12" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="9" y1="11" x2="9" y2="17"/><line x1="15" y1="11" x2="15" y2="17"/></svg>`,
    flag:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="22" x2="4" y2="15"/><path d="M4 15 21 5 17 15 21 22 4 15z"/></svg>`,
    money:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    close:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() { this.refreshAll(); }

  refreshAll() {
    this.loading.set(true);
    this.svc.mine().subscribe({
      next: r => { this.mine.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.svc.myStats().subscribe(s => this.stats.set(s));
    if (this.canApprove()) this.svc.pending().subscribe(r => this.pendingList.set(r));
    if (this.isAdmin())    this.svc.all().subscribe(r => this.allList.set(r));
  }

  onTab(t: Tab) {
    this.tab.set(t);
    if (t === 'approvals' && this.canApprove()) {
      this.loading.set(true);
      this.svc.pending().subscribe({
        next: r => { this.pendingList.set(r); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else if (t === 'all' && this.isAdmin()) {
      this.loading.set(true);
      this.svc.all().subscribe({
        next: r => { this.allList.set(r); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    }
  }

  modeIcon(m: TravelMode) { return MODE_META[m].icon; }
  modeLabel(m: TravelMode) { return MODE_META[m].label; }
  modeColor(m: TravelMode) { return MODE_META[m].color; }
  statusBadge(s: TravelStatus) { return STATUS_BADGE[s]; }

  formatMoney(n: number): string {
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  formatCurrency(amount: number, currency: string): string {
    const symbol = ({ INR: '₹', USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[currency] ?? currency + ' ';
    return symbol + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  daysBetween(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00').getTime();
    const b = new Date(to + 'T00:00:00').getTime();
    return Math.floor((b - a) / 86400000) + 1;
  }

  /* Submit */

  openSubmit() {
    this.submitErr.set(null);
    this.form.reset({
      origin: '', destination: '',
      departureDate: new Date().toISOString().slice(0, 10),
      returnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      mode: '' as TravelMode | '',
      purpose: '', estimatedCost: 0, currency: 'INR', accommodation: ''
    });
    this.submitOpen.set(true);
  }
  closeSubmit() { this.submitOpen.set(false); }
  submit() {
    if (this.form.invalid) return;
    this.submitBusy.set(true); this.submitErr.set(null);
    const v = this.form.value;
    this.svc.submit({
      origin: v.origin!, destination: v.destination!,
      departureDate: v.departureDate!, returnDate: v.returnDate!,
      mode: v.mode as TravelMode,
      purpose: v.purpose!,
      estimatedCost: v.estimatedCost ? Number(v.estimatedCost) : 0,
      currency: v.currency ?? 'INR',
      accommodation: v.accommodation ?? undefined
    }).subscribe({
      next: () => { this.submitBusy.set(false); this.closeSubmit(); this.refreshAll(); },
      error: (err) => { this.submitErr.set(err?.error?.message ?? 'Submission failed'); this.submitBusy.set(false); }
    });
  }

  /* Approvals */

  approve(t: TravelRequest) { this.decideApproval(t, 'approve'); }
  reject(t: TravelRequest)  { this.decideApproval(t, 'reject'); }
  markBooked(t: TravelRequest) {
    this.svc.markBooked(t.id).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  private decideApproval(t: TravelRequest, kind: 'approve' | 'reject') {
    this.busyId.set(t.id);
    const obs = kind === 'approve' ? this.svc.approve(t.id, this.comments[t.id]) : this.svc.reject(t.id, this.comments[t.id]);
    obs.subscribe({
      next: () => { this.busyId.set(null); delete this.comments[t.id]; this.refreshAll(); },
      error: (err) => { alert(err?.error?.message ?? 'Action failed'); this.busyId.set(null); }
    });
  }

  /* Owner actions */

  markCompleted(t: TravelRequest) {
    this.svc.markCompleted(t.id).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }
  cancel(t: TravelRequest) {
    if (!confirm('Cancel this trip?')) return;
    this.svc.cancel(t.id).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }
  onDelete(t: TravelRequest) {
    if (!confirm('Remove this pending request?')) return;
    this.svc.delete(t.id).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }
}
