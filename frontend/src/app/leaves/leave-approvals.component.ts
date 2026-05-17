import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../core/leave.service';
import { Leave } from '../core/models';

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>Pending approvals</h2>

    <div class="card">
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else if (rows().length === 0) {
        <div class="empty">Nothing pending. Nice.</div>
      } @else {
        <table class="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th style="width: 240px;">Comment & action</th>
            </tr>
          </thead>
          <tbody>
            @for (l of rows(); track l.id) {
              <tr>
                <td>{{ l.employeeName }} <span class="muted">({{ l.employeeCode }})</span></td>
                <td>{{ l.type }}</td>
                <td>{{ l.startDate }}</td>
                <td>{{ l.endDate }}</td>
                <td>{{ l.reason || '—' }}</td>
                <td>
                  <input class="input" placeholder="Optional comment" [(ngModel)]="comments[l.id]" />
                  <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="btn btn-sm btn-success" (click)="approve(l)" [disabled]="busyId() === l.id">Approve</button>
                    <button class="btn btn-sm btn-danger"  (click)="reject(l)"  [disabled]="busyId() === l.id">Reject</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
      @if (errorMsg()) { <div class="error" style="margin-top: 12px;">{{ errorMsg() }}</div> }
    </div>
  `,
  styles: [`h2 { margin: 0 0 16px 0; }`]
})
export class LeaveApprovalsComponent {
  private svc = inject(LeaveService);

  rows = signal<Leave[]>([]);
  loading = signal(true);
  busyId = signal<number | null>(null);
  errorMsg = signal<string | null>(null);
  comments: Record<number, string> = {};

  constructor() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.svc.pending().subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  approve(l: Leave) { this.act(l, 'approve'); }
  reject(l: Leave)  { this.act(l, 'reject');  }

  private act(l: Leave, kind: 'approve' | 'reject') {
    this.busyId.set(l.id);
    this.errorMsg.set(null);
    const obs = kind === 'approve'
      ? this.svc.approve(l.id, this.comments[l.id])
      : this.svc.reject(l.id, this.comments[l.id]);
    obs.subscribe({
      next: () => { this.busyId.set(null); this.reload(); },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Action failed');
        this.busyId.set(null);
      }
    });
  }
}
