import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AttendanceService } from '../core/attendance.service';
import { AttendanceRecord, AttendanceStatus } from '../core/models';

/**
 * Generic per-day attendance listing component used for both
 * /attendance/team (manager) and /attendance/all (admin).
 */
@Component({
  selector: 'app-attendance-day',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="breadcrumb"><a routerLink="/dashboard">Home</a> · {{ heading }}</div>

    <div class="page-header">
      <div>
        <h2>{{ heading }}</h2>
        <div class="muted" style="margin-top: 4px;">{{ subtitle }}</div>
      </div>
      <div class="toolbar" style="margin: 0;">
        <div>
          <label class="muted">Date</label>
          <input class="input" type="date" [(ngModel)]="date" (change)="reload()" />
        </div>
        <button class="btn" (click)="setToday()">Today</button>
      </div>
    </div>

    <!-- Quick stats -->
    <div class="summary-grid">
      <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.users"></div><div><div class="stat-tile-value">{{ rows().length }}</div><div class="stat-tile-label">Records</div></div></div>
      <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.check"></div><div><div class="stat-tile-value">{{ count('PRESENT') }}</div><div class="stat-tile-label">Present</div></div></div>
      <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.half"></div><div><div class="stat-tile-value">{{ count('HALF_DAY') }}</div><div class="stat-tile-label">Half day</div></div></div>
      <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.late"></div><div><div class="stat-tile-value">{{ lateCount() }}</div><div class="stat-tile-label">Late marks</div></div></div>
    </div>

    <div class="card" style="margin-top: 20px;">
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else if (rows().length === 0) {
        <div class="empty">No attendance records for this date.</div>
      } @else {
        <table class="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Worked</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td>
                  <strong>{{ r.employeeName }}</strong>
                  <div class="muted" style="font-size: 12px;">{{ r.employeeCode }}</div>
                </td>
                <td>
                  <span class="badge" [class]="badgeClass(r.status)">{{ statusLabel(r.status) }}</span>
                  @if (r.late) { <span class="badge badge-late" style="margin-left: 6px;">Late</span> }
                </td>
                <td>{{ formatTime(r.checkIn) }}</td>
                <td>{{ formatTime(r.checkOut) }}</td>
                <td>{{ formatHM(r.workingMinutes) }}</td>
                <td></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }
  `]
})
export class AttendanceDayComponent implements OnInit {
  @Input() scope: 'team' | 'all' = 'all';

  private svc = inject(AttendanceService);

  date = new Date().toISOString().slice(0, 10);
  rows = signal<AttendanceRecord[]>([]);
  loading = signal(true);

  get heading() { return this.scope === 'team' ? 'Team Attendance' : 'All Attendance'; }
  get subtitle() { return this.scope === 'team' ? 'Your direct reports for the selected day' : 'Org-wide attendance for the selected day'; }

  ic = {
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    half:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z"/></svg>`,
    late:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  };

  ngOnInit() { this.reload(); }
  setToday() { this.date = new Date().toISOString().slice(0, 10); this.reload(); }

  reload() {
    this.loading.set(true);
    const obs = this.scope === 'team' ? this.svc.team(this.date) : this.svc.all(this.date);
    obs.subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  count(s: AttendanceStatus) { return this.rows().filter(r => r.status === s).length; }
  lateCount = computed(() => this.rows().filter(r => r.late).length);

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  formatHM(min: number | null | undefined): string {
    if (min == null) return '—';
    const h = Math.floor(min / 60); const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  statusLabel(s: AttendanceStatus): string {
    return ({ PRESENT: 'Present', HALF_DAY: 'Half day', ABSENT: 'Absent', ON_LEAVE: 'On leave', HOLIDAY: 'Holiday', WEEKEND: 'Weekend' })[s];
  }
  badgeClass(s: AttendanceStatus): string {
    return ({ PRESENT: 'badge-present', HALF_DAY: 'badge-half', ABSENT: 'badge-absent', ON_LEAVE: 'badge-leave', HOLIDAY: 'badge-holiday', WEEKEND: 'badge-weekend' })[s];
  }
}
