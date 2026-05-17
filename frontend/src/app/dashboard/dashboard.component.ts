import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AttendanceService } from '../core/attendance.service';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { HolidayService } from '../core/holiday.service';
import { LeaveService } from '../core/leave.service';
import { AttendanceRecord, Holiday, Leave, LeaveBalance, Role } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

interface ModuleTile {
  title: string;
  link?: string;
  icon: string;
  roles?: Role[];
  comingSoon?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, SafeHtmlPipe],
  template: `
    <div class="dash-grid">
      <!-- Left/main column -->
      <div class="left-col">
        <!-- Hero card -->
        <div class="hero-card">
          <div class="hero-text">
            <div class="hero-eyebrow">{{ today() }}</div>
            <h1 class="hero-title">Power Through the Day! 🚀</h1>
            <p class="hero-sub">Welcome back, <strong>{{ firstName() }}</strong>. Keep the energy high and the progress steady.</p>
          </div>
          <div class="hero-illust" [innerHTML]="heroIllust | safeHtml"></div>
        </div>

        <!-- Recent / All Apps grid -->
        <div class="card section-card">
          <div class="section-header">
            <h3>All Modules</h3>
            <span class="muted" style="font-size: 12px;">{{ visibleModules().length }} apps</span>
          </div>
          <div class="apps-grid">
            @for (m of visibleModules(); track m.title) {
              @if (m.link && !m.comingSoon) {
                <a class="app-tile" [routerLink]="m.link">
                  <div class="app-tile-icon" [innerHTML]="m.icon | safeHtml"></div>
                  <div class="app-tile-label">{{ m.title }}</div>
                </a>
              } @else {
                <div class="app-tile disabled" title="Coming soon">
                  <div class="app-tile-icon" [innerHTML]="m.icon | safeHtml"></div>
                  <div class="app-tile-label">{{ m.title }}</div>
                </div>
              }
            }
          </div>
        </div>

        <!-- Stats row -->
        <div class="stats-row">
          <div class="stat-tile">
            <div class="stat-tile-icon" [innerHTML]="ic.users | safeHtml"></div>
            <div>
              <div class="stat-tile-value">{{ employeeCount() }}</div>
              <div class="stat-tile-label">Employees</div>
            </div>
          </div>
          @for (b of balances(); track b.type) {
            <div class="stat-tile">
              <div class="stat-tile-icon" [innerHTML]="ic.leaf | safeHtml"></div>
              <div>
                <div class="stat-tile-value">{{ b.remaining }}</div>
                <div class="stat-tile-label">{{ b.type }} remaining</div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Right rail -->
      <div class="right-col">
        <!-- "Let's Get to Work" punch card -->
        <div class="card punch-card">
          <div class="punch-header">Let's Get to Work</div>
          <div class="punch-row">
            <div class="punch-date">{{ todayShort() }}</div>
            <div class="punch-time">{{ workedDuration() }}</div>
          </div>
          <div class="punch-shift muted">Shift: 09:30 – 18:45</div>
          @if (todayRecord()) {
            <div class="punch-status">
              <span class="badge badge-present">Checked in {{ formatTime(todayRecord()!.checkIn) }}</span>
              @if (todayRecord()!.checkOut) {
                <span class="badge badge-leave" style="margin-left: 6px;">Out {{ formatTime(todayRecord()!.checkOut) }}</span>
              }
              @if (todayRecord()!.late) { <span class="badge badge-late" style="margin-left: 6px;">Late</span> }
            </div>
          }
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            @if (!todayRecord()?.checkIn) {
              <button class="btn btn-primary" (click)="checkIn()" [disabled]="punchBusy()">Check in</button>
            }
            @if (todayRecord()?.checkIn && !todayRecord()?.checkOut) {
              <button class="btn" (click)="checkOut()" [disabled]="punchBusy()">Check out</button>
            }
            <a class="btn" routerLink="/attendance/me">View calendar</a>
          </div>
        </div>

        <!-- Requests pastel cards -->
        <div class="card">
          <div class="section-header"><h3>Requests</h3></div>
          <div class="qa-grid">
            <a class="quick-action qa-pink" routerLink="/leaves/apply">
              <div class="quick-action-icon" [innerHTML]="ic.apply | safeHtml"></div>
              <div class="quick-action-label">Apply Leave</div>
            </a>
            @if (canApprove()) {
              <a class="quick-action qa-blue" routerLink="/leaves/approvals">
                <div class="quick-action-icon" [innerHTML]="ic.checklist | safeHtml"></div>
                <div class="quick-action-label">Approvals <span class="muted" style="font-size: 11px;">({{ approvalsCount() }})</span></div>
              </a>
            } @else {
              <a class="quick-action qa-blue" routerLink="/leaves/me">
                <div class="quick-action-icon" [innerHTML]="ic.leaves | safeHtml"></div>
                <div class="quick-action-label">My Leaves</div>
              </a>
            }
            <a class="quick-action qa-tan" routerLink="/holidays">
              <div class="quick-action-icon" [innerHTML]="ic.cal | safeHtml"></div>
              <div class="quick-action-label">Holiday Calendar</div>
            </a>
            <a class="quick-action qa-violet" routerLink="/attendance/me">
              <div class="quick-action-icon" [innerHTML]="ic.attendance | safeHtml"></div>
              <div class="quick-action-label">My Attendance</div>
            </a>
          </div>
        </div>

        <!-- Upcoming holidays -->
        <div class="card">
          <div class="section-header"><h3>Upcoming Holidays</h3></div>
          @if (upcomingHolidays().length === 0) {
            <div class="muted" style="font-size: 13px;">No upcoming holidays.</div>
          } @else {
            @for (h of upcomingHolidays(); track h.id) {
              <div class="upcoming-row">
                <div class="upcoming-date">
                  <div class="up-month">{{ monthShort(h.date) }}</div>
                  <div class="up-day">{{ dayOf(h.date) }}</div>
                </div>
                <div>
                  <div class="upcoming-name">{{ h.name }}</div>
                  <div class="muted" style="font-size: 11px;">{{ weekdayShort(h.date) }} · {{ daysUntil(h.date) }}</div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dash-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 20px;
    }
    @media (max-width: 1024px) { .dash-grid { grid-template-columns: 1fr; } }

    .left-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    .right-col { display: flex; flex-direction: column; gap: 16px; }

    .hero-card {
      background: linear-gradient(135deg, #2566e8 0%, #4f8af1 70%, #6c5ce7 100%);
      color: #fff;
      border-radius: 16px;
      padding: 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      box-shadow: 0 10px 30px rgba(37, 102, 232, 0.25);
      overflow: hidden;
      position: relative;
    }
    .hero-card::before {
      content: '';
      position: absolute;
      width: 360px; height: 360px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
      top: -120px; right: -100px;
    }
    .hero-text { position: relative; z-index: 1; }
    .hero-eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #c8d8fc;
    }
    .hero-title {
      color: #fff;
      font-size: 26px;
      margin: 6px 0 8px 0;
      letter-spacing: -0.015em;
    }
    .hero-sub {
      color: #d0deff;
      font-size: 14px;
      margin: 0;
      max-width: 480px;
    }
    .hero-illust {
      flex-shrink: 0;
      width: 160px;
      color: rgba(255,255,255,0.95);
      position: relative;
      z-index: 1;
    }
    .hero-illust ::ng-deep svg { width: 100%; height: auto; }

    .section-card { padding: 22px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-header h3 { margin: 0; }

    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    /* Punch card */
    .punch-card {
      background: linear-gradient(135deg, #ffffff 0%, #f3f7ff 100%);
      border: 1px solid var(--primary-soft-hover);
    }
    .punch-header { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
    .punch-row { display: flex; justify-content: space-between; align-items: baseline; }
    .punch-date { font-size: 14px; font-weight: 600; }
    .punch-time { font-size: 26px; font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .punch-shift { font-size: 12px; margin-top: 4px; }
    .punch-status { margin-top: 12px; }

    /* Quick action grid */
    .qa-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    /* Upcoming holiday rows */
    .upcoming-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .upcoming-row:last-child { border-bottom: none; }
    .upcoming-date {
      width: 44px; height: 48px;
      flex-shrink: 0;
      border-radius: 8px;
      background: var(--primary-soft);
      color: var(--primary);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0;
    }
    .up-month { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
    .up-day { font-size: 16px; font-weight: 800; line-height: 1.1; }
    .upcoming-name { font-size: 13px; font-weight: 600; }
  `]
})
export class DashboardComponent {
  auth = inject(AuthService);
  private employees = inject(EmployeeService);
  private leaves = inject(LeaveService);
  private attendance = inject(AttendanceService);
  private holidays = inject(HolidayService);

