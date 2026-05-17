import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { ReimbursementService } from '../core/reimbursement.service';
import { Expense, ExpenseCategory, ExpenseStats, ExpenseStatus } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'mine' | 'approvals' | 'all';

const CATEGORY_META: Record<ExpenseCategory, { label: string; color: string; }> = {
  TRAVEL:          { label: 'Travel',          color: '#2566e8' },
  FOOD:            { label: 'Food',            color: '#e91e63' },
  INTERNET:        { label: 'Internet',        color: '#6c5ce7' },
  PHONE:           { label: 'Phone',           color: '#0288d1' },
  OFFICE_SUPPLIES: { label: 'Office Supplies', color: '#f5a623' },
  TRAINING:        { label: 'Training',        color: '#388e3c' },
  OTHER:           { label: 'Other',           color: '#6b7280' }
};

@Component({
  selector: 'app-reimbursement-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>Reimbursement</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'mine'"      (click)="onTab('mine')">My Claims</button>
        @if (canApprove()) {
          <button class="tab" [class.active]="tab() === 'approvals'" (click)="onTab('approvals')">Approvals</button>
        }
        @if (isAdmin()) {
          <button class="tab" [class.active]="tab() === 'all'"       (click)="onTab('all')">All Claims</button>
        }
      </div>
      <button class="btn btn-primary" (click)="openSubmit()">+ New claim</button>
    </div>

    <!-- Stats -->
    @if (tab() === 'mine' && stats(); as s) {
      <div class="stats-row">
        <div class="stat-tile">
          <div class="stat-tile-icon" [innerHTML]="ic.clock | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ s.pendingCount }}</div>
            <div class="stat-tile-label">Pending</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon" [innerHTML]="ic.check | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ s.approvedCount }}</div>
            <div class="stat-tile-label">Approved</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon" [innerHTML]="ic.x | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ s.rejectedCount }}</div>
            <div class="stat-tile-label">Rejected</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon" [innerHTML]="ic.money | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ formatMoney(s.approvedThisMonth, s.currency) }}</div>
            <div class="stat-tile-label">Approved this month</div>
          </div>
        </div>
      </div>
    }

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (visible().length === 0) {
      <div class="empty">
        @if (tab() === 'approvals') {
          Nothing pending. Nice.
        } @else {
          No claims yet.
          @if (tab() === 'mine') {
            <div style="margin-top: 10px;"><button class="btn btn-primary" (click)="openSubmit()">Submit your first claim</button></div>
          }
        }
      </div>
    } @else {
      @if (tab() === 'approvals') {
        <!-- Approvals: table with inline actions -->
        <div class="card" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Expense date</th>
                <th>Description</th>
                <th style="width: 280px;">Comment & action</th>
              </tr>
            </thead>
            <tbody>
              @for (e of visible(); track e.id) {
                <tr>
                  <td>
                    <strong>{{ e.employeeName }}</strong>
                    <div class="muted small">{{ e.employeeCode }}</div>
                  </td>
                  <td><span class="cat-tag" [style.background]="meta(e.category).color">{{ meta(e.category).label }}</span></td>
                  <td><strong>{{ formatMoney(e.amount, e.currency) }}</strong></td>
                  <td>{{ e.expenseDate }}</td>
                  <td>{{ e.description || '—' }}</td>
                  <td>
                    <input class="input" placeholder="Optional comment" [(ngModel)]="comments[e.id]" />
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                      <button class="btn btn-sm btn-success" (click)="approve(e)" [disabled]="busyId() === e.id">Approve</button>
                      <button class="btn btn-sm btn-danger"  (click)="reject(e)"  [disabled]="busyId() === e.id">Reject</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <!-- My claims / All claims: card grid -->
        <div class="claim-grid">
          @for (e of visible(); track e.id) {
            <div class="claim-card">
              <div class="claim-head">
                <span class="cat-tag" [style.background]="meta(e.category).color">{{ meta(e.category).label }}</span>
                <span class="badge" [class]="statusClass(e.status)">{{ e.status }}</span>
              </div>
              <div class="claim-amount">{{ formatMoney(e.amount, e.currency) }}</div>
              <div class="muted small">{{ e.expenseDate }}</div>
              @if (e.description) { <p class="claim-desc">{{ e.description }}</p> }
              @if (tab() === 'all') {
                <div class="muted small">By: <strong>{{ e.employeeName }}</strong> ({{ e.employeeCode }})</div>
              }
              @if (e.decidedByName) {
                <div class="muted small">
                  {{ e.status === 'APPROVED' ? '✓' : '✗' }} by {{ e.decidedByName }}
                  @if (e.decisionComment) { · "{{ e.decisionComment }}" }
                </div>
              }
              <div class="claim-actions">
                @if (tab() === 'mine' && e.status === 'PENDING') {
                  <button class="btn btn-sm btn-danger" (click)="onDelete(e)">Cancel</button>
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
          <h2>New reimbursement</h2>
          <button class="close-btn" (click)="closeSubmit()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Category <span class="req">*</span></label>
              <select class="select" formControlName="category">
                <option value="" disabled>Select…</option>
                @for (c of categoryList; track c.value) {
                  <option [value]="c.value">{{ c.label }}</option>
                }
              </select>
            </div>
            <div class="row two">
              <div class="field">
                <label>Amount <span class="req">*</span></label>
                <input class="input" type="number" min="0" step="0.01" formControlName="amount" />
              </div>
              <div class="field">
                <label>Currency</label>
                <select class="select" formControlName="currency">
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>Expense date <span class="req">*</span></label>
              <input class="input" type="date" formControlName="expenseDate" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea formControlName="description" rows="3" placeholder="Receipt no., context, vendor name…"></textarea>
            </div>
            @if (submitErr()) { <div class="error">{{ submitErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeSubmit()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="form.invalid || submitBusy()">
            {{ submitBusy() ? 'Submitting…' : 'Submit claim' }}
          </button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; gap: 24px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 22px; flex-wrap: wrap; }
    .page-bar h2 { margin: 0; flex: 0 0 auto; }
    .tabs { display: flex; gap: 28px; flex: 1; }
    .tab { background: transparent; border: none; padding: 6px 0; font-size: 14px; font-weight: 600; color: var(--text-soft); cursor: pointer; font-family: inherit; position: relative; }
    .tab:hover { color: var(--primary); }
    .tab.active { color: var(--primary); }
    .tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -15px; height: 3px; background: var(--primary); border-radius: 2px 2px 0 0; }
    .small { font-size: 12px; }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .cat-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.03em;
    }

    .claim-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .claim-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .claim-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .claim-head { display: flex; align-items: center; justify-content: space-between; }
    .claim-amount { font-size: 24px; font-weight: 800; color: var(--primary-deep); margin: 10px 0 2px 0; }
    .claim-desc { color: var(--text-soft); font-size: 13px; margin: 12px 0 8px 0; line-height: 1.5; }
    .claim-actions { display: flex; justify-content: flex-end; margin-top: 12px; gap: 6px; min-height: 28px; }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(540px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
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
export class ReimbursementPageComponent {
  private svc = inject(ReimbursementService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('mine');
  loading = signal(false);

  mine = signal<Expense[]>([]);
  pendingList = signal<Expense[]>([]);
  allList = signal<Expense[]>([]);
  stats = signal<ExpenseStats | null>(null);

  busyId = signal<number | null>(null);
  comments: Record<number, string> = {};

  submitOpen = signal(false);
  submitBusy = signal(false);
  submitErr = signal<string | null>(null);

  form = this.fb.group({
    category: ['' as ExpenseCategory | '', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['INR', Validators.required],
    expenseDate: [new Date().toISOString().slice(0, 10), Validators.required],
    description: ['']
  });

  categoryList = (Object.keys(CATEGORY_META) as ExpenseCategory[])
      .map(value => ({ value, label: CATEGORY_META[value].label }));

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
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    x:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() {
    this.refreshAll();
  }

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

  meta(c: ExpenseCategory) { return CATEGORY_META[c]; }

  statusClass(s: ExpenseStatus): string {
    return ({ PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected' } as Record<ExpenseStatus, string>)[s];
  }

  formatMoney(amount: number, currency: string): string {
    const symbol = ({ INR: '₹', USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[currency] ?? currency + ' ';
    return symbol + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* Submit */

  openSubmit() {
    this.submitErr.set(null);
    this.form.reset({
      category: '' as ExpenseCategory | '',
      amount: 0,
      currency: 'INR',
      expenseDate: new Date().toISOString().slice(0, 10),
      description: ''
    });
    this.submitOpen.set(true);
  }
  closeSubmit() { this.submitOpen.set(false); }

  submit() {
    if (this.form.invalid) return;
    this.submitBusy.set(true);
    this.submitErr.set(null);
    const v = this.form.value;
    this.svc.submit({
      category: v.category as ExpenseCategory,
      amount: Number(v.amount),
      currency: v.currency!,
      expenseDate: v.expenseDate!,
      description: v.description ?? undefined
    }).subscribe({
      next: () => {
        this.submitBusy.set(false);
        this.closeSubmit();
        this.refreshAll();
      },
      error: (err) => {
        this.submitErr.set(err?.error?.message ?? 'Submission failed');
        this.submitBusy.set(false);
      }
    });
  }

  /* Approvals */

  approve(e: Expense) { this.decide(e, 'approve'); }
  reject(e: Expense)  { this.decide(e, 'reject');  }

  private decide(e: Expense, kind: 'approve' | 'reject') {
    this.busyId.set(e.id);
    const obs = kind === 'approve'
      ? this.svc.approve(e.id, this.comments[e.id])
      : this.svc.reject(e.id, this.comments[e.id]);
    obs.subscribe({
      next: () => { this.busyId.set(null); delete this.comments[e.id]; this.refreshAll(); },
      error: (err) => { alert(err?.error?.message ?? 'Action failed'); this.busyId.set(null); }
    });
  }

  /* Cancel own pending */

  onDelete(e: Expense) {
    if (!confirm('Cancel this pending claim?')) return;
    this.svc.delete(e.id).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Cancel failed')
    });
  }
}
