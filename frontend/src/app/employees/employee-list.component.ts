import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { Department, Employee } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';
import { AvatarComponent } from './avatar.component';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent, SafeHtmlPipe],
  template: `
    <!-- Header with back arrow + title + add button -->
    <div class="dir-header">
      <a class="back" routerLink="/dashboard" title="Back">
        <span [innerHTML]="ic.arrowLeft | safeHtml"></span>
      </a>
      <h2>Employees</h2>
      <span style="flex: 1"></span>
      @if (isAdmin()) {
        <a class="btn btn-primary" routerLink="/employees/new">+ Add employee</a>
      }
    </div>

    <!-- Tabs -->
    <div class="dir-tabs">
      <button class="tab active">Directory</button>
    </div>

    <!-- Search + filter row -->
    <div class="search-row">
      <div class="search-input-wrap" (click)="$event.stopPropagation()">
        <span class="search-ic" [innerHTML]="ic.search | safeHtml"></span>
        <input class="dir-search" type="text"
               [(ngModel)]="q"
               (input)="onSearchInput()"
               (focus)="searchFocused.set(true)"
               (keyup.enter)="apply()"
               placeholder="Search by Employee Name" />
        @if (q) {
          <button class="clear-btn" (click)="clearSearch()" title="Clear"><span [innerHTML]="ic.x | safeHtml"></span></button>
        }

        @if (searchFocused() && q && suggestions().length > 0) {
          <div class="suggest">
            @for (s of suggestions(); track s.id) {
              <button class="suggest-row" (mousedown)="$event.preventDefault()" (click)="openProfile(s.id)">
                <app-avatar [employeeId]="s.id" [photoFilename]="s.photoFilename" [firstName]="s.firstName" [lastName]="s.lastName" [size]="36" />
                <div class="suggest-text">
                  <div class="suggest-name"><strong>{{ s.firstName }}</strong> {{ s.lastName }} <span class="muted">({{ s.employeeCode }})</span></div>
                  <div class="muted small">{{ s.designation || '—' }}@if (s.departmentName) { <span> | {{ s.departmentName }}</span> }</div>
                </div>
              </button>
            }
          </div>
        }
      </div>

      <select class="select dept-select" [(ngModel)]="departmentId" (change)="apply()">
        <option [ngValue]="null">All departments</option>
        @for (d of departments(); track d.id) {
          <option [ngValue]="d.id">{{ d.name }}</option>
        }
      </select>

      <div class="dir-icons">
        <button class="ic-btn" title="Settings"><span [innerHTML]="ic.gear | safeHtml"></span></button>
        <button class="ic-btn" title="Toggle preview"><span [innerHTML]="ic.eye | safeHtml"></span></button>
      </div>
    </div>

    <!-- Body -->
    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (!hasSearched() && rows().length === 0) {
      <div class="empty empty-illust">
        <div class="illust" [innerHTML]="emptyIllust | safeHtml"></div>
        <div class="empty-msg">Search to view records</div>
      </div>
    } @else if (rows().length === 0) {
      <div class="empty">No employees match.</div>
    } @else {
      <div class="card" style="padding: 0;">
        <table class="table">
          <thead>
            <tr>
              <th></th>
              <th>Code</th>
              <th>Name</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Manager</th>
              <th>Joined</th>
              @if (isAdmin()) { <th></th> }
            </tr>
          </thead>
          <tbody>
            @for (e of rows(); track e.id) {
              <tr class="row-clickable" (click)="openProfile(e.id)">
                <td (click)="$event.stopPropagation()">
                  <app-avatar [employeeId]="e.id" [photoFilename]="e.photoFilename" [firstName]="e.firstName" [lastName]="e.lastName" [size]="32" />
                </td>
                <td><code>{{ e.employeeCode }}</code></td>
                <td><strong>{{ e.firstName }} {{ e.lastName }}</strong></td>
                <td>{{ e.email }}</td>
                <td>{{ e.designation || '—' }}</td>
                <td>{{ e.departmentName || '—' }}</td>
                <td>{{ e.managerName || '—' }}</td>
                <td>{{ e.joinedOn }}</td>
                @if (isAdmin()) {
                  <td (click)="$event.stopPropagation()">
                    <a class="btn btn-sm" [routerLink]="['/employees', e.id, 'edit']">Edit</a>
                    <button class="btn btn-sm btn-danger" (click)="remove(e)">Delete</button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .dir-header {
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 16px;
    }
    .dir-header h2 { margin: 0; }
    .back {
      width: 36px; height: 36px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--text-soft);
      border-radius: 8px;
      text-decoration: none;
    }
    .back:hover { background: var(--surface-soft); color: var(--primary); text-decoration: none; }
    .back svg { width: 20px; height: 20px; }

    .dir-tabs { border-bottom: 1px solid var(--border); margin-bottom: 18px; }
    .dir-tabs .tab {
      background: transparent; border: none;
      padding: 10px 0; margin-right: 24px;
      font-size: 14px; font-weight: 700;
      color: var(--text-soft);
      cursor: pointer; font-family: inherit;
      position: relative;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .dir-tabs .tab.active { color: var(--primary); }
    .dir-tabs .tab.active::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: -1px;
      height: 3px; background: var(--primary); border-radius: 2px 2px 0 0;
    }

    .search-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .search-input-wrap { position: relative; flex: 1; min-width: 280px; max-width: 480px; }
    .search-ic { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); display: inline-flex; }
    .search-ic svg { width: 16px; height: 16px; }
    .dir-search {
      width: 100%;
      padding: 12px 40px 12px 44px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 14px; font-family: inherit; color: var(--text);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .dir-search:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-glow); }
    .clear-btn {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      width: 22px; height: 22px;
      border: none; background: transparent; color: var(--muted);
      border-radius: 50%; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .clear-btn:hover { background: var(--surface-soft); color: var(--text); }
    .clear-btn svg { width: 14px; height: 14px; }

    .suggest {
      position: absolute;
      top: calc(100% + 6px); left: 0; right: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      z-index: 10;
      max-height: 360px; overflow-y: auto;
    }
    .suggest-row {
      width: 100%;
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px;
      border: none; background: transparent;
      text-align: left; cursor: pointer; font-family: inherit;
      transition: background 0.12s;
    }
    .suggest-row:hover { background: var(--surface-soft); }
    .suggest-name { font-size: 14px; }
    .suggest-text { min-width: 0; }
    .small { font-size: 12px; }

    .dept-select { width: 200px; }
    .dir-icons { display: flex; gap: 6px; margin-left: auto; }
    .ic-btn {
      width: 36px; height: 36px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .ic-btn:hover { background: var(--surface-soft); color: var(--primary); }
    .ic-btn svg { width: 16px; height: 16px; }

    .empty-illust { padding: 60px 20px; text-align: center; }
    .illust { display: flex; justify-content: center; margin-bottom: 14px; opacity: 0.95; }
    .illust svg { max-width: 280px; height: auto; }
    .empty-msg { color: var(--text-soft); font-weight: 500; font-size: 14px; }

    code { background: var(--surface-soft); padding: 2px 6px; border-radius: 4px; font-size: 12px; color: var(--text); }
    .row-clickable { cursor: pointer; }
  `]
})
export class EmployeeListComponent {
  private svc = inject(EmployeeService);
  private auth = inject(AuthService);
  private router = inject(Router);

