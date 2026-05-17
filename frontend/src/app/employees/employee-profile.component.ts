import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { Employee, OrgChart, OrgNode } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';
import { AvatarComponent } from './avatar.component';

type TopTab = 'overview' | 'personal' | 'employment';
type OverviewSubTab = 'summary' | 'org';

@Component({
  selector: 'app-employee-profile',
  standalone: true,
  imports: [RouterLink, SafeHtmlPipe, AvatarComponent],
  template: `
    <div class="breadcrumb">
      <a routerLink="/dashboard">Home</a> ·
      <a routerLink="/employees">Employees</a> · {{ employee()?.firstName }} {{ employee()?.lastName }}
    </div>

    @if (employee(); as e) {
      <!-- Banner -->
      <div class="banner">
        <div class="banner-bg"></div>
        <div class="banner-content">
          <div class="banner-avatar">
            <app-avatar
              [employeeId]="e.id"
              [photoFilename]="e.photoFilename ?? null"
              [firstName]="e.firstName"
              [lastName]="e.lastName"
              [size]="120" />
            <span class="banner-cal-badge" [innerHTML]="ic.cal | safeHtml"></span>
          </div>
          <div class="banner-text">
            <h1>{{ e.firstName }} {{ e.lastName }}</h1>
            <div class="banner-sub">
              <span>{{ e.designation || '—' }}</span>
              @if (e.departmentName) { <span class="dot">·</span><span>{{ e.departmentName }}</span> }
            </div>
          </div>
        </div>
      </div>

      <!-- Contact bar + actions -->
      <div class="contact-bar">
        <div class="contact-left">
          @if (e.phone) {
            <span class="contact-item"><span class="ci" [innerHTML]="ic.phone | safeHtml"></span>{{ e.phone }}</span>
          }
          <span class="contact-item"><span class="ci" [innerHTML]="ic.mail | safeHtml"></span>{{ e.email }}</span>
          @if (e.address) {
            <span class="contact-item"><span class="ci" [innerHTML]="ic.pin | safeHtml"></span>{{ e.address }}</span>
          }
          @if (e.managerName) {
            <span class="contact-item"><span class="ci" [innerHTML]="ic.user | safeHtml"></span>{{ e.managerName }}</span>
          }
        </div>
        <div class="contact-right">
          <button class="btn btn-primary btn-pill"><span [innerHTML]="ic.book | safeHtml"></span>Guide</button>
          <button class="ic-action" (click)="toggleOrgChart()" title="Organization chart">
            <span [innerHTML]="ic.tree | safeHtml"></span>
          </button>
          <button class="ic-action" title="Download profile">
            <span [innerHTML]="ic.download | safeHtml"></span>
          </button>
        </div>
      </div>

      <!-- Top tabs -->
      <div class="profile-tabs">
        <button class="tab" [class.active]="topTab() === 'overview'"   (click)="topTab.set('overview')">Overview</button>
        <button class="tab" [class.active]="topTab() === 'personal'"   (click)="topTab.set('personal')">Personal Details</button>
        <button class="tab" [class.active]="topTab() === 'employment'" (click)="topTab.set('employment')">Employment Details</button>
        <span class="tab-spacer"></span>
        <button class="tab-search" title="Search fields"><span [innerHTML]="ic.search | safeHtml"></span></button>
      </div>

      <!-- Two-column body: main left / appreciations right -->
      <div class="profile-body">
        <div class="profile-main">
          @if (topTab() === 'overview') {
            <div class="pill-tabs">
              <button class="pill" [class.active]="subTab() === 'summary'" (click)="subTab.set('summary')">Profile Summary</button>
              <button class="pill" [class.active]="subTab() === 'org'"     (click)="subTab.set('org')">Organization Chart</button>
            </div>

            @if (subTab() === 'summary') {
              <div class="card section">
                <h3>Profile Summary</h3>
                <div class="kv-grid">
                  <div class="kv"><div class="k">Employee ID</div><div class="v">{{ e.employeeCode }}</div></div>
                  <div class="kv"><div class="k">Email ID</div><div class="v">{{ e.email }}</div></div>
                  <div class="kv"><div class="k">Department</div><div class="v">{{ e.departmentName || '—' }}</div></div>
                  <div class="kv"><div class="k">Base Location</div><div class="v">{{ e.address || '—' }}</div></div>
                  <div class="kv"><div class="k">Reporting Manager</div><div class="v">{{ e.managerName || '—' }}</div></div>
                  <div class="kv"><div class="k">Designation</div><div class="v">{{ e.designation || '—' }}</div></div>
                  <div class="kv"><div class="k">Joined On</div><div class="v">{{ formatDate(e.joinedOn) }}</div></div>
                  <div class="kv"><div class="k">Phone</div><div class="v">{{ e.phone || '—' }}</div></div>
                </div>
              </div>
            } @else {
              <div class="card section">
                <h3>Organization Chart</h3>
                @if (orgChart(); as o) {
                  <div class="org-stats">
                    <span><span class="org-icon" [innerHTML]="ic.tree | safeHtml"></span>Direct Reportees: <strong>{{ o.reports.length }}</strong></span>
                    <span style="margin-left: 24px;">Total Team Size: <strong>{{ o.reports.length }}</strong></span>
                  </div>

                  <div class="org-tree">
                    @for (n of o.chain; track n.id; let last = $last) {
                      <div class="org-card-row">
                        <div class="org-card" [class.current]="last">
                          <app-avatar [employeeId]="n.id" [photoFilename]="n.photoFilename" [firstName]="n.firstName" [lastName]="n.lastName" [size]="48" />
                          <div class="org-card-text">
                            <div class="org-name">{{ n.firstName }} {{ n.lastName }}</div>
                            <div class="org-role muted">{{ n.designation || '—' }}</div>
                            <div class="org-dept muted">{{ n.departmentName || '—' }}</div>
                          </div>
                        </div>
                      </div>
                      @if (!last) { <div class="org-line"></div> }
                    }

                    @if (o.reports.length > 0) {
                      <div class="org-line"></div>
                      <div class="org-reports">
                        @for (r of o.reports; track r.id) {
                          <div class="org-card report" (click)="goto(r.id)">
                            <app-avatar [employeeId]="r.id" [photoFilename]="r.photoFilename" [firstName]="r.firstName" [lastName]="r.lastName" [size]="44" />
                            <div class="org-card-text">
                              <div class="org-name">{{ r.firstName }} {{ r.lastName }}</div>
                              <div class="org-role muted">{{ r.designation || '—' }}</div>
                              <div class="org-dept muted">{{ r.departmentName || '—' }}</div>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty">Loading organization chart…</div>
                }
              </div>
            }
          }

          @if (topTab() === 'personal') {
            <div class="card section">
              <h3>Personal Details</h3>
              <div class="kv-grid">
                <div class="kv"><div class="k">Full Name</div><div class="v">{{ e.firstName }} {{ e.lastName }}</div></div>
                <div class="kv"><div class="k">Email ID</div><div class="v">{{ e.email }}</div></div>
                <div class="kv"><div class="k">Phone</div><div class="v">{{ e.phone || '—' }}</div></div>
                <div class="kv"><div class="k">Address</div><div class="v">{{ e.address || '—' }}</div></div>
              </div>
            </div>
          }

          @if (topTab() === 'employment') {
            <div class="card section">
              <h3>Employment Details</h3>
              <div class="kv-grid">
                <div class="kv"><div class="k">Employee ID</div><div class="v">{{ e.employeeCode }}</div></div>
                <div class="kv"><div class="k">Designation</div><div class="v">{{ e.designation || '—' }}</div></div>
                <div class="kv"><div class="k">Department</div><div class="v">{{ e.departmentName || '—' }}</div></div>
                <div class="kv"><div class="k">Reporting Manager</div><div class="v">{{ e.managerName || '—' }}</div></div>
                <div class="kv"><div class="k">Joined On</div><div class="v">{{ formatDate(e.joinedOn) }}</div></div>
                <div class="kv"><div class="k">Tenure</div><div class="v">{{ tenure(e.joinedOn) }}</div></div>
              </div>
            </div>
          }
        </div>

        <aside class="profile-aside">
          <div class="card aside-card">
            <h3>Appreciations <span class="muted">(1)</span></h3>
            <div class="badge-hex">
              <div class="hex">
                <span [innerHTML]="ic.bulb | safeHtml"></span>
                <span class="hex-count">1</span>
              </div>
              <div class="hex-label">Difference Driver</div>
            </div>
          </div>

          @if (canEdit()) {
            <div class="card aside-card">
              <h3>Admin Actions</h3>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <a class="btn btn-sm" [routerLink]="['/employees', e.id, 'edit']">Edit profile</a>
              </div>
            </div>
          }
        </aside>
      </div>
    } @else if (loadError()) {
      <div class="empty">{{ loadError() }}</div>
    } @else {
      <div class="empty">Loading profile…</div>
    }
  `,
  styles: [`
    /* === Banner === */
    .banner {
      position: relative;
      height: 180px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 0;
    }
    .banner-bg {
      position: absolute; inset: 0;
      background: linear-gradient(135deg, #2566e8 0%, #4f8af1 60%, #6c5ce7 100%);
    }
    .banner-bg::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px);
      background-size: 24px 24px, 36px 36px;
      background-position: 0 0, 12px 12px;
    }
    .banner-content {
      position: relative;
      display: flex; align-items: center; gap: 22px;
      padding: 24px 32px;
      color: #fff;
      height: 100%;
    }
    .banner-avatar { position: relative; }
    .banner-avatar ::ng-deep .avatar { border: 4px solid #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
    .banner-cal-badge {
      position: absolute; right: -2px; bottom: -2px;
      width: 30px; height: 30px;
      background: #fff; color: var(--primary);
      border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .banner-cal-badge svg { width: 16px; height: 16px; }
    .banner-text h1 { color: #fff; font-size: 28px; margin: 0 0 4px 0; }
    .banner-sub { font-size: 15px; opacity: 0.92; }
    .banner-sub .dot { margin: 0 8px; opacity: 0.7; }

    /* === Contact bar === */
    .contact-bar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 14px 24px;
      display: flex; align-items: center; gap: 24px;
      flex-wrap: wrap;
    }
    .contact-left { display: flex; gap: 22px; flex-wrap: wrap; flex: 1; min-width: 0; }
    .contact-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-soft); }
    .ci { display: inline-flex; color: var(--muted); }
    .ci svg { width: 14px; height: 14px; }
    .contact-right { display: flex; align-items: center; gap: 8px; }
    .btn-pill { border-radius: 20px; padding: 7px 16px; }
    .btn-pill svg { width: 14px; height: 14px; }
    .ic-action {
      width: 36px; height: 36px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .ic-action:hover { background: var(--surface-soft); color: var(--primary); border-color: var(--primary); }
    .ic-action svg { width: 16px; height: 16px; }

    /* === Tabs === */
    .profile-tabs {
      display: flex; gap: 28px; align-items: center;
      border-bottom: 1px solid var(--border);
      margin: 18px 0 18px 0;
      padding: 0 4px;
    }
    .tab {
      background: transparent; border: none;
      padding: 10px 0;
      font-size: 14px; font-weight: 600;
      color: var(--text-soft);
      cursor: pointer; font-family: inherit;
      position: relative;
    }
    .tab:hover { color: var(--primary); }
    .tab.active { color: var(--primary); }
    .tab.active::after {
      content: '';
      position: absolute; left: 0; right: 0; bottom: -1px;
      height: 3px;
      background: var(--primary);
      border-radius: 2px 2px 0 0;
    }
    .tab-spacer { flex: 1; }
    .tab-search { background: transparent; border: none; cursor: pointer; color: var(--muted); padding: 8px; }
    .tab-search:hover { color: var(--primary); }
    .tab-search svg { width: 18px; height: 18px; }

    .pill-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .pill {
      padding: 7px 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .pill:hover { background: var(--surface-soft); }
    .pill.active { background: #e8f0ff; border-color: #94b6f5; color: var(--primary); }

    /* === Body === */
    .profile-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 18px;
    }
    @media (max-width: 1024px) { .profile-body { grid-template-columns: 1fr; } }
    .profile-main { min-width: 0; }
    .profile-aside { display: flex; flex-direction: column; gap: 14px; }

    .section h3 { margin: 0 0 14px 0; }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px 32px;
    }
    @media (max-width: 600px) { .kv-grid { grid-template-columns: 1fr; gap: 14px; } }
    .kv .k { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .kv .v { font-size: 15px; font-weight: 600; color: var(--text); }

    /* === Org chart === */
    .org-stats { display: flex; align-items: center; font-size: 13px; color: var(--text-soft); margin-bottom: 18px; }
    .org-icon { display: inline-flex; margin-right: 6px; color: var(--muted); }
    .org-icon svg { width: 18px; height: 18px; }

    .org-tree { display: flex; flex-direction: column; align-items: center; }
    .org-card-row { display: flex; justify-content: center; }
    .org-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 18px;
      width: 280px;
      box-shadow: var(--shadow-sm);
    }
    .org-card.current { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft); }
    .org-card.report {
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .org-card.report:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary); }
    .org-card-text { min-width: 0; flex: 1; }
    .org-name { font-weight: 700; font-size: 14px; }
    .org-role, .org-dept { font-size: 12px; }
    .org-line {
      width: 2px; height: 28px;
      background: var(--border);
      margin: 0 auto;
    }
    .org-reports { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }

    /* === Aside === */
    .aside-card h3 { margin: 0 0 12px 0; }
    .badge-hex { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .hex {
      position: relative;
      width: 80px; height: 90px;
      background: linear-gradient(135deg, #fb8c00, #ff7043);
      clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .hex svg { width: 32px; height: 32px; }
    .hex-count {
      position: absolute;
      top: -4px; right: -4px;
      background: rgba(255,255,255,0.95);
      color: #fb8c00;
      width: 22px; height: 22px;
      border-radius: 50%;
      font-size: 12px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .hex-label { font-weight: 600; font-size: 13px; margin-top: 4px; }
  `]
})
export class EmployeeProfileComponent implements OnInit {
  @Input() id?: string;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(EmployeeService);
  private auth = inject(AuthService);

