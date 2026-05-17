import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { RecruitmentService } from '../core/recruitment.service';
import {
  ApplicationStage, Candidate, Department, EmploymentType,
  Job, JobApplication, JobStatus
} from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'jobs' | 'candidates' | 'pipeline';

const STAGE_COLOR: Record<ApplicationStage, string> = {
  APPLIED:   '#6b7280',
  SCREENING: '#0288d1',
  INTERVIEW: '#5e35b1',
  OFFER:     '#f5a623',
  HIRED:     '#388e3c',
  REJECTED:  '#c62828',
};

const STAGE_ORDER: ApplicationStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

@Component({
  selector: 'app-recruitment-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>Recruitment</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'jobs'"       (click)="onTab('jobs')">Jobs</button>
        <button class="tab" [class.active]="tab() === 'candidates'" (click)="onTab('candidates')">Candidates</button>
        @if (canManage()) {
          <button class="tab" [class.active]="tab() === 'pipeline'"   (click)="onTab('pipeline')">Pipeline</button>
        }
      </div>
      @if (tab() === 'jobs' && canManage()) {
        <button class="btn btn-primary" (click)="openJob()">+ Post job</button>
      } @else if (tab() === 'candidates') {
        <button class="btn btn-primary" (click)="openCandidate()">+ Add candidate</button>
      }
    </div>

    @if (tab() === 'jobs') {
      <div class="filter-row">
        <select class="select" [(ngModel)]="jobFilter" (change)="loadJobs()">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="DRAFT">Draft</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CLOSED">Closed</option>
        </select>
        <span class="muted small">{{ jobs().length }} job(s)</span>
      </div>
      @if (jobs().length === 0) {
        <div class="empty">No jobs match.</div>
      } @else {
        <div class="job-grid">
          @for (j of jobs(); track j.id) {
            <div class="job-card">
              <div class="job-head">
                <div>
                  <div class="job-title">{{ j.title }}</div>
                  <div class="muted small">
                    @if (j.departmentName) { {{ j.departmentName }} · }
                    {{ employmentLabel(j.employmentType) }}
                    @if (j.location) { · {{ j.location }} }
                  </div>
                </div>
                <span class="badge" [class]="statusBadge(j.status)">{{ j.status }}</span>
              </div>
              @if (j.description) { <p class="job-desc">{{ j.description }}</p> }
              <div class="job-meta">
                <div><span class="muted small">Openings</span><br/><strong>{{ j.openings }}</strong></div>
                <div><span class="muted small">Min exp</span><br/><strong>{{ j.minExperienceYears }} yr</strong></div>
                <div><span class="muted small">Applicants</span><br/><strong>{{ j.applicantCount }}</strong></div>
              </div>
              <div class="stage-bar">
                @for (s of stageOrder; track s) {
                  @if ((j.stageCounts?.[s] ?? 0) > 0) {
                    <span class="stage-chip" [style.background]="stageColor(s)">{{ s }} · {{ j.stageCounts[s] }}</span>
                  }
                }
              </div>
              <div class="job-actions">
                <button class="btn btn-sm" (click)="viewApplicants(j)">Applicants</button>
                @if (canManage()) {
                  <button class="btn btn-sm" (click)="openJob(j)">Edit</button>
                }
                @if (isAdmin() && j.applicantCount === 0) {
                  <button class="btn btn-sm btn-danger" (click)="deleteJob(j)">Delete</button>
                }
              </div>
            </div>
          }
        </div>
      }
    }

    @if (tab() === 'candidates') {
      <div class="filter-row">
        <input class="input" [(ngModel)]="candidateQuery" (keyup.enter)="loadCandidates()" placeholder="Search by name, email, company…" />
        <button class="btn" (click)="loadCandidates()">Search</button>
        <span class="muted small">{{ candidates().length }} candidate(s)</span>
      </div>
      @if (candidates().length === 0) {
        <div class="empty">No candidates. Add one to start a pipeline.</div>
      } @else {
        <div class="card" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Experience</th>
                <th>Source</th>
                <th>Referrer</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of candidates(); track c.id) {
                <tr>
                  <td><strong>{{ c.firstName }} {{ c.lastName }}</strong></td>
                  <td>{{ c.email }}</td>
                  <td>{{ c.currentCompany || '—' }}</td>
                  <td>{{ c.yearsOfExperience != null ? c.yearsOfExperience + ' yr' : '—' }}</td>
                  <td><span class="source-pill">{{ c.source }}</span></td>
                  <td>{{ c.referrerName || '—' }}</td>
                  <td>{{ formatDate(c.createdAt) }}</td>
                  <td>
                    @if (canManage()) {
                      <button class="btn btn-sm" (click)="applyToJob(c)">Apply to job</button>
                      <button class="btn btn-sm" (click)="openCandidate(c)">Edit</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    @if (tab() === 'pipeline' && canManage()) {
      @if (pipeline()) {
        <div class="kanban">
          @for (s of stageOrder; track s) {
            <div class="lane">
              <div class="lane-head">
                <span class="lane-dot" [style.background]="stageColor(s)"></span>
                <strong>{{ s }}</strong>
                <span class="muted small">{{ pipeline()![s]?.length || 0 }}</span>
              </div>
              <div class="lane-body">
                @for (a of pipeline()![s] ?? []; track a.id) {
                  <div class="lane-card">
                    <div class="lane-card-name">{{ a.candidateName }}</div>
                    <div class="muted small">{{ a.jobTitle }}</div>
                    @if (a.latestNote) { <div class="muted small lane-note">"{{ a.latestNote }}"</div> }
                    <div class="muted small">Updated {{ timeAgo(a.lastStageChangeAt) }}</div>
                    <div class="lane-actions">
                      <select class="select select-sm" [(ngModel)]="stageChoice[a.id]" [ngModelOptions]="{ standalone: true }">
                        @for (target of stageOrder; track target) {
                          <option [value]="target">{{ target }}</option>
                        }
                      </select>
                      <button class="btn btn-sm" (click)="changeStage(a)">Move</button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty">Loading pipeline…</div>
      }
    }

    <!-- Job drawer -->
    @if (jobDrawerOpen()) {
      <div class="drawer-backdrop" (click)="closeJob()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>{{ editingJob() ? 'Edit job' : 'Post a job' }}</h2>
          <button class="close-btn" (click)="closeJob()"><span [innerHTML]="ic.close | safeHtml"></span></button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="jobForm" (ngSubmit)="submitJob()">
            <div class="field">
              <label>Title <span class="req">*</span></label>
              <input class="input" formControlName="title" placeholder="e.g. Senior Software Engineer" />
            </div>
            <div class="row two">
              <div class="field">
                <label>Department</label>
                <select class="select" formControlName="departmentId">
                  <option [ngValue]="null">— None —</option>
                  @for (d of departments(); track d.id) {
                    <option [ngValue]="d.id">{{ d.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>Location</label>
                <input class="input" formControlName="location" placeholder="Bengaluru, India" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Employment type <span class="req">*</span></label>
                <select class="select" formControlName="employmentType">
                  <option value="FULL_TIME">Full time</option>
                  <option value="PART_TIME">Part time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div class="field">
                <label>Status</label>
                <select class="select" formControlName="status">
                  <option value="DRAFT">Draft</option>
                  <option value="OPEN">Open</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Min experience (years)</label>
                <input class="input" type="number" min="0" formControlName="minExperienceYears" />
              </div>
              <div class="field">
                <label>Openings</label>
                <input class="input" type="number" min="1" formControlName="openings" />
              </div>
            </div>
            <div class="field">
              <label>Description</label>
              <textarea formControlName="description" rows="6" placeholder="Responsibilities, must-haves, nice-to-haves…"></textarea>
            </div>
            @if (jobErr()) { <div class="error">{{ jobErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeJob()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitJob()" [disabled]="jobForm.invalid || jobBusy()">
            {{ jobBusy() ? 'Saving…' : (editingJob() ? 'Save changes' : 'Post job') }}
          </button>
        </footer>
      </aside>
    }

    <!-- Candidate drawer -->
    @if (candDrawerOpen()) {
      <div class="drawer-backdrop" (click)="closeCandidate()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>{{ editingCandidate() ? 'Edit candidate' : 'Add candidate' }}</h2>
          <button class="close-btn" (click)="closeCandidate()"><span [innerHTML]="ic.close | safeHtml"></span></button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="candForm" (ngSubmit)="submitCandidate()">
            <div class="row two">
              <div class="field">
                <label>First name <span class="req">*</span></label>
                <input class="input" formControlName="firstName" />
              </div>
              <div class="field">
                <label>Last name <span class="req">*</span></label>
                <input class="input" formControlName="lastName" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Email <span class="req">*</span></label>
                <input class="input" type="email" formControlName="email" />
              </div>
              <div class="field">
                <label>Phone</label>
                <input class="input" formControlName="phone" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Current company</label>
                <input class="input" formControlName="currentCompany" />
              </div>
              <div class="field">
                <label>Experience (years)</label>
                <input class="input" type="number" min="0" formControlName="yearsOfExperience" />
              </div>
            </div>
            <div class="row two">
              <div class="field">
                <label>Source</label>
                <select class="select" formControlName="source">
                  <option value="REFERRAL">Referral</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="NAUKRI">Naukri</option>
                  <option value="AGENCY">Agency</option>
                  <option value="WEBSITE">Website</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div class="field">
                <label>Referrer</label>
                <select class="select" formControlName="referrerId">
                  <option [ngValue]="null">— None —</option>
                  @for (e of referrers(); track e.id) {
                    <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="field">
              <label>Notes</label>
              <textarea formControlName="notes" rows="4"></textarea>
            </div>
            @if (candErr()) { <div class="error">{{ candErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeCandidate()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitCandidate()" [disabled]="candForm.invalid || candBusy()">
            {{ candBusy() ? 'Saving…' : (editingCandidate() ? 'Save changes' : 'Add candidate') }}
          </button>
        </footer>
      </aside>
    }

    <!-- Applicants drawer (for a job) -->
    @if (applicantsJob()) {
      <div class="drawer-backdrop" (click)="closeApplicants()"></div>
      <aside class="drawer wide" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>Applicants — {{ applicantsJob()!.title }}</h2>
          <button class="close-btn" (click)="closeApplicants()"><span [innerHTML]="ic.close | safeHtml"></span></button>
        </header>
        <div class="drawer-body">
          @if (canManage()) {
            <div class="add-applicant">
              <label class="muted small">Add candidate to this job</label>
              <div style="display:flex; gap:8px; margin-top: 4px;">
                <select class="select" [(ngModel)]="newApplicantId" [ngModelOptions]="{ standalone: true }">
                  <option [ngValue]="null">— Pick a candidate —</option>
                  @for (c of candidates(); track c.id) {
                    <option [ngValue]="c.id">{{ c.firstName }} {{ c.lastName }} ({{ c.email }})</option>
                  }
                </select>
                <button class="btn btn-primary" (click)="addApplicant()" [disabled]="newApplicantId === null">Add</button>
              </div>
            </div>
          }
          @if (applicants().length === 0) {
            <div class="empty">No applicants yet.</div>
          } @else {
            <table class="table" style="margin-top: 14px;">
              <thead>
                <tr><th>Candidate</th><th>Email</th><th>Stage</th><th>Last update</th><th></th></tr>
              </thead>
              <tbody>
                @for (a of applicants(); track a.id) {
                  <tr>
                    <td><strong>{{ a.candidateName }}</strong></td>
                    <td>{{ a.candidateEmail }}</td>
                    <td><span class="stage-chip" [style.background]="stageColor(a.stage)">{{ a.stage }}</span></td>
                    <td>{{ timeAgo(a.lastStageChangeAt) }}</td>
                    <td>
                      @if (canManage()) {
                        <select class="select select-sm" [(ngModel)]="stageChoice[a.id]" [ngModelOptions]="{ standalone: true }">
                          @for (s of stageOrder; track s) {
                            <option [value]="s">{{ s }}</option>
                          }
                        </select>
                        <button class="btn btn-sm" (click)="changeStage(a)">Move</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
        <footer class="drawer-foot">
          <button class="btn" (click)="closeApplicants()">Close</button>
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

    .filter-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .filter-row .input { max-width: 360px; }
    .filter-row .select { max-width: 200px; }

    .job-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
    .job-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .job-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .job-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .job-title { font-weight: 700; font-size: 16px; }
    .job-desc { color: var(--text-soft); font-size: 13px; margin: 10px 0; line-height: 1.5; max-height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .job-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); margin: 8px 0; font-size: 13px; }
    .stage-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 4px 0; }
    .stage-chip { display: inline-block; padding: 3px 8px; border-radius: 999px; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }
    .job-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }

    .source-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--surface-soft); color: var(--text-soft); font-size: 11px; font-weight: 700; }

    /* Kanban */
    .kanban { display: grid; grid-template-columns: repeat(6, minmax(180px, 1fr)); gap: 10px; align-items: flex-start; overflow-x: auto; }
    @media (max-width: 1280px) { .kanban { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 700px) { .kanban { grid-template-columns: 1fr; } }
    .lane { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
    .lane-head { display: flex; align-items: center; gap: 6px; padding: 4px 4px 8px 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
    .lane-dot { width: 8px; height: 8px; border-radius: 50%; }
    .lane-body { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; }
    .lane-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
    .lane-card-name { font-weight: 700; font-size: 13px; }
    .lane-note { margin-top: 4px; max-height: 36px; overflow: hidden; }
    .lane-actions { margin-top: 8px; display: flex; gap: 6px; }
    .select-sm { padding: 4px 8px; font-size: 12px; min-width: 0; }

    .add-applicant { padding: 10px; border: 1px dashed var(--border); border-radius: 8px; background: var(--surface-soft); }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(640px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
    .drawer.wide { width: min(820px, 100vw); }
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
export class RecruitmentPageComponent {
  private svc = inject(RecruitmentService);
  private employeeSvc = inject(EmployeeService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('jobs');
  jobs = signal<Job[]>([]);
  candidates = signal<Candidate[]>([]);
  applicants = signal<JobApplication[]>([]);
  pipeline = signal<Record<ApplicationStage, JobApplication[]> | null>(null);
  departments = signal<Department[]>([]);
  referrers = signal<{ id: number; firstName: string; lastName: string }[]>([]);

  jobFilter: '' | JobStatus = 'OPEN';
  candidateQuery = '';
  newApplicantId: number | null = null;
  stageChoice: Record<number, ApplicationStage> = {};

  /* Job drawer */
  jobDrawerOpen = signal(false);
  editingJob = signal<Job | null>(null);
  jobBusy = signal(false);
  jobErr = signal<string | null>(null);
  jobForm = this.fb.group({
    title: ['', Validators.required],
    departmentId: [null as number | null],
    location: [''],
    employmentType: ['FULL_TIME' as EmploymentType, Validators.required],
    description: [''],
    minExperienceYears: [0],
    openings: [1],
    status: ['OPEN' as JobStatus]
  });

  /* Candidate drawer */
  candDrawerOpen = signal(false);
  editingCandidate = signal<Candidate | null>(null);
  candBusy = signal(false);
  candErr = signal<string | null>(null);
  candForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    currentCompany: [''],
    yearsOfExperience: [null as number | null],
    source: ['LINKEDIN'],
    referrerId: [null as number | null],
    notes: ['']
  });

  /* Applicants drawer */
  applicantsJob = signal<Job | null>(null);

  stageOrder = STAGE_ORDER;

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  canManage = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));

  ic = {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() {
    this.loadJobs();
    this.employeeSvc.departments().subscribe(d => this.departments.set(d));
    // Use all employees as possible referrers (slice for perf)
    this.employeeSvc.list().subscribe(list => this.referrers.set(list.slice(0, 200)));
  }

  onTab(t: Tab) {
    this.tab.set(t);
    if (t === 'jobs') this.loadJobs();
    if (t === 'candidates') this.loadCandidates();
    if (t === 'pipeline') this.svc.pipeline().subscribe(p => this.pipeline.set(p));
  }

  /* === Jobs === */

  loadJobs() {
    this.svc.listJobs(this.jobFilter || undefined).subscribe(j => this.jobs.set(j));
  }

  openJob(j?: Job) {
    this.editingJob.set(j ?? null);
    this.jobErr.set(null);
    if (j) {
      this.jobForm.setValue({
        title: j.title,
        departmentId: j.departmentId ?? null,
        location: j.location ?? '',
        employmentType: j.employmentType,
        description: j.description ?? '',
        minExperienceYears: j.minExperienceYears,
        openings: j.openings,
        status: j.status
      });
    } else {
      this.jobForm.reset({
        title: '', departmentId: null, location: '',
        employmentType: 'FULL_TIME' as EmploymentType,
        description: '', minExperienceYears: 0, openings: 1,
        status: 'OPEN' as JobStatus
      });
    }
    this.jobDrawerOpen.set(true);
  }
  closeJob() { this.jobDrawerOpen.set(false); this.editingJob.set(null); }
  submitJob() {
    if (this.jobForm.invalid) return;
    this.jobBusy.set(true); this.jobErr.set(null);
    const v = this.jobForm.value;
    const body = {
      title: v.title!,
      departmentId: v.departmentId,
      location: v.location ?? undefined,
      employmentType: v.employmentType as EmploymentType,
      description: v.description ?? undefined,
      minExperienceYears: v.minExperienceYears == null ? 0 : Number(v.minExperienceYears),
      openings: v.openings == null ? 1 : Number(v.openings),
      status: v.status as JobStatus
    };
    const id = this.editingJob()?.id;
    const obs = id ? this.svc.updateJob(id, body) : this.svc.createJob(body);
    obs.subscribe({
      next: () => { this.jobBusy.set(false); this.closeJob(); this.loadJobs(); },
      error: (err) => { this.jobErr.set(err?.error?.message ?? 'Save failed'); this.jobBusy.set(false); }
    });
  }
  deleteJob(j: Job) {
    if (!confirm(`Delete job "${j.title}"?`)) return;
    this.svc.deleteJob(j.id).subscribe({
      next: () => this.loadJobs(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }

  /* === Candidates === */

  loadCandidates() {
    this.svc.listCandidates(this.candidateQuery || undefined).subscribe(c => this.candidates.set(c));
  }
  openCandidate(c?: Candidate) {
    this.editingCandidate.set(c ?? null);
    this.candErr.set(null);
    if (c) {
      this.candForm.patchValue({
        firstName: c.firstName, lastName: c.lastName, email: c.email,
        phone: c.phone ?? '', currentCompany: c.currentCompany ?? '',
        yearsOfExperience: c.yearsOfExperience,
        source: c.source,
        notes: c.notes ?? ''
      });
    } else {
      this.candForm.reset({
        firstName: '', lastName: '', email: '', phone: '',
        currentCompany: '', yearsOfExperience: null,
        source: 'LINKEDIN', referrerId: null, notes: ''
      });
    }
    this.candDrawerOpen.set(true);
  }
  closeCandidate() { this.candDrawerOpen.set(false); this.editingCandidate.set(null); }
  submitCandidate() {
    if (this.candForm.invalid) return;
    this.candBusy.set(true); this.candErr.set(null);
    const v = this.candForm.value;
    const body = {
      firstName: v.firstName!, lastName: v.lastName!, email: v.email!,
      phone: v.phone ?? undefined,
      currentCompany: v.currentCompany ?? undefined,
      yearsOfExperience: v.yearsOfExperience == null ? undefined : Number(v.yearsOfExperience),
      source: v.source ?? undefined,
      referrerId: v.referrerId,
      notes: v.notes ?? undefined
    };
    const id = this.editingCandidate()?.id;
    const obs = id ? this.svc.updateCandidate(id, body) : this.svc.createCandidate(body);
    obs.subscribe({
      next: () => { this.candBusy.set(false); this.closeCandidate(); this.loadCandidates(); },
      error: (err) => { this.candErr.set(err?.error?.message ?? 'Save failed'); this.candBusy.set(false); }
    });
  }

  applyToJob(c: Candidate) {
    const id = prompt(`Apply ${c.firstName} ${c.lastName} to which job id?`);
    if (!id) return;
    this.svc.apply(c.id, Number(id)).subscribe({
      next: () => alert('Applied'),
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  /* === Applicants drawer for a job === */

  viewApplicants(j: Job) {
    this.applicantsJob.set(j);
    this.svc.applicationsByJob(j.id).subscribe(a => {
      this.applicants.set(a);
      a.forEach(x => this.stageChoice[x.id] = x.stage);
    });
    if (this.candidates().length === 0) this.loadCandidates();
  }
  closeApplicants() { this.applicantsJob.set(null); this.applicants.set([]); this.newApplicantId = null; }
  addApplicant() {
    const j = this.applicantsJob();
    if (!j || this.newApplicantId == null) return;
    this.svc.apply(this.newApplicantId, j.id).subscribe({
      next: () => { this.viewApplicants(j); this.newApplicantId = null; },
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  /* === Stage transitions === */

  changeStage(a: JobApplication) {
    const target = this.stageChoice[a.id] ?? a.stage;
    if (target === a.stage) return;
    const note = prompt('Optional note for this stage transition:') ?? undefined;
    this.svc.moveStage(a.id, target, note || undefined).subscribe({
      next: () => {
        // refresh the appropriate view
        if (this.applicantsJob()) this.viewApplicants(this.applicantsJob()!);
        if (this.tab() === 'pipeline') this.svc.pipeline().subscribe(p => this.pipeline.set(p));
        this.loadJobs();
      },
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  /* === helpers === */

  employmentLabel(t: EmploymentType): string {
    return ({ FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract', INTERN: 'Intern' } as Record<EmploymentType, string>)[t];
  }
  statusBadge(s: JobStatus): string {
    return ({
      DRAFT: 'badge-weekend', OPEN: 'badge-approved', ON_HOLD: 'badge-pending', CLOSED: 'badge-rejected'
    } as Record<JobStatus, string>)[s];
  }
  stageColor(s: ApplicationStage) { return STAGE_COLOR[s]; }
  formatDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    return this.formatDate(iso);
  }
}
