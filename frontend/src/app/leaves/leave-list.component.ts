import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HolidayService } from '../core/holiday.service';
import { LeaveService } from '../core/leave.service';
import { Holiday, Leave, LeaveBalance } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'balance' | 'holidays' | 'history';

interface CardSkin {
  border: string;
  numberColor: string;
  iconBg: string;
  iconColor: string;
}

@Component({
  selector: 'app-leave-list',
  standalone: true,
  imports: [RouterLink, FormsModule, SafeHtmlPipe],
  template: `
    <!-- Page header with tabs -->
    <div class="leave-header">
      <h2>Leave</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'balance'"  (click)="tab.set('balance')">Leave Balance</button>
        <button class="tab" [class.active]="tab() === 'holidays'" (click)="tab.set('holidays')">Holidays List</button>
        <button class="tab" [class.active]="tab() === 'history'"  (click)="tab.set('history')">History</button>
      </div>
      <a class="btn btn-primary request-btn" routerLink="/leaves/apply">
        Request <span class="caret" [innerHTML]="ic.caret | safeHtml"></span>
      </a>
    </div>

    @if (tab() === 'balance') {
      <!-- "My Leave Pattern" strip -->
      <div class="card pattern-strip">
        <div class="pattern-left">
          <span class="pattern-label">My Leave Pattern</span>
          <span class="info-dot" title="Your overall leave usage">i</span>
        </div>
        <div class="pattern-mid">
          <span class="muted">Leave utilized&nbsp;:&nbsp;</span>
          <span class="bar-icon" [innerHTML]="ic.bars | safeHtml"></span>
          <strong>{{ totalUsed() }}</strong>
        </div>
        <span class="chev">▾</span>
      </div>

      <!-- Balance grid header -->
      <div class="balance-head">
        <h3>Balance as of Today</h3>
        <div class="balance-search">
          <input class="input" [(ngModel)]="cardQuery" placeholder="Search" />
          <span class="search-ic" [innerHTML]="ic.search | safeHtml"></span>
        </div>
      </div>

      <!-- Leave balance cards -->
      <div class="balance-grid">
        @for (b of filteredBalances(); track b.type) {
          <div class="leave-card" [style.--stripe]="skinFor(b.type).border">
            <div class="card-top">
              <div class="card-num">{{ b.remaining }}</div>
              <div class="card-actions">
                <button class="ic-btn" routerLink="/leaves/apply" [queryParams]="{ type: b.type }" title="Apply for this leave">
                  <span [innerHTML]="ic.plus | safeHtml"></span>
                </button>
                <button class="ic-btn" title="More">
                  <span [innerHTML]="ic.kebab | safeHtml"></span>
                </button>
              </div>
            </div>
            <div class="card-type">{{ leaveLabel(b.type) }}</div>
            <div class="card-divider"></div>
            <div class="card-foot">
              <div class="foot-num">{{ b.used }}</div>
              <div class="foot-text">Used so far this year</div>
            </div>
          </div>
        }
      </div>
    }

    @if (tab() === 'holidays') {
      <div class="card">
        @if (holidaysList().length === 0) {
          <div class="empty">No holidays available.</div>
        } @else {
          <div class="hl-list">
            @for (h of holidaysList(); track h.id) {
              <div class="hl-row" [class.past]="isPast(h.date)" [class.today]="isToday(h.date)">
                <div class="hl-date">
                  <div class="hl-month">{{ monthShort(h.date) }}</div>
                  <div class="hl-day">{{ dayOf(h.date) }}</div>
                </div>
                <div class="hl-info">
                  <div class="hl-name">{{ h.name }}</div>
                  @if (h.description) { <div class="muted hl-desc">{{ h.description }}</div> }
                  <div class="muted hl-meta">{{ formatDate(h.date) }}</div>
                </div>
              </div>
            }
          </div>
        }
        <div style="margin-top: 14px; text-align: right;">
          <a class="btn" routerLink="/holidays">Manage holidays →</a>
        </div>
      </div>
    }

    @if (tab() === 'history') {
      <div class="card">
        @if (historyLoading()) {
          <div class="empty">Loading…</div>
        } @else if (history().length === 0) {
          <div class="empty">You haven't applied for any leave yet.</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Decided by</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              @for (l of history(); track l.id) {
                <tr>
                  <td>{{ leaveLabel(l.type) }}</td>
                  <td>{{ l.startDate }}</td>
                  <td>{{ l.endDate }}</td>
                  <td>{{ daysBetween(l.startDate, l.endDate) }}</td>
                  <td>{{ l.reason || '—' }}</td>
                  <td><span class="badge" [class]="statusClass(l)">{{ l.status }}</span></td>
                  <td>{{ l.decidedByName || '—' }}</td>
                  <td>{{ l.decisionComment || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  `,
  styles: [`
    .leave-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 22px;
      flex-wrap: wrap;
    }
    .leave-header h2 { margin: 0; flex: 0 0 auto; }
    .tabs { display: flex; gap: 28px; flex: 1; justify-content: center; }
    .tab {
      background: transparent;
      border: none;
      padding: 6px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-soft);
      cursor: pointer;
      font-family: inherit;
      position: relative;
      transition: color 0.12s;
    }
    .tab:hover { color: var(--primary); }
    .tab.active { color: var(--primary); }
    .tab.active::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -15px;
      height: 3px;
      background: var(--primary);
      border-radius: 2px 2px 0 0;
    }
    .request-btn { gap: 4px; }
    .request-btn .caret { display: inline-flex; }

    /* Pattern strip */
    .pattern-strip {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 18px 22px;
      margin-bottom: 22px;
    }
    .pattern-left { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
    .pattern-label { font-weight: 600; }
    .info-dot {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 1.5px solid var(--muted);
      color: var(--muted);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      font-style: italic;
    }
    .pattern-mid { display: flex; align-items: center; gap: 6px; flex: 1; }
    .bar-icon { display: inline-flex; align-items: center; }
    .pattern-mid strong { font-size: 16px; color: var(--text); }
    .chev { color: var(--muted); font-size: 16px; }

    /* Balance head */
    .balance-head {
      display: flex; justify-content: space-between; align-items: center;
      margin: 6px 4px 16px 4px;
    }
    .balance-head h3 { margin: 0; }
    .balance-search { position: relative; width: 240px; }
    .balance-search .input { padding-right: 36px; }
    .balance-search .search-ic {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      color: var(--muted); display: inline-flex;
    }

    /* Card grid */
    .balance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }
    @media (max-width: 900px) { .balance-grid { grid-template-columns: 1fr; } }

    .leave-card {
      position: relative;
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 6px solid var(--stripe, var(--primary));
      border-radius: 10px;
      padding: 22px 22px 16px 22px;
      min-height: 200px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .leave-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

    .card-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-num { font-size: 36px; font-weight: 700; color: var(--text); line-height: 1; }
    .card-actions { display: flex; gap: 6px; align-items: center; }
    .ic-btn {
      width: 28px; height: 28px;
      border: none; background: transparent;
      color: var(--text-soft);
      cursor: pointer;
      border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 0.12s, color 0.12s;
    }
    .ic-btn:hover { background: var(--surface-soft); color: var(--primary); }

    .card-type {
      margin-top: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
    }
    .card-divider {
      height: 1px;
      background: var(--border);
      margin: 18px 0 14px 0;
    }
    .foot-num { font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
    .foot-text { font-size: 13px; color: var(--muted); margin-top: 4px; }

    /* Holidays list */
    .hl-list { display: flex; flex-direction: column; gap: 10px; }
    .hl-row {
      display: flex; align-items: center; gap: 16px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface-soft);
    }
    .hl-row.past { opacity: 0.55; }
    .hl-row.today { background: var(--primary-soft); border-color: var(--primary); }
    .hl-date {
      width: 56px; flex-shrink: 0; text-align: center;
      padding: 6px;
      background: #fff; border: 1px solid var(--border); border-radius: 8px;
    }
    .hl-month { font-size: 10px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; }
    .hl-day { font-size: 18px; font-weight: 800; color: var(--text); line-height: 1; margin-top: 2px; }
    .hl-name { font-weight: 700; }
    .hl-desc, .hl-meta { font-size: 12px; margin-top: 2px; }
  `]
})
export class LeaveListComponent {
  private leaves = inject(LeaveService);
  private holidays = inject(HolidayService);
  private router = inject(Router);

