import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AttendanceService } from '../core/attendance.service';
import { AttendanceDay, AttendanceRecord, AttendanceStatus, MonthSummary } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [FormsModule, SafeHtmlPipe],
  template: `
    <!-- Page header -->
    <div class="att-header">
      <h2>Attendance</h2>
      <div class="request-wrap">
        <button class="btn request-btn">
          Request <span [innerHTML]="ic.caret | safeHtml"></span>
        </button>
      </div>
    </div>

    <!-- Metrics card (collapsible) -->
    <div class="card metrics-card" [class.collapsed]="metricsCollapsed()">
      <div class="metrics-row" (click)="toggleMetrics()">
        <div class="metrics-label">Metrics</div>
        <div class="metrics-stats">
          <div class="metric">
            <span class="metric-key muted">Avg. Work Duration:</span>
            <span class="metric-icon work" [innerHTML]="ic.barsBlue | safeHtml"></span>
            <strong>{{ avgWorkDuration() }}</strong>
          </div>
          <div class="metric">
            <span class="metric-key muted">Avg. Late By:</span>
            <span class="metric-icon late" [innerHTML]="ic.barsOrange | safeHtml"></span>
            <strong>{{ avgLateBy() }}</strong>
          </div>
        </div>
        <span class="chev" [class.flipped]="!metricsCollapsed()">▾</span>
      </div>
    </div>

    <!-- Month nav + view toggle -->
    <div class="card cal-shell">
      <div class="cal-nav">
        <button class="ic-btn" (click)="prevMonth()" title="Previous month"><span [innerHTML]="ic.arrowL | safeHtml"></span></button>
        <button class="ic-btn" (click)="nextMonth()" title="Next month"><span [innerHTML]="ic.arrowR | safeHtml"></span></button>
        <div class="month-label">{{ monthLabel() }} <span class="muted" style="font-size:14px;">▾</span></div>

        <div class="cal-actions">
          <button class="view-btn" [class.active]="view() === 'cal'" (click)="view.set('cal')" title="Calendar view">
            <span [innerHTML]="ic.calIcon | safeHtml"></span>
          </button>
          <button class="view-btn" [class.active]="view() === 'list'" (click)="view.set('list')" title="List view">
            <span [innerHTML]="ic.listIcon | safeHtml"></span>
          </button>
          <button class="view-btn" title="More"><span [innerHTML]="ic.kebab | safeHtml"></span></button>
        </div>
      </div>

      @if (errorMsg()) { <div class="error" style="padding: 0 16px 12px;">{{ errorMsg() }}</div> }

      @if (view() === 'cal') {
        <!-- Calendar grid -->
        <div class="cal-grid">
          @for (h of weekHeaders; track h) { <div class="cal-h">{{ h }}</div> }
          @for (d of calendarCells(); track d.iso) {
            <div class="cell"
                 [class.weekend]="d.status === 'WEEKEND'"
                 [class.other-month]="d.otherMonth"
                 [class.today]="d.today">
              <div class="cell-top">
                <span class="date-num" [class.today]="d.today">{{ d.dayNum }}</span>
                @if (d.day && (d.status === 'PRESENT' || d.status === 'HALF_DAY' || d.status === 'ON_LEAVE' || d.status === 'HOLIDAY')) {
                  <span class="person-ic" [class]="'pi-' + d.status" [innerHTML]="ic.personSmall | safeHtml"></span>
                }
              </div>

              <div class="cell-body">
                @if (d.day) {
                  @switch (d.status) {
                    @case ('ON_LEAVE') {
                      <span class="pill pill-leave">On Leave (Casual)</span>
                    }
                    @case ('HALF_DAY') {
                      <span class="pill pill-half">Half day{{ d.late ? ' · Late' : '' }}</span>
                    }
                    @case ('PRESENT') {
                      @if (d.late) { <span class="pill pill-late">Late · {{ formatTime(d.checkIn) }}</span> }
                      @else if (d.workingMinutes != null) { <span class="pill pill-present">Present · {{ formatHM(d.workingMinutes) }}</span> }
                    }
                    @case ('HOLIDAY') {
                      <span class="pill pill-holiday" [title]="d.note ?? ''">Holiday{{ d.note ? ': ' + d.note : '' }}</span>
                    }
                    @case ('ABSENT') {
                      @if (!d.future) { <span class="pill pill-absent">Absent</span> }
                    }
                  }
                }
              </div>

              <div class="cell-foot">
                @if (d.status === 'WEEKEND') {
                  <div class="weekly-off">
                    <span class="x-mark" [innerHTML]="ic.xMark | safeHtml"></span>
                    Weekly Off
                  </div>
                  <div class="shift muted">09:30 - 18:45</div>
                } @else if (d.day) {
                  <div class="shift muted">09:30 - 18:45</div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <!-- List view -->
        @if (days().length === 0) {
          <div class="empty">No records.</div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Worked</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              @for (d of days(); track d.date) {
                <tr>
                  <td>{{ d.date }}</td>
                  <td><span class="pill" [class]="pillClass(d.status)">{{ statusLabel(d.status) }}</span></td>
                  <td>{{ formatTime(d.checkIn) }}</td>
                  <td>{{ formatTime(d.checkOut) }}</td>
                  <td>{{ formatHM(d.workingMinutes) }}</td>
                  <td>{{ d.note ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>

    <!-- Quick punch buttons (footer) -->
    <div class="punch-bar">
      @if (todayRecord(); as t) {
        <span class="badge badge-present">Checked in {{ formatTime(t.checkIn) }}</span>
        @if (t.checkOut) { <span class="badge badge-leave" style="margin-left: 6px;">Out {{ formatTime(t.checkOut) }}</span> }
        @if (t.late) { <span class="badge badge-late" style="margin-left: 6px;">Late</span> }
      } @else {
        <span class="muted">Not punched in yet today.</span>
      }
      <span class="punch-spacer"></span>
      @if (!todayRecord()?.checkIn) {
        <button class="btn btn-primary" (click)="onCheckIn()" [disabled]="busy()">Check in</button>
      }
      @if (todayRecord()?.checkIn && !todayRecord()?.checkOut) {
        <button class="btn" (click)="onCheckOut()" [disabled]="busy()">Check out</button>
      }
    </div>
  `,
  styles: [`
    .att-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 22px;
    }
    .att-header h2 { margin: 0; }
    .request-btn { display: inline-flex; gap: 6px; }

    /* Metrics card */
    .metrics-card { padding: 0; margin-bottom: 18px; }
    .metrics-row {
      padding: 18px 22px;
      display: grid;
      grid-template-columns: 100px 1fr auto;
      align-items: center;
      gap: 24px;
      cursor: pointer;
    }
    .metrics-label { font-weight: 600; }
    .metrics-stats { display: flex; gap: 36px; flex-wrap: wrap; }
    .metric { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .metric-key { font-weight: 500; }
    .metric-icon { display: inline-flex; align-items: center; }
    .metric-icon.work { color: #2566e8; }
    .metric-icon.late { color: #f5a623; }
    .metric strong { color: var(--text); font-size: 15px; }
    .chev {
      color: var(--muted);
      font-size: 14px;
      transition: transform 0.18s ease;
    }
    .chev.flipped { transform: rotate(180deg); }

    /* Calendar shell */
    .cal-shell { padding: 0; }
    .cal-nav {
      padding: 14px 16px;
      display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid var(--border);
    }
    .ic-btn {
      width: 32px; height: 32px;
      border: none; background: transparent;
      color: var(--text-soft);
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .ic-btn:hover { background: var(--surface-soft); color: var(--primary); }
    .month-label { font-weight: 700; font-size: 16px; margin-left: 8px; }
    .cal-actions { margin-left: auto; display: flex; gap: 4px; }
    .view-btn {
      width: 36px; height: 32px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .view-btn:hover { background: var(--surface-soft); }
    .view-btn.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }

    /* Calendar grid */
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-left: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .cal-h {
      padding: 12px 14px;
      border-right: 1px solid var(--border);
      border-top: 1px solid var(--border);
      background: var(--surface-soft);
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-align: left;
    }
    .cell {
      min-height: 150px;
      border-right: 1px solid var(--border);
      border-top: 1px solid var(--border);
      padding: 10px 14px 12px 14px;
      display: flex; flex-direction: column;
      position: relative;
      background: var(--surface);
    }
    .cell.other-month, .cell.weekend {
      background-image: repeating-linear-gradient(135deg, transparent 0 9px, rgba(15, 23, 42, 0.04) 9px 10px);
    }
    .cell.other-month .date-num { color: #c7cbd6; }
    .cell.weekend .date-num { color: var(--text-soft); }

    .cell-top { display: flex; align-items: center; gap: 8px; }
    .date-num {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      width: 28px;
      text-align: left;
    }
    .date-num.today {
      width: 30px; height: 30px;
      background: var(--primary);
      color: #fff;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .person-ic { display: inline-flex; align-items: center; }
    .person-ic.pi-PRESENT  { color: #43a047; }
    .person-ic.pi-HALF_DAY { color: #f5a623; }
    .person-ic.pi-ON_LEAVE { color: #43a047; }
    .person-ic.pi-HOLIDAY  { color: #6c5ce7; }
    .person-ic svg { width: 16px; height: 16px; }

    .cell-body { flex: 1; margin-top: 12px; }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-left-width: 4px;
      border-left-style: solid;
    }
    .pill-present  { background: #d4f5e2; color: #066b3b; border-left-color: #43a047; }
    .pill-leave    { background: #d4f5e2; color: #066b3b; border-left-color: #43a047; }
    .pill-half     { background: #fff4d6; color: #8a5a00; border-left-color: #f5a623; }
    .pill-late     { background: #ffe0b2; color: #b76e00; border-left-color: #b76e00; }
    .pill-absent   { background: #fde4e4; color: var(--danger); border-left-color: var(--danger); }
    .pill-holiday  { background: #ece5fc; color: #4527a0; border-left-color: #6c5ce7; }
    .pill-weekend  { background: #ecedf2; color: #4b5563; border-left-color: #6b7280; }

    .cell-foot { font-size: 11px; }
    .shift { color: var(--muted); }
    .weekly-off {
      display: inline-flex; align-items: center; gap: 4px;
      color: var(--text-soft);
      font-weight: 500;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .x-mark { display: inline-flex; align-items: center; color: var(--muted); }
    .x-mark svg { width: 14px; height: 14px; }

    /* Punch bar (floating footer) */
    .punch-bar {
      margin-top: 20px;
      padding: 14px 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: var(--shadow-sm);
    }
    .punch-spacer { flex: 1; }
  `]
})
export class MyAttendanceComponent {
  private svc = inject(AttendanceService);
  private router = inject(Router);