  employeeCount = signal(0);
  myLeaves = signal<Leave[]>([]);
  approvals = signal<Leave[]>([]);
  balances = signal<LeaveBalance[]>([]);
  todayRecord = signal<AttendanceRecord | null>(null);
  allHolidays = signal<Holiday[]>([]);
  punchBusy = signal(false);

  approvalsCount = computed(() => this.approvals().length);
  canApprove = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));
  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  today = signal(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  todayShort = signal(new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }));

  firstName = computed(() => {
    const e = this.auth.user()?.employee;
    return e ? e.firstName : (this.auth.user()?.email ?? '');
  });

  workedDuration = computed(() => {
    const r = this.todayRecord();
    if (!r || !r.checkIn) return '00:00:00';
    const out = r.checkOut ? new Date(r.checkOut) : new Date();
    const ms = out.getTime() - new Date(r.checkIn).getTime();
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  });

  upcomingHolidays = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return this.allHolidays()
      .filter(h => new Date(h.date + 'T00:00:00') >= today)
      .slice(0, 3);
  });

  // Hero illustration (inline SVG)
  heroIllust = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="100" cy="80" r="50" fill="rgba(255,255,255,0.08)" stroke="none"/>
    <path d="M70 90 Q100 50 130 90" stroke-width="2.5"/>
    <circle cx="100" cy="65" r="14" fill="rgba(255,255,255,0.2)" stroke-width="2"/>
    <path d="M85 95 L85 115 M115 95 L115 115" stroke-width="2.5"/>
    <path d="M70 130 L130 130" stroke-width="2.5"/>
    <path d="M50 60 L40 50 M150 60 L160 50" stroke-width="2"/>
    <circle cx="40" cy="50" r="3" fill="currentColor"/>
    <circle cx="160" cy="50" r="3" fill="currentColor"/>
    <circle cx="170" cy="100" r="2" fill="currentColor"/>
    <circle cx="30" cy="100" r="2" fill="currentColor"/>
  </svg>`;

  ic = {
    users:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    leaf:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-3.4 2.7-7 7-9 4.3 2 7 5.6 7 9a7 7 0 0 1-7 7Z"/></svg>`,
    apply:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
    leaves:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    checklist:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    cal:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  };

  // Module tiles (small icons in apps grid)
  modules: ModuleTile[] = [
    { title: 'Employees',          link: '/employees',          icon: this.tileSvg('users') },
    { title: 'My Attendance',      link: '/attendance/me',      icon: this.tileSvg('clock') },
    { title: 'Apply Leave',        link: '/leaves/apply',       icon: this.tileSvg('apply') },
    { title: 'My Leaves',          link: '/leaves/me',          icon: this.tileSvg('leaf') },
    { title: 'Approvals',          link: '/leaves/approvals',   icon: this.tileSvg('check'),    roles: ['ADMIN', 'MANAGER'] },
    { title: 'Team Attendance',    link: '/attendance/team',    icon: this.tileSvg('team'),     roles: ['MANAGER'] },
    { title: 'All Attendance',     link: '/attendance/all',     icon: this.tileSvg('clock'),    roles: ['ADMIN'] },
    { title: 'Holidays',           link: '/holidays',           icon: this.tileSvg('cal') },
    { title: 'Payroll',            link: '/payroll',           icon: this.tileSvg('money') },
    { title: 'Performance',        icon: this.tileSvg('chart'),       comingSoon: true },
    { title: 'Documents',          icon: this.tileSvg('docs'),        comingSoon: true },
    { title: 'Helpdesk',           icon: this.tileSvg('headset'),     comingSoon: true },
  ];

  visibleModules = computed(() => {
    const role = this.auth.role();
    return this.modules.filter(m => !m.roles || (role !== null && (m.roles as Role[]).includes(role)));
  });

  constructor() {
    this.employees.list().subscribe(list => this.employeeCount.set(list.length));
    this.leaves.myLeaves().subscribe(list => this.myLeaves.set(list));
    this.leaves.myBalance().subscribe(b => this.balances.set(b));
    this.attendance.today().subscribe(r => this.todayRecord.set(r));
    this.holidays.list(new Date().getFullYear()).subscribe(h => this.allHolidays.set(h));
    if (this.canApprove()) {
      this.leaves.pending().subscribe(list => this.approvals.set(list));
    }
  }

  checkIn() {
    this.punchBusy.set(true);
    this.attendance.checkIn().subscribe({
      next: r => { this.todayRecord.set(r); this.punchBusy.set(false); },
      error: () => this.punchBusy.set(false)
    });
  }
  checkOut() {
    this.punchBusy.set(true);
    this.attendance.checkOut().subscribe({
      next: r => { this.todayRecord.set(r); this.punchBusy.set(false); },
      error: () => this.punchBusy.set(false)
    });
  }

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  monthShort(iso: string): string { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }); }
  dayOf(iso: string): number { return new Date(iso + 'T00:00:00').getDate(); }
  weekdayShort(iso: string): string { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }); }
  daysUntil(iso: string): string {
    const days = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  private tileSvg(kind: string): string {
    const map: Record<string, string> = {
      users:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      clock:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      apply:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
      leaf:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-3.4 2.7-7 7-9 4.3 2 7 5.6 7 9a7 7 0 0 1-7 7Z"/></svg>`,
      check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      team:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
      cal:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      money:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
      chart:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>`,
      docs:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      headset:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3z"/></svg>`,
    };
    return map[kind] ?? map['cal'];
  }
}
