import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { MarkdownLitePipe } from '../core/markdown.pipe';
import { PolicyService } from '../core/policy.service';
import { Policy, PolicyCategory, PolicySummary } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

const CATEGORY_META: Record<PolicyCategory, { label: string; color: string; }> = {
  LEAVE:           { label: 'Leave',           color: '#2566e8' },
  ATTENDANCE:      { label: 'Attendance',      color: '#388e3c' },
  CODE_OF_CONDUCT: { label: 'Code of Conduct', color: '#6c5ce7' },
  REMOTE_WORK:     { label: 'Remote Work',     color: '#0288d1' },
  SECURITY:        { label: 'Security',        color: '#b34700' },
  EXPENSE:         { label: 'Expense',         color: '#f5a623' },
  IT:              { label: 'IT',              color: '#5e35b1' },
  HR_GENERAL:      { label: 'HR / General',    color: '#6b7280' },
};

@Component({
  selector: 'app-policies-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe, MarkdownLitePipe],
  template: `
    <div class="page-bar">
      <h2>HR Policies</h2>
      <div class="search-wrap">
        <input class="input" [(ngModel)]="searchQuery" placeholder="Search policies…" />
      </div>
      @if (isAdmin()) {
        <button class="btn btn-primary" (click)="openCreate()">+ New policy</button>
      }
    </div>

    <div class="layout">
      <!-- Left: category sidebar + list -->
      <aside class="left-rail">
        <div class="cat-list card">
          <div class="cat-list-title">Categories</div>
          <button class="cat-row" [class.active]="filterCategory() == null" (click)="filterCategory.set(null)">
            <span class="cat-dot" style="background: #888"></span>
            <span>All</span>
            <span class="muted" style="margin-left: auto;">{{ allCount() }}</span>
          </button>
          @for (c of categoryOrder; track c) {
            <button class="cat-row" [class.active]="filterCategory() === c" (click)="filterCategory.set(c)">
              <span class="cat-dot" [style.background]="meta(c).color"></span>
              <span>{{ meta(c).label }}</span>
              <span class="muted" style="margin-left: auto;">{{ counts()[c] || 0 }}</span>
            </button>
          }
        </div>

        <div class="card" style="margin-top: 14px;">
          <div class="cat-list-title">Acknowledged</div>
          <div class="ack-summary">
            <div class="ack-num">{{ ackedCount() }} <span class="muted">/ {{ filtered().length }}</span></div>
            <div class="ack-bar"><div class="ack-fill" [style.width.%]="ackPct()"></div></div>
            <div class="muted small">in the current filter</div>
          </div>
        </div>
      </aside>

      <!-- Center: policy list -->
      <div class="list-col">
        @if (filtered().length === 0) {
          <div class="empty">No policies match.</div>
        } @else {
          <div class="policy-list">
            @for (p of filtered(); track p.id) {
              <button class="policy-row" [class.active]="selectedId() === p.id" (click)="select(p.id)">
                <span class="cat-tag" [style.background]="meta(p.category).color">{{ meta(p.category).label }}</span>
                <div class="policy-row-text">
                  <div class="policy-row-title">{{ p.title }}</div>
                  @if (p.summary) { <div class="muted small policy-row-sub">{{ p.summary }}</div> }
                  <div class="muted small">v{{ p.version }} · effective {{ p.effectiveFrom }}</div>
                </div>
                @if (p.acknowledged) { <span class="ack-pill" title="Acknowledged">✓</span> }
              </button>
            }
          </div>
        }
      </div>

      <!-- Right: selected policy content -->
      <div class="detail-col">
        @if (selected(); as s) {
          <div class="card detail-card">
            <div class="detail-head">
              <span class="cat-tag" [style.background]="meta(s.category).color">{{ meta(s.category).label }}</span>
              <span class="ack-count muted">
                {{ s.ackCount }} {{ s.ackCount === 1 ? 'acknowledgement' : 'acknowledgements' }}
              </span>
            </div>
            <h2 style="margin-top: 12px;">{{ s.title }}</h2>
            <div class="muted small" style="margin-top: 4px;">
              Version <strong>{{ s.version }}</strong> · Effective {{ s.effectiveFrom }}
              @if (s.ownerName) { · Owner: {{ s.ownerName }} }
              @if (s.updatedAt) { · Updated {{ formatDate(s.updatedAt) }} }
            </div>

            <div class="md-body" [innerHTML]="s.contentMarkdown | mdLite | safeHtml"></div>

            <div class="detail-foot">
              @if (s.acknowledged) {
                <span class="ack-stamp">
                  <span class="check" [innerHTML]="ic.check | safeHtml"></span>
                  Acknowledged on {{ formatDate(s.acknowledgedAt) }}
                </span>
              } @else {
                <button class="btn btn-primary" (click)="acknowledge(s)" [disabled]="ackBusy()">
                  {{ ackBusy() ? 'Saving…' : 'I have read & acknowledge' }}
                </button>
              }
              @if (isAdmin()) {
                <span style="flex: 1;"></span>
                <button class="btn btn-sm" (click)="openEdit(s)">Edit</button>
                <button class="btn btn-sm btn-danger" (click)="onDelete(s)">Delete</button>
              }
            </div>
          </div>
        } @else {
          <div class="empty">Pick a policy on the left to read it.</div>
        }
      </div>
    </div>

    <!-- Editor drawer -->
    @if (editorOpen()) {
      <div class="drawer-backdrop" (click)="closeEditor()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>{{ editingId() ? 'Edit policy' : 'New policy' }}</h2>
          <button class="close-btn" (click)="closeEditor()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Title <span class="req">*</span></label>
              <input class="input" formControlName="title" />
            </div>
            <div class="row two">
              <div class="field">
                <label>Category <span class="req">*</span></label>
                <select class="select" formControlName="category">
                  <option value="" disabled>Select…</option>
                  @for (c of categoryOrder; track c) {
                    <option [value]="c">{{ meta(c).label }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>Version <span class="req">*</span></label>
                <input class="input" formControlName="version" placeholder="v1.0" />
              </div>
            </div>
            <div class="field">
              <label>Effective from</label>
              <input class="input" type="date" formControlName="effectiveFrom" />
            </div>
            <div class="field">
              <label>Summary</label>
              <input class="input" formControlName="summary" placeholder="One-line overview" />
            </div>
            <div class="field">
              <label>Content (markdown) <span class="req">*</span></label>
              <textarea formControlName="contentMarkdown" rows="14" placeholder="# Heading&#10;&#10;Paragraphs, **bold**, *italic*, lists, tables…"></textarea>
            </div>
            @if (editorErr()) { <div class="error">{{ editorErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeEditor()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="form.invalid || editorBusy()">
            {{ editorBusy() ? 'Saving…' : (editingId() ? 'Save changes' : 'Publish policy') }}
          </button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; flex-wrap: wrap; }
    .page-bar h2 { margin: 0; flex: 0 0 auto; }
    .search-wrap { flex: 1; max-width: 360px; }
    .small { font-size: 12px; }

    .layout {
      display: grid;
      grid-template-columns: 240px minmax(280px, 1fr) minmax(420px, 1.4fr);
      gap: 16px;
      align-items: flex-start;
    }
    @media (max-width: 1024px) {
      .layout { grid-template-columns: 1fr; }
    }

    /* Category sidebar */
    .cat-list { padding: 12px; }
    .cat-list-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 4px 10px 8px 10px; }
    .cat-row {
      width: 100%;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border: none; background: transparent;
      cursor: pointer; font-family: inherit;
      border-radius: 8px;
      font-size: 13px; color: var(--text);
      text-align: left;
      transition: background 0.12s;
    }
    .cat-row:hover { background: var(--surface-soft); }
    .cat-row.active { background: var(--primary-soft); color: var(--primary-deep); font-weight: 600; }
    .cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    .ack-summary { padding: 8px 10px; }
    .ack-num { font-size: 20px; font-weight: 800; color: var(--primary-deep); }
    .ack-bar { height: 6px; background: var(--surface-soft); border-radius: 999px; margin: 8px 0; overflow: hidden; }
    .ack-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 999px; transition: width 0.2s ease; }

    /* Policy list */
    .policy-list { display: flex; flex-direction: column; gap: 8px; }
    .policy-row {
      width: 100%;
      display: flex; align-items: flex-start; gap: 10px;
      padding: 14px;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }
    .policy-row:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary); }
    .policy-row.active { border-color: var(--primary); background: var(--primary-soft); }
    .policy-row-text { flex: 1; min-width: 0; }
    .policy-row-title { font-weight: 700; font-size: 14px; }
    .policy-row-sub { margin-top: 4px; }
    .ack-pill {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--primary-soft);
      color: var(--primary-deep);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      flex-shrink: 0;
    }

    .cat-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    /* Detail */
    .detail-card { padding: 26px; }
    .detail-head { display: flex; align-items: center; justify-content: space-between; }
    .ack-count { font-size: 12px; }
    .md-body { margin-top: 18px; font-size: 14px; line-height: 1.65; color: var(--text); }
    .md-body :is(h1, h2, h3) { margin: 18px 0 8px 0; }
    .md-body h1 { font-size: 22px; }
    .md-body h2 { font-size: 17px; }
    .md-body h3 { font-size: 15px; }
    .md-body p { margin: 10px 0; }
    .md-body ul, .md-body ol { padding-left: 22px; margin: 8px 0; }
    .md-body code {
      background: var(--surface-soft);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.92em;
      color: var(--primary-deep);
    }
    .md-body .md-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .md-body .md-table th, .md-body .md-table td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .md-body .md-table th { background: var(--surface-soft); font-weight: 700; }

    .detail-foot {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px dashed var(--border);
      display: flex; align-items: center; gap: 10px;
    }
    .ack-stamp {
      display: inline-flex; align-items: center; gap: 8px;
      color: var(--primary-deep);
      font-weight: 600; font-size: 13px;
      background: var(--primary-soft);
      padding: 6px 12px;
      border-radius: 999px;
    }
    .ack-stamp .check { display: inline-flex; }
    .ack-stamp .check svg { width: 16px; height: 16px; }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(640px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
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
export class PoliciesPageComponent {
  private svc = inject(PolicyService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  policies = signal<PolicySummary[]>([]);
  counts = signal<Record<string, number>>({});
  filterCategory = signal<PolicyCategory | null>(null);
  selectedId = signal<number | null>(null);
  selected = signal<Policy | null>(null);
  ackBusy = signal(false);
  searchQuery = '';

  editorOpen = signal(false);
  editorBusy = signal(false);
  editorErr = signal<string | null>(null);
  editingId = signal<number | null>(null);
  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    category: ['' as PolicyCategory | '', Validators.required],
    summary: [''],
    contentMarkdown: ['', Validators.required],
    version: ['v1.0', Validators.required],
    effectiveFrom: [new Date().toISOString().slice(0, 10)]
  });

  categoryOrder: PolicyCategory[] = ['LEAVE', 'ATTENDANCE', 'CODE_OF_CONDUCT', 'REMOTE_WORK', 'EXPENSE', 'SECURITY', 'IT', 'HR_GENERAL'];

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));

  filtered = computed(() => {
    const cat = this.filterCategory();
    const q = this.searchQuery.trim().toLowerCase();
    return this.policies().filter(p =>
      (cat == null || p.category === cat) &&
      (q === '' || p.title.toLowerCase().includes(q) || (p.summary ?? '').toLowerCase().includes(q))
    );
  });

  ackedCount = computed(() => this.filtered().filter(p => p.acknowledged).length);
  ackPct = computed(() => {
    const total = this.filtered().length;
    return total === 0 ? 0 : Math.round((this.ackedCount() / total) * 100);
  });
  allCount = computed(() => this.policies().length);

  ic = {
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() { this.refresh(); }

  refresh() {
    this.svc.list().subscribe(r => {
      this.policies.set(r);
      if (this.selectedId() == null && r.length > 0) this.select(r[0].id);
    });
    this.svc.categoryCounts().subscribe(c => this.counts.set(c));
  }

  meta(c: PolicyCategory) { return CATEGORY_META[c]; }

  select(id: number) {
    this.selectedId.set(id);
    this.svc.get(id).subscribe(p => this.selected.set(p));
  }

  acknowledge(p: Policy) {
    this.ackBusy.set(true);
    this.svc.acknowledge(p.id).subscribe({
      next: (updated) => {
        this.ackBusy.set(false);
        this.selected.set(updated);
        // also flag in the list
        this.policies.update(list => list.map(x => x.id === updated.id ? { ...x, acknowledged: true } : x));
      },
      error: () => this.ackBusy.set(false)
    });
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* Editor */

  openCreate() {
    this.editingId.set(null);
    this.form.reset({
      title: '', category: '' as PolicyCategory | '',
      summary: '', contentMarkdown: '',
      version: 'v1.0',
      effectiveFrom: new Date().toISOString().slice(0, 10)
    });
    this.editorErr.set(null);
    this.editorOpen.set(true);
  }

  openEdit(p: Policy) {
    this.editingId.set(p.id);
    this.form.setValue({
      title: p.title,
      category: p.category,
      summary: p.summary ?? '',
      contentMarkdown: p.contentMarkdown,
      version: p.version,
      effectiveFrom: p.effectiveFrom
    });
    this.editorErr.set(null);
    this.editorOpen.set(true);
  }

  closeEditor() { this.editorOpen.set(false); }

  submit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.editorBusy.set(true);
    this.editorErr.set(null);
    const body = {
      title: v.title!,
      category: v.category as PolicyCategory,
      summary: v.summary ?? undefined,
      contentMarkdown: v.contentMarkdown!,
      version: v.version!,
      effectiveFrom: v.effectiveFrom ?? undefined
    };
    const id = this.editingId();
    const obs = id ? this.svc.update(id, body) : this.svc.create(body);
    obs.subscribe({
      next: (p) => {
        this.editorBusy.set(false);
        this.closeEditor();
        this.refresh();
        this.select(p.id);
      },
      error: (err) => {
        this.editorErr.set(err?.error?.message ?? 'Save failed');
        this.editorBusy.set(false);
      }
    });
  }

  onDelete(p: Policy) {
    if (!confirm(`Delete policy "${p.title}"?`)) return;
    this.svc.delete(p.id).subscribe({
      next: () => {
        this.selectedId.set(null); this.selected.set(null);
        this.refresh();
      },
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }
}