  // Sun-first week to match Darwinbox
  weekHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  cursor = signal<{ year: number; month: number }>(this.currentYM());
  todayRecord = signal<AttendanceRecord | null>(null);
  days = signal<AttendanceDay[]>([]);
  summary = signal<MonthSummary | null>(null);
  busy = signal(false);
  errorMsg = signal<string | null>(null);
  metricsCollapsed = signal(false);
  view = signal<'cal' | 'list'>('cal');

  monthLabel = computed(() => {
    const { year, month } = this.cursor();
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  avgWorkDuration = computed(() => {
    // Compute average over present/half-day records that have workingMinutes
    const recs = this.days().filter(d => d.workingMinutes != null && (d.status === 'PRESENT' || d.status === 'HALF_DAY'));
    if (recs.length === 0) return '00:00 Hrs';
    const avg = Math.round(recs.reduce((s, d) => s + (d.workingMinutes ?? 0), 0) / recs.length);
    return this.formatHHMMHrs(avg);
  });

  avgLateBy = computed(() => {
    const lateRecs = this.days().filter(d => d.late && d.checkIn);
    if (lateRecs.length === 0) return '00:00 Hrs';
    // Approx late minutes as the time after 09:30 of check-in
    const totalLate = lateRecs.reduce((s, d) => {
      const ci = new Date(d.checkIn!);
      // Convert to IST for comparison; the backend already stores IST-aligned timestamps
      const minSinceMidnight = ci.getUTCHours() * 60 + ci.getUTCMinutes() + 330; // +5:30
      const cutoff = 9 * 60 + 30;
      const late = Math.max(0, (minSinceMidnight % (24 * 60)) - cutoff);
      return s + late;
    }, 0);
    return this.formatHHMMHrs(Math.round(totalLate / lateRecs.length));
  });

  // Build calendar cells: 6-row × 7-col grid starting on Sunday
  calendarCells = computed(() => {
    const { year, month } = this.cursor();
    const firstOfMonth = new Date(year, month - 1, 1);
    const startDay = firstOfMonth.getDay();           // 0=Sun..6=Sat
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayIso = this.toIso(today);

    const dayMap = new Map<string, AttendanceDay>();
    this.days().forEach(d => dayMap.set(d.date, d));

    const cells: Array<{
      iso: string;
      dayNum: number;
      otherMonth: boolean;
      today: boolean;
      day: AttendanceDay | null;
      status: AttendanceStatus;
      late: boolean;
      checkIn: string | null;
      checkOut: string | null;
      workingMinutes: number | null;
      note: string | null;
      future: boolean;
    }> = [];

    // 42 cells (6 rows × 7 cols)
    for (let i = 0; i < 42; i++) {
      const dayOffset = i - startDay;
      const cellDate = new Date(year, month - 1, 1 + dayOffset);
      const iso = this.toIso(cellDate);
      const otherMonth = cellDate.getMonth() !== month - 1;
      const day = dayMap.get(iso) ?? null;
      // Fallback status when day not provided (other-month cells)
      const status: AttendanceStatus = day
        ? day.status
        : (cellDate.getDay() === 0 || cellDate.getDay() === 6 ? 'WEEKEND' : 'ABSENT');
      cells.push({
        iso,
        dayNum: cellDate.getDate(),
        otherMonth,
        today: iso === todayIso,
        day,
        status,
        late: day?.late ?? false,
        checkIn: day?.checkIn ?? null,
        checkOut: day?.checkOut ?? null,
        workingMinutes: day?.workingMinutes ?? null,
        note: day?.note ?? null,
        future: cellDate > today
      });
    }
    return cells;
  });

  ic = {
    caret:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>`,
    arrowL:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>`,
    arrowR:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="9 18 15 12 9 6"/></svg>`,
    barsBlue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="9"/></svg>`,
    barsOrange:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="18" y1="20" x2="18" y2="13"/></svg>`,
    calIcon:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    listIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    kebab:    `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18" r="1.6"/></svg>`,
    personSmall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>`,
    xMark:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`,
  };

  constructor() {
    this.refreshToday();
    this.refreshMonth();
  }

  refreshToday() {
    this.svc.today().subscribe({
      next: (r) => this.todayRecord.set(r ?? null),
      error: () => this.todayRecord.set(null)
    });
  }

  refreshMonth() {
    const { year, month } = this.cursor();
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0);
    this.svc.myRange(this.toIso(from), this.toIso(to)).subscribe(d => this.days.set(d));
    this.svc.mySummary(year, month).subscribe(s => this.summary.set(s));
  }

  toggleMetrics() { this.metricsCollapsed.update(v => !v); }

  prevMonth() { this.shiftMonth(-1); }
  nextMonth() { this.shiftMonth(1); }
  private shiftMonth(delta: number) {
    const { year, month } = this.cursor();
    const d = new Date(year, month - 1 + delta, 1);
    this.cursor.set({ year: d.getFullYear(), month: d.getMonth() + 1 });
    this.refreshMonth();
  }

  onCheckIn() {
    this.busy.set(true); this.errorMsg.set(null);
    this.svc.checkIn().subscribe({
      next: r => { this.todayRecord.set(r); this.busy.set(false); this.refreshMonth(); },
      error: err => { this.errorMsg.set(err?.error?.message ?? 'Check-in failed'); this.busy.set(false); }
    });
  }
  onCheckOut() {
    this.busy.set(true); this.errorMsg.set(null);
    this.svc.checkOut().subscribe({
      next: r => { this.todayRecord.set(r); this.busy.set(false); this.refreshMonth(); },
      error: err => { this.errorMsg.set(err?.error?.message ?? 'Check-out failed'); this.busy.set(false); }
    });
  }

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  formatHM(min: number | null | undefined): string {
    if (min == null) return '—';
    const h = Math.floor(min / 60); const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  formatHHMMHrs(min: number): string {
    const h = Math.floor(min / 60), m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Hrs`;
  }
  statusLabel(s: AttendanceStatus): string {
    return ({ PRESENT: 'Present', HALF_DAY: 'Half day', ABSENT: 'Absent', ON_LEAVE: 'On Leave', HOLIDAY: 'Holiday', WEEKEND: 'Weekly Off' })[s];
  }
  pillClass(s: AttendanceStatus): string {
    return ({
      PRESENT: 'pill-present', HALF_DAY: 'pill-half', ABSENT: 'pill-absent',
      ON_LEAVE: 'pill-leave', HOLIDAY: 'pill-holiday', WEEKEND: 'pill-weekend'
    })[s];
  }

  private currentYM() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; }
  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
}