  topTab = signal<TopTab>('overview');
  subTab = signal<OverviewSubTab>('summary');
  employee = signal<Employee | null>(null);
  orgChart = signal<OrgChart | null>(null);
  loadError = signal<string | null>(null);

  canEdit = computed(() => this.auth.hasRole('ADMIN'));

  ic = {
    cal:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    phone:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    mail:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    pin:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    user:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    book:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    tree:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/><path d="M12 6v4M6 18v-4h12v4M12 10v8"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    search:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>`,
    bulb:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.7c-.7.5-1 1.3-1 2V17H9v-.3c0-.7-.3-1.5-1-2A7 7 0 0 1 12 2z"/></svg>`,
  };

  ngOnInit(): void {
    const id = this.id ? Number(this.id) : Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) { this.loadError.set('Invalid employee id'); return; }
    this.svc.get(id).subscribe({
      next: e => this.employee.set(e),
      error: err => this.loadError.set(err?.error?.message ?? 'Failed to load employee')
    });
    this.svc.orgChart(id).subscribe({
      next: o => this.orgChart.set(o),
      error: () => {}
    });
  }

  toggleOrgChart() {
    this.topTab.set('overview');
    this.subTab.set('org');
  }

  goto(id: number) {
    this.router.navigate(['/employees', id]);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  tenure(iso: string): string {
    if (!iso) return '—';
    const start = new Date(iso + 'T00:00:00');
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    if (months < 0) months = 0;
    const years = Math.floor(months / 12);
    const m = months % 12;
    const parts: string[] = [];
    if (years) parts.push(years + ' year' + (years === 1 ? '' : 's'));
    if (m) parts.push(m + ' month' + (m === 1 ? '' : 's'));
    return parts.length ? parts.join(', ') : 'Less than a month';
  }
}
