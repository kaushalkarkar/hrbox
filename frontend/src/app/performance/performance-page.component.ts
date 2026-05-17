import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { PerformanceService } from '../core/performance.service';
import { Employee, Goal, GoalStatus, PerformanceReview } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'goals' | 'reviews' | 'team-goals' | 'team-reviews';

@Component({
  selector: 'app-performance-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, SafeHtmlPipe, NgTemplateOutlet],
  template: `
    <div class="page-bar">
      <h2>Performance</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'goals'"        (click)="tab.set('goals')">My Goals</button>
        <button class="tab" [class.active]="tab() === 'reviews'"      (click)="tab.set('reviews')">My Reviews</button>
        @if (canManageTeam()) {
          <button class="tab" [class.active]="tab() === 'team-goals'"   (click)="tab.set('team-goals')">Team Goals</button>
          <button class="tab" [class.active]="tab() === 'team-reviews'" (click)="tab.set('team-reviews')">Team Reviews</button>
        }
      </div>
      @if (tab() === 'goals' || (tab() === 'team-goals' && canManageTeam())) {
        <button class="btn btn-primary" (click)="openGoalDrawer()">+ Add goal</button>
      }
    </div>

    <!-- ==== My Goals tab ==== -->
    @if (tab() === 'goals') {
      <!-- Stats summary -->
      <div class="stats-row">
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.target | safeHtml"></div><div><div class="stat-tile-value">{{ myGoals().length }}</div><div class="stat-tile-label">Total goals</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.run | safeHtml"></div><div><div class="stat-tile-value">{{ goalsBy('IN_PROGRESS') }}</div><div class="stat-tile-label">In progress</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.check | safeHtml"></div><div><div class="stat-tile-value">{{ goalsBy('DONE') }}</div><div class="stat-tile-label">Completed</div></div></div>
        <div class="stat-tile"><div class="stat-tile-icon" [innerHTML]="ic.gauge | safeHtml"></div><div><div class="stat-tile-value">{{ overallScore() }}%</div><div class="stat-tile-label">Overall progress</div></div></div>
      </div>

      @if (myGoals().length === 0) {
        <div class="empty">No goals yet. Click + Add goal to set one.</div>
      } @else {
        <div class="goal-grid">
          @for (g of myGoals(); track g.id) {
            <ng-container *ngTemplateOutlet="goalCard; context: { g: g, ownGoal: true }"></ng-container>
          }
        </div>
      }
    }

    <!-- ==== My Reviews tab ==== -->
    @if (tab() === 'reviews') {
      @if (myReviews().length === 0) {
        <div class="empty">No reviews yet. Your manager will publish them when ready.</div>
      } @else {
        <div class="review-grid">
          @for (r of myReviews(); track r.id) {
            <div class="review-card">
              <div class="review-head">
                <div>
                  <div class="period-pill">{{ r.period }}</div>
                  <div class="muted small" style="margin-top: 6px;">Reviewed by {{ r.reviewerName || 'HR' }}</div>
                </div>
                <div class="rating">
                  @for (s of stars(); track s) {
                    <span class="star" [class.filled]="s <= r.rating" [innerHTML]="ic.star | safeHtml"></span>
                  }
                  <div class="rating-num">{{ r.rating }}/5</div>
                </div>
              </div>
              <p class="review-comment">{{ r.comments || 'No comments left.' }}</p>
              <div class="muted small">Updated {{ formatDate(r.updatedAt || r.createdAt) }}</div>
            </div>
          }
        </div>
      }
    }

    <!-- ==== Team Goals tab ==== -->
    @if (tab() === 'team-goals' && canManageTeam()) {
      <div class="card" style="padding: 0;">
        @if (teamGoals().length === 0) {
          <div class="empty">No goals across your team yet.</div>
        } @else {
          <table class="table">
            <thead>
              <tr><th>Employee</th><th>Goal</th><th>Progress</th><th>Status</th><th>Target</th><th>Weight</th><th></th></tr>
            </thead>
            <tbody>
              @for (g of teamGoals(); track g.id) {
                <tr>
                  <td><strong>{{ g.employeeName }}</strong> <span class="muted small">{{ g.employeeCode }}</span></td>
                  <td>{{ g.title }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar"><div class="progress-fill" [style.width.%]="g.progress"></div></div>
                      <span style="min-width: 38px; text-align: right;">{{ g.progress }}%</span>
                    </div>
                  </td>
                  <td><span class="badge" [class]="statusBadge(g.status)">{{ g.status }}</span></td>
                  <td>{{ g.targetDate || '—' }}</td>
                  <td>{{ g.weight }}</td>
                  <td><button class="btn btn-sm" (click)="editGoal(g)">Edit</button></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }

    <!-- ==== Team Reviews tab ==== -->
    @if (tab() === 'team-reviews' && canManageTeam()) {
      <div class="toolbar">
        <div style="flex: 1;">
          <label class="muted">Pick an employee</label>
          <select class="select" [(ngModel)]="selectedEmployeeId" (change)="loadEmployeeReviews()">
            <option [ngValue]="null" disabled>Select…</option>
            @for (e of teamMembers(); track e.id) {
              <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
            }
          </select>
        </div>
        @if (selectedEmployeeId) {
          <button class="btn btn-primary" (click)="openReviewDrawer()">+ Write review</button>
        }
      </div>

      @if (selectedEmployeeId == null) {
        <div class="empty">Pick an employee to view or write reviews.</div>
      } @else if (selectedEmployeeReviews().length === 0) {
        <div class="empty">No reviews yet for this employee.</div>
      } @else {
        <div class="review-grid">
          @for (r of selectedEmployeeReviews(); track r.id) {
            <div class="review-card">
              <div class="review-head">
                <div>
                  <div class="period-pill">{{ r.period }}</div>
                  <div class="muted small" style="margin-top: 6px;">By {{ r.reviewerName || '—' }}</div>
                </div>
                <div class="rating">
                  @for (s of stars(); track s) {
                    <span class="star" [class.filled]="s <= r.rating" [innerHTML]="ic.star | safeHtml"></span>
                  }
                  <div class="rating-num">{{ r.rating }}/5</div>
                </div>
              </div>
              <p class="review-comment">{{ r.comments || 'No comments.' }}</p>
              <div class="row-actions">
                <button class="btn btn-sm" (click)="editReview(r)">Edit</button>
                <button class="btn btn-sm btn-danger" (click)="deleteReview(r)">Delete</button>
              </div>
            </div>
          }
        </div>
      }
    }

    <!-- ==== Goal card template (used in My Goals and Edit Other) ==== -->
    <ng-template #goalCard let-g="g" let-own="ownGoal">
      <div class="goal-card">
        <div class="goal-head">
          <div>
            <div class="goal-title">{{ g.title }}</div>
            @if (g.targetDate) {
              <div class="muted small" style="margin-top: 2px;">Target: {{ g.targetDate }}</div>
            }
          </div>
          <span class="badge" [class]="statusBadge(g.status)">{{ g.status }}</span>
        </div>
        @if (g.description) { <p class="goal-desc">{{ g.description }}</p> }
        <div class="goal-progress">
          <div class="progress-row">
            <div class="progress-bar"><div class="progress-fill" [style.width.%]="g.progress"></div></div>
            <span style="min-width: 38px; text-align: right;">{{ g.progress }}%</span>
          </div>
          <div class="muted small" style="margin-top: 4px;">Weight: {{ g.weight }}/100</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" (click)="editGoal(g)">Edit</button>
          @if (own) {
            <button class="btn btn-sm btn-danger" (click)="onDeleteGoal(g)">Delete</button>
          }
        </div>
      </div>
    </ng-template>

    <!-- ==== Goal drawer ==== -->
    @if (goalDrawerOpen()) {
      <div class="drawer-backdrop" (click)="closeGoalDrawer()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>{{ editingGoal() ? 'Edit goal' : 'New goal' }}</h2>
          <button class="close-btn" (click)="closeGoalDrawer()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="goalForm" (ngSubmit)="submitGoal()">
            <div class="field">
              <label>Title <span class="req">*</span></label>
              <input class="input" formControlName="title" placeholder="e.g. Ship payroll v2" />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea formControlName="description" rows="4" placeholder="Detail what 'done' looks like…"></textarea>
            </div>
            <div class="row two">
              <div class="field">
                <label>Target date</label>
                <input class="input" type="date" formControlName="targetDate" />
              </div>
              <div class="field">
                <label>Weight (1–100)</label>
                <input class="input" type="number" min="1" max="100" formControlName="weight" />
              </div>
            </div>
            @if (editingGoal()) {
              <div class="row two">
                <div class="field">
                  <label>Progress %</label>
                  <input class="input" type="number" min="0" max="100" formControlName="progress" />
                </div>
                <div class="field">
                  <label>Status</label>
                  <select class="select" formControlName="status">
                    <option value="DRAFT">Draft</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            }
            @if (goalErr()) { <div class="error">{{ goalErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeGoalDrawer()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitGoal()" [disabled]="goalForm.invalid || goalBusy()">
            {{ goalBusy() ? 'Saving…' : (editingGoal() ? 'Save changes' : 'Create goal') }}
          </button>
        </footer>
      </aside>
    }

    <!-- ==== Review drawer ==== -->
    @if (reviewDrawerOpen()) {
      <div class="drawer-backdrop" (click)="closeReviewDrawer()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>{{ editingReview() ? 'Edit review' : 'Write review' }}</h2>
          <button class="close-btn" (click)="closeReviewDrawer()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="reviewForm" (ngSubmit)="submitReview()">
            <div class="field">
              <label>Period <span class="req">*</span></label>
              <input class="input" formControlName="period" placeholder="e.g. Q2-2026 or H1-2026" />
            </div>
            <div class="field">
              <label>Rating <span class="req">*</span></label>
              <div class="rating-input">
                @for (s of stars(); track s) {
                  <button type="button" class="star-btn" (click)="setRating(s)">
                    <span class="star" [class.filled]="s <= reviewForm.value.rating!" [innerHTML]="ic.star | safeHtml"></span>
                  </button>
                }
                <span class="muted" style="margin-left: 8px;">{{ reviewForm.value.rating }}/5</span>
              </div>
            </div>
            <div class="field">
              <label>Comments</label>
              <textarea formControlName="comments" rows="6" placeholder="What went well, what to improve, examples…"></textarea>
            </div>
            @if (reviewErr()) { <div class="error">{{ reviewErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeReviewDrawer()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitReview()" [disabled]="reviewForm.invalid || reviewBusy()">
            {{ reviewBusy() ? 'Saving…' : 'Save review' }}
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

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px; }

    .small { font-size: 12px; }

    .goal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .goal-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .goal-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .goal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .goal-title { font-weight: 700; font-size: 15px; }
    .goal-desc { color: var(--text-soft); font-size: 13px; margin: 12px 0 14px 0; line-height: 1.5; }
    .goal-progress { margin-top: 6px; }

    .progress-row { display: flex; align-items: center; gap: 10px; }
    .progress-bar {
      flex: 1; height: 8px;
      background: var(--surface-soft);
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 999px; transition: width 0.2s ease; }

    .row-actions { display: flex; gap: 6px; margin-top: 12px; }

    .review-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .review-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    .review-head { display: flex; justify-content: space-between; align-items: flex-start; }
    .period-pill {
      display: inline-block;
      padding: 4px 12px;
      background: var(--primary-soft);
      color: var(--primary-deep);
      border-radius: 999px;
      font-size: 12px; font-weight: 700;
    }
    .rating { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
    .rating .star { color: #d6dde4; display: inline-flex; }
    .rating .star.filled { color: #f5b740; }
    .rating .star svg { width: 18px; height: 18px; }
    .rating-num { width: 100%; text-align: right; font-weight: 700; color: var(--primary); margin-top: 2px; }
    .review-comment { color: var(--text-soft); margin: 14px 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }

    .rating-input { display: flex; align-items: center; }
    .star-btn { background: transparent; border: none; cursor: pointer; padding: 2px; }
    .star-btn .star svg { width: 26px; height: 26px; }

    /* Drawer (shared) */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .drawer-head { padding: 22px 26px 16px 26px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .drawer-head h2 { margin: 0; font-size: 20px; }
    .close-btn { width: 36px; height: 36px; border: none; background: transparent; color: var(--text-soft); border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .close-btn:hover { background: var(--surface-soft); }
    .drawer-body { flex: 1; overflow-y: auto; padding: 22px 26px; }
    .drawer-foot { padding: 16px 26px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
    .req { color: var(--danger); margin-left: 2px; }
    .row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  `]
})
export class PerformancePageComponent {
  private auth = inject(AuthService);
  private svc = inject(PerformanceService);
  private employeeSvc = inject(EmployeeService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('goals');
  myGoals = signal<Goal[]>([]);
  myReviews = signal<PerformanceReview[]>([]);
  teamGoals = signal<Goal[]>([]);
  teamMembers = signal<Employee[]>([]);
  selectedEmployeeId: number | null = null;
  selectedEmployeeReviews = signal<PerformanceReview[]>([]);

  /* Goal drawer */
  goalDrawerOpen = signal(false);
  editingGoal = signal<Goal | null>(null);
  goalBusy = signal(false);
  goalErr = signal<string | null>(null);
  goalForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    targetDate: [''],
    weight: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    progress: [0, [Validators.min(0), Validators.max(100)]],
    status: ['DRAFT' as GoalStatus, Validators.required]
  });

  /* Review drawer */
  reviewDrawerOpen = signal(false);
  editingReview = signal<PerformanceReview | null>(null);
  reviewBusy = signal(false);
  reviewErr = signal<string | null>(null);
  reviewForm = this.fb.nonNullable.group({
    period: ['Q2-2026', [Validators.required, Validators.maxLength(32)]],
    rating: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    comments: ['']
  });

  canManageTeam = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));

  ic = {
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    run:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="M5 22l4-9 4 4 5-1-2 6"/><path d="M9 13l3-2 4 1"/></svg>`,
    check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    gauge:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14l4-4"/><path d="M12 22a10 10 0 1 1 9.95-9"/></svg>`,
    star:   `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    close:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  stars(): number[] { return [1, 2, 3, 4, 5]; }

  constructor() {
    this.refresh();
  }

  refresh() {
    this.svc.myGoals().subscribe(g => this.myGoals.set(g));
    this.svc.myReviews().subscribe(r => this.myReviews.set(r));
    if (this.canManageTeam()) {
      this.svc.teamGoals().subscribe(g => this.teamGoals.set(g));
      this.employeeSvc.list().subscribe(list => {
        // For managers, filter to direct reports; admins see everyone.
        const role = this.auth.role();
        const myEmpId = this.auth.user()?.employee?.id;
        if (role === 'MANAGER') {
          this.teamMembers.set(list.filter(e => e.managerId === myEmpId));
        } else {
          this.teamMembers.set(list);
        }
      });
    }
  }

  goalsBy(status: GoalStatus): number {
    return this.myGoals().filter(g => g.status === status).length;
  }

  overallScore(): number {
    const list = this.myGoals().filter(g => g.status !== 'CANCELLED');
    if (list.length === 0) return 0;
    const totalWeight = list.reduce((s, g) => s + g.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = list.reduce((s, g) => s + g.weight * g.progress, 0);
    return Math.round(weighted / totalWeight);
  }

  statusBadge(s: GoalStatus): string {
    return ({
      DRAFT: 'badge-pending',
      IN_PROGRESS: 'badge-leave',
      DONE: 'badge-approved',
      CANCELLED: 'badge-rejected'
    } as Record<GoalStatus, string>)[s];
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ===== Goal handlers ===== */

  openGoalDrawer() {
    this.editingGoal.set(null);
    this.goalForm.reset({
      title: '', description: '', targetDate: '',
      weight: 10, progress: 0, status: 'DRAFT'
    });
    this.goalErr.set(null);
    this.goalDrawerOpen.set(true);
  }

  editGoal(g: Goal) {
    this.editingGoal.set(g);
    this.goalForm.setValue({
      title: g.title,
      description: g.description ?? '',
      targetDate: g.targetDate ?? '',
      weight: g.weight,
      progress: g.progress,
      status: g.status
    });
    this.goalErr.set(null);
    this.goalDrawerOpen.set(true);
  }

  closeGoalDrawer() { this.goalDrawerOpen.set(false); this.editingGoal.set(null); }

  submitGoal() {
    if (this.goalForm.invalid) return;
    this.goalBusy.set(true); this.goalErr.set(null);
    const v = this.goalForm.getRawValue();
    const editing = this.editingGoal();
    const obs = editing
      ? this.svc.updateGoal(editing.id, {
          title: v.title!, description: v.description, targetDate: v.targetDate || null,
          weight: Number(v.weight), progress: Number(v.progress), status: v.status
        })
      : this.svc.createMyGoal({
          title: v.title!, description: v.description, targetDate: v.targetDate || null,
          weight: Number(v.weight)
        });
    obs.subscribe({
      next: () => { this.goalBusy.set(false); this.closeGoalDrawer(); this.refresh(); },
      error: (err) => { this.goalErr.set(err?.error?.message ?? 'Save failed'); this.goalBusy.set(false); }
    });
  }

  onDeleteGoal(g: Goal) {
    if (!confirm(`Delete goal "${g.title}"?`)) return;
    this.svc.deleteGoal(g.id).subscribe({
      next: () => this.refresh(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }

  /* ===== Review handlers ===== */

  loadEmployeeReviews() {
    if (this.selectedEmployeeId == null) return;
    this.svc.reviewsForEmployee(this.selectedEmployeeId).subscribe(r => this.selectedEmployeeReviews.set(r));
  }

  openReviewDrawer() {
    this.editingReview.set(null);
    this.reviewForm.reset({ period: 'Q2-2026', rating: 3, comments: '' });
    this.reviewErr.set(null);
    this.reviewDrawerOpen.set(true);
  }

  editReview(r: PerformanceReview) {
    this.editingReview.set(r);
    this.selectedEmployeeId = r.employeeId;
    this.reviewForm.setValue({ period: r.period, rating: r.rating, comments: r.comments ?? '' });
    this.reviewErr.set(null);
    this.reviewDrawerOpen.set(true);
  }

  closeReviewDrawer() { this.reviewDrawerOpen.set(false); this.editingReview.set(null); }

  setRating(n: number) { this.reviewForm.controls.rating.setValue(n); }

  submitReview() {
    if (this.reviewForm.invalid || this.selectedEmployeeId == null) return;
    this.reviewBusy.set(true); this.reviewErr.set(null);
    const v = this.reviewForm.getRawValue();
    this.svc.upsertReview(this.selectedEmployeeId, {
      period: v.period!, rating: Number(v.rating), comments: v.comments
    }).subscribe({
      next: () => {
        this.reviewBusy.set(false);
        this.closeReviewDrawer();
        this.loadEmployeeReviews();
      },
      error: (err) => { this.reviewErr.set(err?.error?.message ?? 'Save failed'); this.reviewBusy.set(false); }
    });
  }

  deleteReview(r: PerformanceReview) {
    if (!confirm(`Delete review for ${r.period}?`)) return;
    this.svc.deleteReview(r.id).subscribe({
      next: () => this.loadEmployeeReviews(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }
}
