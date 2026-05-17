import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { DocumentService } from '../core/document.service';
import { EmployeeService } from '../core/employee.service';
import { DocumentCategory, Employee, EmployeeDocument } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

type Tab = 'mine' | 'employee';

const CATEGORY_META: Record<DocumentCategory, { label: string; color: string; }> = {
  AADHAR:       { label: 'Aadhar',       color: '#2566e8' },
  PAN:          { label: 'PAN',          color: '#6c5ce7' },
  PASSPORT:     { label: 'Passport',     color: '#0288d1' },
  RESUME:       { label: 'Resume',       color: '#388e3c' },
  OFFER_LETTER: { label: 'Offer letter', color: '#f5a623' },
  CONTRACT:     { label: 'Contract',     color: '#b34700' },
  PAYSLIP:      { label: 'Payslip',      color: '#5e35b1' },
  CERTIFICATE:  { label: 'Certificate',  color: '#00838f' },
  OTHER:        { label: 'Other',        color: '#6b7280' }
};

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>HR Documents</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'mine'"     (click)="onTab('mine')">My Documents</button>
        @if (canManage()) {
          <button class="tab" [class.active]="tab() === 'employee'" (click)="onTab('employee')">Employee Documents</button>
        }
      </div>
      <button class="btn btn-primary" (click)="openUpload()">+ Upload document</button>
    </div>

    @if (tab() === 'employee') {
      <div class="toolbar">
        <div style="flex: 1;">
          <label class="muted">Employee</label>
          <select class="select" [(ngModel)]="selectedEmployeeId" (change)="loadEmployeeDocs()">
            <option [ngValue]="null" disabled>Pick an employee…</option>
            @for (e of employees(); track e.id) {
              <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
            }
          </select>
        </div>
      </div>
    }

    <!-- Stats row -->
    <div class="stats-row" style="margin-bottom: 18px;">
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.docs | safeHtml"></div>
        <div>
          <div class="stat-tile-value">{{ visibleDocs().length }}</div>
          <div class="stat-tile-label">Total documents</div>
        </div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.folder | safeHtml"></div>
        <div>
          <div class="stat-tile-value">{{ uniqueCategories() }}</div>
          <div class="stat-tile-label">Categories</div>
        </div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-icon" [innerHTML]="ic.cloud | safeHtml"></div>
        <div>
          <div class="stat-tile-value">{{ totalSize() }}</div>
          <div class="stat-tile-label">Storage used</div>
        </div>
      </div>
    </div>

    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (tab() === 'employee' && selectedEmployeeId == null) {
      <div class="empty">Pick an employee to view their documents.</div>
    } @else if (visibleDocs().length === 0) {
      <div class="empty">
        No documents yet.
        <div style="margin-top: 10px;"><button class="btn btn-primary" (click)="openUpload()">Upload first document</button></div>
      </div>
    } @else {
      @for (group of groupedDocs(); track group.category) {
        <div class="cat-section">
          <div class="cat-header">
            <span class="cat-tag" [style.background]="meta(group.category).color">{{ meta(group.category).label }}</span>
            <span class="muted small">{{ group.items.length }} document(s)</span>
          </div>
          <div class="doc-grid">
            @for (d of group.items; track d.id) {
              <div class="doc-card">
                <div class="doc-thumb" [innerHTML]="ic.file | safeHtml" [style.color]="meta(d.category).color"></div>
                <div class="doc-info">
                  <div class="doc-name" [title]="d.filename">{{ d.filename }}</div>
                  <div class="muted small">{{ formatSize(d.sizeBytes) }} · {{ formatDate(d.uploadedAt) }}</div>
                  @if (d.uploadedByName) { <div class="muted small">Uploaded by {{ d.uploadedByName }}</div> }
                  @if (d.description) { <div class="muted small doc-desc" [title]="d.description">{{ d.description }}</div> }
                </div>
                <div class="doc-actions">
                  <button class="btn btn-sm" (click)="download(d)" [disabled]="downloadingId() === d.id">
                    {{ downloadingId() === d.id ? '…' : 'Download' }}
                  </button>
                  <button class="btn btn-sm btn-danger" (click)="onDelete(d)">Delete</button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    }

    <!-- Upload drawer -->
    @if (uploadOpen()) {
      <div class="drawer-backdrop" (click)="closeUpload()"></div>
      <aside class="drawer" (click)="$event.stopPropagation()">
        <header class="drawer-head">
          <h2>Upload document</h2>
          <button class="close-btn" (click)="closeUpload()" title="Close">
            <span [innerHTML]="ic.close | safeHtml"></span>
          </button>
        </header>
        <div class="drawer-body">
          <form [formGroup]="uploadForm" (ngSubmit)="submitUpload()">
            @if (canManage() && tab() === 'employee') {
              <div class="field">
                <label>For employee <span class="req">*</span></label>
                <select class="select" formControlName="targetEmployeeId">
                  <option [ngValue]="null" disabled>Pick an employee…</option>
                  @for (e of employees(); track e.id) {
                    <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                  }
                </select>
              </div>
            }
            <div class="field">
              <label>Category <span class="req">*</span></label>
              <select class="select" formControlName="category">
                <option value="" disabled>Select category…</option>
                @for (c of categoryList; track c.value) {
                  <option [value]="c.value">{{ c.label }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Description</label>
              <textarea formControlName="description" rows="3" placeholder="Optional context…"></textarea>
            </div>
            <div class="field">
              <label>File <span class="req">*</span></label>
              <div class="dropzone" (click)="onPickFile()"
                   [class.dragover]="dragOver()"
                   (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
                <span class="upload-ic" [innerHTML]="ic.upload | safeHtml"></span>
                <div class="dz-text">
                  @if (selectedFile()) {
                    Selected: <strong>{{ selectedFile()!.name }}</strong> ({{ formatSize(selectedFile()!.size) }})
                  } @else {
                    Drag &amp; drop or <a class="link">Browse files</a>
                  }
                </div>
                <div class="dz-types">PDF, JPG, PNG, DOC, DOCX, CSV, XLSX · max 15 MB</div>
                <input #fileInput type="file" hidden (change)="onFiles($any($event.target).files)" />
              </div>
            </div>
            @if (uploadErr()) { <div class="error">{{ uploadErr() }}</div> }
          </form>
        </div>
        <footer class="drawer-foot">
          <button class="btn" type="button" (click)="closeUpload()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitUpload()" [disabled]="uploadBusy() || !canSubmit()">
            {{ uploadBusy() ? 'Uploading…' : 'Upload' }}
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
    .small { font-size: 12px; }

    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }

    .cat-section { margin-bottom: 24px; }
    .cat-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .cat-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      color: #fff;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.04em;
    }

    .doc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .doc-card {
      display: flex; gap: 14px;
      padding: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .doc-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .doc-thumb {
      width: 44px; height: 56px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      border-radius: 6px;
      flex-shrink: 0;
    }
    .doc-thumb svg { width: 22px; height: 22px; }
    .doc-info { flex: 1; min-width: 0; }
    .doc-name {
      font-weight: 700; font-size: 13px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .doc-desc { margin-top: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .doc-actions { display: flex; flex-direction: column; gap: 6px; }

    /* Drawer */
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--surface); z-index: 101; display: flex; flex-direction: column; box-shadow: -18px 0 48px rgba(15,21,37,0.18); animation: slideIn 0.22s ease both; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .drawer-head { padding: 22px 26px 16px 26px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .drawer-head h2 { margin: 0; font-size: 20px; }
    .close-btn { width: 36px; height: 36px; border: none; background: transparent; color: var(--text-soft); border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .drawer-body { flex: 1; overflow-y: auto; padding: 22px 26px; }
    .drawer-foot { padding: 16px 26px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
    .req { color: var(--danger); margin-left: 2px; }

    .dropzone {
      border: 2px dashed var(--border-strong);
      border-radius: 10px;
      background: var(--surface-soft);
      padding: 28px 16px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .dropzone:hover { border-color: var(--primary); background: #fbfdff; }
    .dropzone.dragover { border-color: var(--primary); background: var(--primary-soft); }
    .upload-ic { display: inline-flex; color: var(--muted); margin-bottom: 8px; }
    .upload-ic svg { width: 28px; height: 28px; }
    .dz-text { font-size: 14px; color: var(--text); }
    .dz-text .link { color: var(--primary); cursor: pointer; font-weight: 600; }
    .dz-types { font-size: 11px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
  `]
})
export class DocumentsPageComponent {
  private svc = inject(DocumentService);
  private auth = inject(AuthService);
  private employeeSvc = inject(EmployeeService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('mine');
  loading = signal(false);
  selectedEmployeeId: number | null = null;
  mineDocs = signal<EmployeeDocument[]>([]);
  employeeDocs = signal<EmployeeDocument[]>([]);
  employees = signal<Employee[]>([]);
  downloadingId = signal<number | null>(null);

  uploadOpen = signal(false);
  uploadBusy = signal(false);
  uploadErr = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  dragOver = signal(false);

  uploadForm = this.fb.group({
    targetEmployeeId: [null as number | null],
    category: ['' as DocumentCategory | '', Validators.required],
    description: ['']
  });

  categoryList = (Object.keys(CATEGORY_META) as DocumentCategory[]).map(value => ({ value, label: CATEGORY_META[value].label }));

  canManage = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));

  visibleDocs = computed(() => this.tab() === 'mine' ? this.mineDocs() : this.employeeDocs());

  uniqueCategories = computed(() => new Set(this.visibleDocs().map(d => d.category)).size);

  totalSize = computed(() => {
    const total = this.visibleDocs().reduce((s, d) => s + d.sizeBytes, 0);
    return this.formatSize(total);
  });

  groupedDocs = computed(() => {
    const groups: Record<string, EmployeeDocument[]> = {};
    for (const d of this.visibleDocs()) {
      (groups[d.category] ||= []).push(d);
    }
    return Object.keys(groups)
      .sort((a, b) => CATEGORY_META[a as DocumentCategory].label.localeCompare(CATEGORY_META[b as DocumentCategory].label))
      .map(k => ({ category: k as DocumentCategory, items: groups[k] }));
  });

  canSubmit(): boolean {
    if (this.uploadForm.invalid || !this.selectedFile()) return false;
    if (this.canManage() && this.tab() === 'employee' && this.uploadForm.value.targetEmployeeId == null) return false;
    return true;
  }

  ic = {
    docs:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    folder:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    cloud:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10a6 6 0 0 0-11.6-1.5A4.5 4.5 0 0 0 6 17h12a4 4 0 0 0 0-7z"/></svg>`,
    file:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6" fill="#fff" stroke="currentColor"/></svg>`,
    upload:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    close:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() {
    this.refresh();
    if (this.canManage()) {
      this.employeeSvc.list().subscribe(list => this.employees.set(list));
    }
  }

  refresh() {
    this.loading.set(true);
    this.svc.myDocs().subscribe({
      next: r => { this.mineDocs.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onTab(t: Tab) {
    this.tab.set(t);
    if (t === 'employee' && this.selectedEmployeeId != null) this.loadEmployeeDocs();
  }

  loadEmployeeDocs() {
    if (this.selectedEmployeeId == null) return;
    this.loading.set(true);
    this.svc.employeeDocs(this.selectedEmployeeId).subscribe({
      next: r => { this.employeeDocs.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  meta(c: DocumentCategory) { return CATEGORY_META[c]; }

  formatSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* Upload */

  openUpload() {
    this.uploadErr.set(null);
    this.selectedFile.set(null);
    this.uploadForm.reset({
      targetEmployeeId: this.tab() === 'employee' ? this.selectedEmployeeId : null,
      category: '' as DocumentCategory | '',
      description: ''
    });
    this.uploadOpen.set(true);
  }
  closeUpload() { this.uploadOpen.set(false); }

  onPickFile() {
    const input = document.querySelector<HTMLInputElement>('input[type=file]');
    input?.click();
  }

  onDragOver(ev: DragEvent) { ev.preventDefault(); this.dragOver.set(true); }
  onDrop(ev: DragEvent) {
    ev.preventDefault(); this.dragOver.set(false);
    if (ev.dataTransfer?.files) this.onFiles(ev.dataTransfer.files);
  }
  onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const f = list[0];
    if (f.size > 15 * 1024 * 1024) { this.uploadErr.set(`${f.name} exceeds 15 MB`); return; }
    this.uploadErr.set(null);
    this.selectedFile.set(f);
  }

  submitUpload() {
    if (!this.canSubmit()) return;
    const f = this.selectedFile()!;
    const v = this.uploadForm.value;
    const cat = v.category as DocumentCategory;
    this.uploadBusy.set(true);
    this.uploadErr.set(null);

    const obs = (this.canManage() && this.tab() === 'employee' && v.targetEmployeeId)
      ? this.svc.uploadFor(v.targetEmployeeId, f, cat, v.description ?? undefined)
      : this.svc.uploadMine(f, cat, v.description ?? undefined);

    obs.subscribe({
      next: () => {
        this.uploadBusy.set(false);
        this.closeUpload();
        if (this.tab() === 'mine') this.refresh();
        else this.loadEmployeeDocs();
      },
      error: (err) => {
        this.uploadErr.set(err?.error?.message ?? 'Upload failed');
        this.uploadBusy.set(false);
      }
    });
  }

  /* Download / delete */

  download(d: EmployeeDocument) {
    this.downloadingId.set(d.id);
    this.svc.downloadBlob(d.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloadingId.set(null);
      },
      error: (err) => {
        alert(err?.error?.message ?? 'Download failed');
        this.downloadingId.set(null);
      }
    });
  }

  onDelete(d: EmployeeDocument) {
    if (!confirm(`Delete "${d.filename}"?`)) return;
    this.svc.delete(d.id).subscribe({
      next: () => {
        if (this.tab() === 'mine') this.refresh();
        else this.loadEmployeeDocs();
      },
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }
}