  q = '';
  departmentId: number | null = null;
  rows = signal<Employee[]>([]);
  suggestions = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  loading = signal(false);
  hasSearched = signal(false);
  searchFocused = signal(false);

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  ic = {
    arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    search:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>`,
    x:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    gear:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    eye:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  };

  emptyIllust = `<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#a8c0e6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="160" cy="200" rx="130" ry="10" fill="#eaf0fb" stroke="none"/>
    <rect x="80" y="60" width="160" height="120" rx="6" fill="#fff"/>
    <line x1="80" y1="80" x2="240" y2="80"/>
    <circle cx="92" cy="70" r="2" fill="#a8c0e6" stroke="none"/>
    <circle cx="100" cy="70" r="2" fill="#a8c0e6" stroke="none"/>
    <circle cx="108" cy="70" r="2" fill="#a8c0e6" stroke="none"/>
    <line x1="100" y1="100" x2="220" y2="100"/>
    <line x1="100" y1="115" x2="200" y2="115"/>
    <line x1="100" y1="130" x2="220" y2="130"/>
    <line x1="100" y1="145" x2="180" y2="145"/>
    <circle cx="180" cy="145" r="34" fill="#fff"/>
    <circle cx="180" cy="145" r="34"/>
    <line x1="206" y1="170" x2="226" y2="190"/>
    <circle cx="180" cy="135" r="6"/>
    <path d="M168 154c0-6 6-10 12-10s12 4 12 10"/>
    <path d="M40 130c2-30 28-60 60-60" opacity="0.4"/>
    <circle cx="50" cy="150" r="8" fill="#9fc7a6" stroke="none"/>
    <path d="M40 160c4-4 16-4 20 0" stroke="#9fc7a6"/>
  </svg>`;

  constructor() {
    this.svc.departments().subscribe(d => this.departments.set(d));
  }

  onSearchInput() {
    if (!this.q || this.q.length < 1) {
      this.suggestions.set([]);
      return;
    }
    this.svc.list({ q: this.q, departmentId: this.departmentId }).subscribe(r => {
      this.suggestions.set(r.slice(0, 8));
    });
  }

  apply() {
    this.hasSearched.set(true);
    this.loading.set(true);
    this.searchFocused.set(false);
    this.svc.list({ q: this.q, departmentId: this.departmentId }).subscribe({
      next: r => { this.rows.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  clearSearch() {
    this.q = '';
    this.suggestions.set([]);
  }

  openProfile(id: number) {
    this.searchFocused.set(false);
    this.router.navigate(['/employees', id]);
  }

  remove(e: Employee) {
    if (!confirm(`Delete ${e.firstName} ${e.lastName}?`)) return;
    this.svc.delete(e.id).subscribe({
      next: () => this.apply(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }
}
