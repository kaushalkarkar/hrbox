import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TaskBoxService } from '../core/taskbox.service';
import { TaskBoxView, TaskItem, TaskType } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

const TYPE_META: Record<TaskType, { label: string; icon: string; color: string; }> = {
  LEAVE_APPROVAL:    { label: 'Leave approval',        icon: 'leaf',      color: '#43a047' },
  EXPENSE_APPROVAL:  { label: 'Reimbursement',         icon: 'money',     color: '#f5a623' },
  TRAVEL_APPROVAL:   { label: 'Travel approval',       icon: 'plane',     color: '#2566e8' },
  TICKET_ASSIGNED:   { label: 'Ticket assigned to me', icon: 'headset',   color: '#5e35b1' },
  POLICY_ACK:        { label: 'Policy to acknowledge', icon: 'book',      color: '#6c5ce7' },
  MY_LEAVE:          { label: 'My leave',              icon: 'leaf',      color: '#6b7280' },
  MY_EXPENSE:        { label: 'My reimbursement',      icon: 'money',     color: '#6b7280' },
  MY_TRAVEL:         { label: 'My travel',             icon: 'plane',     color: '#6b7280' },
};

@Component({
  selector: 'app-taskbox-page',
  standalone: true,
  imports: [RouterLink, SafeHtmlPipe, NgTemplateOutlet],
  template: `
    <div class="page-bar">
      <div>
        <h2>Task Box</h2>
        <div class="muted" style="margin-top: 4px;">Everything that needs your attention, in one place.</div>
      </div>
      <button class="btn" (click)="refresh()">Refresh</button>
    </div>

    <!-- Top stats -->
    @if (data(); as d) {
      <div class="stats-row" style="margin-bottom: 18px;">
        <div class="stat-tile big">
          <div class="stat-tile-icon stat-total" [innerHTML]="ic.inbox | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ d.total }}</div>
            <div class="stat-tile-label">Total pending</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon stat-approval" [innerHTML]="ic.check | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ d.approvals.length }}</div>
            <div class="stat-tile-label">Awaiting your approval</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon stat-tickets" [innerHTML]="ic.headset | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ d.assignedToMe.length }}</div>
            <div class="stat-tile-label">Tickets assigned to you</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon stat-policy" [innerHTML]="ic.book | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ d.policyAcks.length }}</div>
            <div class="stat-tile-label">Policies to acknowledge</div>
          </div>
        </div>
        <div class="stat-tile">
          <div class="stat-tile-icon stat-mine" [innerHTML]="ic.clock | safeHtml"></div>
          <div>
            <div class="stat-tile-value">{{ d.myPending.length }}</div>
            <div class="stat-tile-label">Your own pending</div>
          </div>
        </div>
      </div>

      @if (d.total === 0) {
        <div class="empty zero">
          <div style="font-size: 48px;">🎉</div>
          <h3 style="margin: 10px 0 4px 0;">All caught up</h3>
          <div class="muted">Nothing pending. Take a breather.</div>
        </div>
      } @else {
        @if (d.approvals.length > 0) {
          <ng-container *ngTemplateOutlet="sectionTpl; context: { title: 'Approvals awaiting you', list: d.approvals }"></ng-container>
        }
        @if (d.assignedToMe.length > 0) {
          <ng-container *ngTemplateOutlet="sectionTpl; context: { title: 'Tickets assigned to you', list: d.assignedToMe }"></ng-container>
        }
        @if (d.policyAcks.length > 0) {
          <ng-container *ngTemplateOutlet="sectionTpl; context: { title: 'Policies to acknowledge', list: d.policyAcks }"></ng-container>
        }
        @if (d.myPending.length > 0) {
          <ng-container *ngTemplateOutlet="sectionTpl; context: { title: 'Your own pending items', list: d.myPending }"></ng-container>
        }
      }
    } @else {
      <div class="empty">Loading…</div>
    }

    <ng-template #sectionTpl let-title="title" let-list="list">
      <div class="section">
        <h3 class="section-title">{{ title }} <span class="muted small">({{ list.length }})</span></h3>
        <div class="task-list">
          @for (t of list; track t.type + '-' + t.id) {
            <button class="task-row" (click)="goto(t)">
              <span class="type-pill" [style.background]="meta(t.type).color">
                <span [innerHTML]="iconFor(meta(t.type).icon) | safeHtml"></span>
                {{ meta(t.type).label }}
              </span>
              <div class="task-text">
                <div class="task-title">{{ t.title }}</div>
                <div class="muted small task-sub">{{ t.subtitle }}</div>
              </div>
              <div class="task-side">
                <span class="status-pill" [class]="'pill-' + t.pillColor">{{ formatStatus(t.status) }}</span>
                <div class="muted small">{{ timeAgo(t.createdAt) }}</div>
              </div>
              <span class="task-arrow">›</span>
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
    .page-bar h2 { margin: 0; }
    .small { font-size: 12px; }

    .stats-row {
      display: grid;
      grid-template-columns: 1.4fr repeat(4, 1fr);
      gap: 14px;
    }
    @media (max-width: 900px) { .stats-row { grid-template-columns: 1fr 1fr; } }
    .stat-tile.big .stat-tile-value { font-size: 32px; color: var(--primary); }
    .stat-tile.big .stat-tile-icon { width: 56px; height: 56px; }
    .stat-tile.big .stat-tile-icon svg { width: 28px; height: 28px; }

    .stat-total    { background: var(--primary-soft);    color: var(--primary-deep); }
    .stat-approval { background: #fff4d6;                color: #8a5a00; }
    .stat-tickets  { background: #ece5fc;                color: #4527a0; }
    .stat-policy   { background: #e0ecff;                color: #1d4ed8; }
    .stat-mine     { background: #eceef1;                color: #4b5563; }

    .section { margin-bottom: 22px; }
    .section-title { margin: 6px 0 12px 0; font-size: 16px; }

    .task-list {
      display: flex; flex-direction: column; gap: 8px;
    }
    .task-row {
      display: grid;
      grid-template-columns: minmax(180px, 220px) 1fr minmax(150px, auto) 16px;
      gap: 16px;
      align-items: center;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }
    .task-row:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary); }
    @media (max-width: 700px) {
      .task-row { grid-template-columns: 1fr; }
      .task-arrow { display: none; }
    }
    .type-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      color: #fff;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.02em;
      width: fit-content;
    }
    .type-pill svg { width: 14px; height: 14px; }
    .task-text { min-width: 0; }
    .task-title { font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
    .task-sub { margin-top: 2px; }
    .task-side {
      display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    }
    .status-pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
    }
    .pill-amber  { background: #fff4d6; color: #8a5a00; }
    .pill-red    { background: #fde4e4; color: var(--danger); }
    .pill-blue   { background: #e0ecff; color: #1d4ed8; }
    .pill-violet { background: #ece5fc; color: #4527a0; }
    .pill-gray   { background: #eceef1; color: #4b5563; }
    .task-arrow { color: var(--muted); font-size: 22px; line-height: 1; }

    .zero { padding: 60px 20px; text-align: center; }
    .zero h3 { color: var(--primary-deep); }
  `]
})
export class TaskBoxPageComponent {
  private svc = inject(TaskBoxService);
  private router = inject(Router);

  data = signal<TaskBoxView | null>(null);

  ic = {
    inbox:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    headset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3z"/></svg>`,
    book:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    clock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    leaf:    `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11 20A7 7 0 0 1 4 13c0-3.4 2.7-7 7-9 4.3 2 7 5.6 7 9a7 7 0 0 1-7 7z"/></svg>`,
    money:   `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg>`,
    plane:   `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/></svg>`,
  };

  constructor() { this.refresh(); }

  refresh() {
    this.svc.get().subscribe(d => this.data.set(d));
  }

  meta(type: TaskType) { return TYPE_META[type]; }
  iconFor(name: string): string { return (this.ic as Record<string, string>)[name] ?? ''; }

  formatStatus(s: string): string { return s.replace(/_/g, ' '); }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  goto(t: TaskItem) { this.router.navigateByUrl(t.link); }
}