  tab = signal<Tab>('balance');
  cardQuery = '';

  balances = signal<LeaveBalance[]>([]);
  history = signal<Leave[]>([]);
  historyLoading = signal(true);
  holidaysList = signal<Holiday[]>([]);

  totalUsed = computed(() => this.balances().reduce((s, b) => s + b.used, 0));

  filteredBalances = computed(() => {
    const q = this.cardQuery.trim().toLowerCase();
    if (!q) return this.balances();
    return this.balances().filter(b => this.leaveLabel(b.type).toLowerCase().includes(q));
  });

  // Color skins per leave type, matching the multi-color stripe pattern in Darwinbox
  private skins: Record<string, CardSkin> = {
    CASUAL: { border: '#e91e63', numberColor: '#e91e63', iconBg: '#fde7ec', iconColor: '#c2185b' },
    SICK:   { border: '#43a047', numberColor: '#43a047', iconBg: '#d4f5e2', iconColor: '#066b3b' },
    PAID:   { border: '#f5a623', numberColor: '#f5a623', iconBg: '#fff4d6', iconColor: '#a67400' },
  };

  ic = {
    bars:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="9"/></svg>`,
    plus:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    kebab:  `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18" r="1.6"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>`,
    caret:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>`,
  };

  constructor() {
    this.leaves.myBalance().subscribe(b => this.balances.set(b));
    this.leaves.myLeaves().subscribe({
      next: r => { this.history.set(r); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false)
    });
    this.holidays.list(new Date().getFullYear()).subscribe(h => this.holidaysList.set(h));
  }

  skinFor(type: string): CardSkin {
    return this.skins[type] ?? { border: '#6c5ce7', numberColor: '#6c5ce7', iconBg: '#ece5fc', iconColor: '#4527a0' };
  }

  leaveLabel(type: string): string {
    return ({ CASUAL: 'Casual Leave', SICK: 'Sick Leave', PAID: 'Paid Leave' } as Record<string, string>)[type] ?? type;
  }

  statusClass(l: Leave): string {
    return ({
      PENDING: 'badge-pending',
      APPROVED: 'badge-approved',
      REJECTED: 'badge-rejected'
    } as Record<string, string>)[l.status];
  }

  daysBetween(from: string, to: string): number {
    const a = new Date(from + 'T00:00:00').getTime();
    const b = new Date(to + 'T00:00:00').getTime();
    return Math.floor((b - a) / 86400000) + 1;
  }

  // Holiday helpers
  private toDate(iso: string): Date { return new Date(iso + 'T00:00:00'); }
  private startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
  isPast(iso: string): boolean { return this.toDate(iso) < this.startOfToday(); }
  isToday(iso: string): boolean { return this.toDate(iso).getTime() === this.startOfToday().getTime(); }
  monthShort(iso: string): string { return this.toDate(iso).toLocaleDateString('en-US', { month: 'short' }); }
  dayOf(iso: string): number { return this.toDate(iso).getDate(); }
  formatDate(iso: string): string {
    return this.toDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
}
