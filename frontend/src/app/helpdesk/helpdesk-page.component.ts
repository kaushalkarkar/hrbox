import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { HelpdeskService } from '../core/helpdesk.service';
import {
  Employee, Ticket, TicketCategory, TicketPriority, TicketStats, TicketStatus
} from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'mine' | 'assigned' | 'all';

const CATEGORY_COLOR: Record<TicketCategory, string> = {
  IT:       '#2566e8',
  HR:       '#e91e63',
  PAYROLL:  '#5e35b1',
  FACILITY: '#388e3c',
  SECURITY: '#b34700',
  OTHER:    '#6b7280',
};

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  LOW:    '#6b7280',
  MEDIUM: '#0288d1',
  HIGH:   '#f5a623',
  URGENT: '#c62828',
};

@Component({
  selector: 'app-helpdesk-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>Helpdesk</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'mine'"     (click)="onTab('mine')">My Tickets</button>
        <button class="tab" [class.active]="tab() === 'assigned'" (click)="onTab('assigned')">Assigned to Me</button>
        @if (isAdmin()) {
          <button class="tab" [class.active]="tab() === 'all'"      (click)="onTab('all')">All Tickets</button>
        }
      </div>
      <button class="btn btn-primary" (click)="openCreate()">+ Raise ticket</button>
    </div>

    <!-- Stats for admin -->
    @if (tab() === 'all' && isAdmin() && stats(); as s) {
      <div class="stats-row" style="margin-bottom: 18px;">
        <div class="stat-tile"><div class="stat-tile-icon st-open" [innerHTML]="ic.clock | safeHtml"></div><div><div class="stat-tile-value">{{ s.openCount }}</div><div class="stat-tile-label">Open</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon st-ip"   [innerHTML]="ic.gears | safeHtml"></div><div><div class="stat-tile-value">{{ s.inProgressCount }}</div><div class="stat-tile-label">In progress</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon st-ok"   [innerHTML]="ic.check | safeHtml"></div><div><div class="stat-tile-value">{{ s.resolvedCount }}</div><div class="stat-tile-label">Resolved</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon st-cl"   [innerHTML]="ic.archive | safeHtml"></div><div><div class="stat-tile-value">{{ s.closedCount }}</div><div class="stat-tile-label">Closed</div></div></div>
      </div>
    }

    <div class="layout">
      <!-- List -->
      <div class="list-col">
        @if (loading()) {
          <div class="empty">Loading…</div>
        } @else if (visible().length === 0) {
          <div class="empty">
            @if (tab() === 'mine') { No tickets raised yet. }
            @else if (tab() === 'assigned') { Nothing assigned to you. }
            @else { No tickets in the system. }
          </div>
        } @else {
          @for (t of visible(); track t.id) {
            <button class="ticket-row" [class.active]="selectedId() === t.id" (click)="select(t.id)">
              <div class="ticket-row-top">
                <span class="cat-tag" [style.background]="catColor(t.category)">{{ t.category }}</span>
                <span class="pri-tag" [style.background]="priColor(t.priority)">{{ t.priority }}</span>
                <span class="badge" [class]="statusBadge(t.status)">{{ formatStatus(t.status) }}</span>
              </div>
              <div class="ticket-subj">#{{ t.id }} · {{ t.subject }}</div>
              <div class="muted small">
                Raised by <strong>{{ t.raisedByName }}</strong> · {{ timeAgo(t.createdAt) }}
                @if (t.assigneeName) { · Assigned to <strong>{{ t.assigneeName }}</strong> }
              </div>
            </button>
          }
        }
      </div>

      <!-- Detail -->
      <div class="detail-col">
        @if (selected(); as t) {
          <div class="card detail-card">
            <div class="detail-head">
              <div class="detail-tags">
                <span class="cat-tag" [style.background]="catColor(t.category)">{{ t.category }}</span>
                <span class="pri-tag" [style.background]="priColor(t.priority)">{{ t.priority }}</span>
                <span class="badge" [class]="statusBadge(t.status)">{{ formatStatus(t.status) }}</span>
              </div>
              <div class="muted small">#{{ t.id }} · {{ formatDate(t.createdAt) }}</div>
            </div>

            <h2 style="margin: 12px 0 4px 0;">{{ t.subject }}</h2>
            <div class="muted small">
              Raised by <strong>{{ t.raisedByName }}</strong> ({{ t.raisedByCode }})
            </div>

            <p class="ticket-desc">{{ t.description }}</p>

            @if (t.assigneeName) {
              <div class="muted small">
                Assigned to <strong>{{ t.assigneeName }}</strong>
              </div>
            }
            @if (t.resolution) {
              <div class="resolution">
                <div class="muted small" style="margin-bottom: 6px;">Resolution</div>
                <div>{{ t.resolution }}</div>
              </div>
            }
            @if (t.resolvedAt) {
              <div class="muted small">Resolved at {{ formatDate(t.resolvedAt) }}</div>
            }

            <!-- Admin: assign -->
            @if (isAdmin()) {
              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border);">
                <label class="muted small">Assign to</label>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                  <select class="select" [(ngModel)]="assigneeChoice" style="flex: 1;">
                    <option [ngValue]="null">— Unassigned —</option>
                    @for (e of employees(); track e.id) {
                      <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                    }
                  </select>
                  <button class="btn" (click)="doAssign(t)">Save</button>
                </div>
              </div>
            }

            <!-- Update status (assignee or raiser) -->
            @if (canUpdateStatus(t)) {
              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border);">
                <label class="muted small">Update status</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
                  <select class="select" [(ngModel)]="statusChoice">
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                  <button class="btn btn-primary" (click)="doStatus(t)">Update</button>
                </div>
                <div class="field" style="margin-top: 8px;">
                  <textarea [(ngModel)]="resolutionDraft" rows="3" placeholder="Resolution note (shown to the requester)"></textarea>
                </div>
              </div>
            }

            <!-- Delete for owner while OPEN, or admin -->
            @if (canDelete(t)) {
              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border); text-align: right;">
                <button class="btn btn-sm btn-danger" (click)="onDelete(t)">Delete ticket</button>
              </div>
            }
          </div>
        } @else {
          <div class="empty">Pick a ticket on the left to view details.</div>
        }
      </div>
    </div>

    <!-- Create drawer -->
    @if (createOpen()) {
      <div class="drawer-backdrop" (click)="closeCreate()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>Raise a ticket</h2>
          <button class="close-btn" (click)="closeCreate()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="row two">
              <div class="field">
                <label>Category <span class="req">*</span></label>
                <select class="select" formControlName="category">
                  <option value="" disabled>Select…</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="PAYROLL">Payroll</option>
                  <option value="FACILITY">Facility</option>
                  <option value="SECURITY">Security</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div class="field">
                <label>Priority <span class="req">*</span></label>
                <select class="select" formControlName="priority">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>Subject <span class="req">*</span></label>
              <input class="input" formControlName="subject" placeholder="Short summary" />
            </div>
            <div class="field">
              <label>Description <span class="req">*</span></label>
              <textarea formControlName="description" rows="6" placeholder="What happened? Steps to reproduce? Impact?"></textarea>
            </div>
            @if (createErr()) { <div class="error">{{ createErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeCreate()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="form.invalid || createBusy()">
            {{ createBusy() ? 'Submitting…' : 'Submit ticket' }}
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

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .st-open { background: #fff4d6; color: #8a5a00; }
    .st-ip   { background: #e0ecff; color: #1d4ed8; }
    .st-ok   { background: var(--primary-soft); color: var(--primary-deep); }
    .st-cl   { background: #eceef1; color: #4b5563; }

    .layout {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) minmax(420px, 1.4fr);
      gap: 16px;
      align-items: flex-start;
    }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

    .list-col { display: flex; flex-direction: column; gap: 10px; }
    .ticket-row {
      width: 100%;
      display: flex; flex-direction: column; gap: 6px;
      padding: 14px;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }
    .ticket-row:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary); }
    .ticket-row.active { border-color: var(--primary); background: var(--primary-soft); }
    .ticket-row-top { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .ticket-subj { font-weight: 700; font-size: 14px; }

    .cat-tag, .pri-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.03em;
    }

    .detail-card { padding: 24px; }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
    .detail-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .ticket-desc { color: var(--text-soft); white-space: pre-wrap; margin: 14px 0; line-height: 1.55; }
    .resolution {
      margin-top: 14px;
      padding: 12px;
      background: var(--surface-soft);
      border-left: 4px solid var(--success);
      border-radius: 6px;
    }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
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
export class HelpdeskPageComponent {
  private svc = inject(HelpdeskService);
  private employeeSvc = inject(EmployeeService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('mine');
  loading = signal(false);

  mine = signal<Ticket[]>([]);
  assigned = signal<Ticket[]>([]);
  allList = signal<Ticket[]>([]);
  stats = signal<TicketStats | null>(null);
  employees = signal<Employee[]>([]);

  selectedId = signal<number | null>(null);
  selected = signal<Ticket | null>(null);

  assigneeChoice: number | null = null;
  statusChoice: TicketStatus = 'IN_PROGRESS';
  resolutionDraft = '';

  createOpen = signal(false);
  createBusy = signal(false);
  createErr = signal<string | null>(null);
  form = this.fb.group({
    category: ['' as TicketCategory | '', Validators.required],
    priority: ['MEDIUM' as TicketPriority, Validators.required],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.required]
  });

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  visible = computed(() => {
    switch (this.tab()) {
      case 'mine':     return this.mine();
      case 'assigned': return this.assigned();
      case 'all':      return this.allList();
    }
  });

  ic = {
    clock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    gears:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 21h0a2 2 0 0 1-4 0v0a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 14h0a2 2 0 0 1 0-4h0a1.65 1.65 0 0 0 1.51-1A1.65 1.65 0 0 0 4.18 7.18l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51v0a2 2 0 0 1 4 0v0a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h0a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    close:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() {
    this.refresh();
    if (this.isAdmin()) {
      this.employeeSvc.list().subscribe(e => this.employees.set(e));
      this.svc.stats().subscribe(s => this.stats.set(s));
    }
  }

  refresh() {
    this.loading.set(true);
    this.svc.mine().subscribe({
      next: t => { this.mine.set(t); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.svc.assignedToMe().subscribe(t => this.assigned.set(t));
    if (this.isAdmin()) this.svc.all().subscribe(t => this.allList.set(t));
  }

  onTab(t: Tab) { this.tab.set(t); }

  select(id: number) {
    this.selectedId.set(id);
    this.svc.get(id).subscribe(t => {
      this.selected.set(t);
      this.assigneeChoice = t.assigneeId;
      this.statusChoice = t.status === 'OPEN' ? 'IN_PROGRESS' : t.status;
      this.resolutionDraft = t.resolution ?? '';
    });
  }

  catColor(c: TicketCategory) { return CATEGORY_COLOR[c]; }
  priColor(p: TicketPriority) { return PRIORITY_COLOR[p]; }

  statusBadge(s: TicketStatus): string {
    return ({
      OPEN: 'badge-pending',
      IN_PROGRESS: 'badge-leave',
      RESOLVED: 'badge-approved',
      CLOSED: 'badge-weekend'
    } as Record<TicketStatus, string>)[s];
  }
  formatStatus(s: TicketStatus): string { return s.replace('_', ' '); }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  canUpdateStatus(t: Ticket): boolean {
    if (this.isAdmin()) return true;
    const myId = this.auth.user()?.employee?.id;
    if (!myId) return false;
    return myId === t.assigneeId || myId === t.raisedById;
  }
  canDelete(t: Ticket): boolean {
    if (this.isAdmin()) return true;
    const myId = this.auth.user()?.employee?.id;
    return myId === t.raisedById && t.status === 'OPEN';
  }

  /* Create */

  openCreate() {
    this.createErr.set(null);
    this.form.reset({ category: '' as TicketCategory | '', priority: 'MEDIUM' as TicketPriority, subject: '', description: '' });
    this.createOpen.set(true);
  }
  closeCreate() { this.createOpen.set(false); }
  submit() {
    if (this.form.invalid) return;
    this.createBusy.set(true);
    this.createErr.set(null);
    const v = this.form.value;
    this.svc.create({
      category: v.category as TicketCategory,
      priority: v.priority as TicketPriority,
      subject: v.subject!,
      description: v.description!
    }).subscribe({
      next: () => { this.createBusy.set(false); this.closeCreate(); this.refresh(); },
      error: (err) => { this.createErr.set(err?.error?.message ?? 'Failed to create ticket'); this.createBusy.set(false); }
    });
  }

  /* Admin: assign */
  doAssign(t: Ticket) {
    this.svc.assign(t.id, this.assigneeChoice).subscribe({
      next: (updated) => { this.selected.set(updated); this.refresh(); },
      error: (err) => alert(err?.error?.message ?? 'Assignment failed')
    });
  }

  /* Status update */
  doStatus(t: Ticket) {
    this.svc.updateStatus(t.id, this.statusChoice, this.resolutionDraft || undefined).subscribe({
      next: (updated) => { this.selected.set(updated); this.refresh(); },
      error: (err) => alert(err?.error?.message ?? 'Update failed')
    });
  }

  onDelete(t: Ticket) {
    if (!confirm(`Delete ticket #${t.id}: "${t.subject}"?`)) return;
    this.svc.delete(t.id).subscribe({
      next: () => { this.selected.set(null); this.selectedId.set(null); this.refresh(); },
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }
}
