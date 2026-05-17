import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { PayrollService } from '../core/payroll.service';
import { Employee, Payslip, PayslipGenerateResult, SalaryStructure } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';
import { PayslipDetailComponent } from './payslip-detail.component';

type Tab = 'mine' | 'structures' | 'generate';

@Component({
  selector: 'app-payroll-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, SafeHtmlPipe, PayslipDetailComponent],
  template: `
    <!-- Header with tabs -->
    <div class="page-bar">
      <h2>Payroll</h2>
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'mine'" (click)="tab.set('mine')">My Payslips</button>
        @if (canManage()) {
          <button class="tab" [class.active]="tab() === 'structures'" (click)="tab.set('structures')">Salary Structure</button>
        }
        @if (isAdmin()) {
          <button class="tab" [class.active]="tab() === 'generate'" (click)="tab.set('generate')">Generate</button>
        }
      </div>
    </div>

    @if (tab() === 'mine') {
      @if (mineLoading()) {
        <div class="empty">Loading…</div>
      } @else if (mine().length === 0) {
        <div class="empty">
          No payslips released yet.
          @if (isAdmin()) {
            <div style="margin-top: 8px;">
              <button class="btn btn-primary" (click)="tab.set('generate')">Generate payslips</button>
            </div>
          }
        </div>
      } @else {
        <div class="payslip-grid">
          @for (p of mine(); track p.id) {
            <div class="payslip-card" (click)="openDetail(p)">
              <div class="ps-head">
                <div>
                  <div class="ps-month">{{ monthName(p.month) }} {{ p.year }}</div>
                  <div class="muted small">Payslip #{{ p.id }}</div>
                </div>
                <span class="badge badge-approved">Released</span>
              </div>
              <div class="ps-net">
                <div class="muted small">Net pay</div>
                <div class="ps-net-amount">₹ {{ formatMoney(p.netSalary) }}</div>
              </div>
              <div class="ps-meta">
                <div class="meta-pair">
                  <div class="muted small">Gross</div>
                  <div>₹ {{ formatMoney(p.grossSalary) }}</div>
                </div>
                <div class="meta-pair">
                  <div class="muted small">Deductions</div>
                  <div>₹ {{ formatMoney(p.deductions) }}</div>
                </div>
                <div class="meta-pair">
                  <div class="muted small">Days</div>
                  <div>{{ p.paidDays }} / {{ p.workingDays }}</div>
                </div>
              </div>
              <div class="ps-foot">
                <button class="btn btn-sm" (click)="$event.stopPropagation(); downloadPdf(p)" [disabled]="downloadingId() === p.id">
                  {{ downloadingId() === p.id ? 'Preparing…' : 'Download PDF' }}
                </button>
                <button class="btn btn-sm btn-primary" (click)="$event.stopPropagation(); openDetail(p)">View</button>
              </div>
            </div>
          }
        </div>
      }
    }

    @if (tab() === 'structures') {
      <div class="card structure-card">
        <div class="toolbar" style="margin: 0 0 16px 0;">
          <div style="flex: 1;">
            <label class="muted">Employee</label>
            <select class="select" [(ngModel)]="selectedEmployeeId" (change)="onEmployeeChange()">
              <option [ngValue]="null" disabled>Select an employee…</option>
              @for (e of employees(); track e.id) {
                <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
              }
            </select>
          </div>
        </div>

        @if (selectedEmployeeId === null) {
          <div class="empty">Pick an employee to view their salary structures.</div>
        } @else if (structures().length === 0) {
          <div class="empty">
            No salary structure defined yet.
            @if (isAdmin()) {
              <div style="margin-top: 8px;"><button class="btn btn-primary" (click)="startNewStructure()">Add structure</button></div>
            }
          </div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Effective from</th>
                <th>Basic</th>
                <th>HRA</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Gross</th>
                <th>Net</th>
                @if (isAdmin()) { <th></th> }
              </tr>
            </thead>
            <tbody>
              @for (s of structures(); track s.id) {
                <tr>
                  <td>{{ s.effectiveFrom }}</td>
                  <td>₹ {{ formatMoney(s.basic) }}</td>
                  <td>₹ {{ formatMoney(s.hra) }}</td>
                  <td>₹ {{ formatMoney(s.allowances) }}</td>
                  <td>₹ {{ formatMoney(s.deductions) }}</td>
                  <td><strong>₹ {{ formatMoney(s.grossMonthly) }}</strong></td>
                  <td><strong>₹ {{ formatMoney(s.netMonthly) }}</strong></td>
                  @if (isAdmin()) {
                    <td>
                      <button class="btn btn-sm" (click)="editStructure(s)">Edit</button>
                      <button class="btn btn-sm btn-danger" (click)="deleteStructure(s)">Delete</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
          @if (isAdmin()) {
            <div style="margin-top: 12px; text-align: right;">
              <button class="btn btn-primary" (click)="startNewStructure()">+ Add structure</button>
            </div>
          }
        }
      </div>

      <!-- Structure form drawer -->
      @if (structureDrawerOpen()) {
        <div class="drawer-backdrop" (click)="closeStructureDrawer()"></div>
        <aside class="drawer" (click)="$event.stopPropagation()">
          <header class="drawer-head">
            <h2>{{ editingStructure() ? 'Edit structure' : 'Add salary structure' }}</h2>
            <button class="close-btn" (click)="closeStructureDrawer()" title="Close">
              <span [innerHTML]="ic.close | safeHtml"></span>
            </button>
          </header>
          <div class="drawer-body">
            <form [formGroup]="structureForm" (ngSubmit)="submitStructure()">
              <div class="field">
                <label>Effective from <span class="req">*</span></label>
                <input class="input" type="date" formControlName="effectiveFrom" />
              </div>
              <div class="row two">
                <div class="field">
                  <label>Basic (₹)</label>
                  <input class="input" type="number" formControlName="basic" min="0" step="0.01" />
                </div>
                <div class="field">
                  <label>HRA (₹)</label>
                  <input class="input" type="number" formControlName="hra" min="0" step="0.01" />
                </div>
              </div>
              <div class="row two">
                <div class="field">
                  <label>Allowances (₹)</label>
                  <input class="input" type="number" formControlName="allowances" min="0" step="0.01" />
                </div>
                <div class="field">
                  <label>Deductions (₹)</label>
                  <input class="input" type="number" formControlName="deductions" min="0" step="0.01" />
                </div>
              </div>
              <div class="muted small" style="margin-top: 8px;">
                Gross: ₹ {{ formatMoney(structureGross()) }} · Net: ₹ {{ formatMoney(structureNet()) }}
              </div>
              @if (structureErr()) { <div class="error">{{ structureErr() }}</div> }
            </form>
          </div>
          <footer class="drawer-foot">
            <button class="btn" type="button" (click)="closeStructureDrawer()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitStructure()" [disabled]="structureForm.invalid || structureBusy()">
              {{ structureBusy() ? 'Saving…' : (editingStructure() ? 'Save changes' : 'Add structure') }}
            </button>
          </footer>
        </aside>
      }
    }

    @if (tab() === 'generate' && isAdmin()) {
      <div class="card" style="max-width: 640px;">
        <h3 style="margin-top: 0;">Generate payslips</h3>
        <p class="muted" style="margin-top: 4px;">
          Generates monthly payslips by combining each employee's active salary structure
          with their attendance for that month. Existing payslips for the period are not overwritten.
        </p>
        <div class="row two" style="margin-top: 16px;">
          <div class="field">
            <label>Year</label>
            <input class="input" type="number" min="2020" max="2099" [(ngModel)]="genYear" />
          </div>
          <div class="field">
            <label>Month</label>
            <select class="select" [(ngModel)]="genMonth">
              @for (m of months; track m.value) {
                <option [ngValue]="m.value">{{ m.label }}</option>
              }
            </select>
          </div>
        </div>
        <div class="field">
          <label>Scope</label>
          <select class="select" [(ngModel)]="genScope">
            <option value="all">All employees with a structure</option>
            <option value="one">Specific employee</option>
          </select>
        </div>
        @if (genScope === 'one') {
          <div class="field">
            <label>Employee</label>
            <select class="select" [(ngModel)]="genEmployeeId">
              <option [ngValue]="null" disabled>Select an employee…</option>
              @for (e of employees(); track e.id) {
                <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
              }
            </select>
          </div>
        }
        @if (generateErr()) { <div class="error">{{ generateErr() }}</div> }
        @if (generateResult(); as r) {
          <div class="result-card">
            <div><strong>{{ r.generated }}</strong> payslip(s) generated.</div>
            @if (r.alreadyExisted > 0) { <div class="muted small">{{ r.alreadyExisted }} already existed (skipped).</div> }
            @if (r.skippedNoStructure > 0) { <div class="muted small">{{ r.skippedNoStructure }} skipped (no salary structure).</div> }
          </div>
        }
        <button class="btn btn-primary" type="button" (click)="onGenerate()" [disabled]="generating()" style="margin-top: 14px;">
          {{ generating() ? 'Generating…' : 'Generate' }}
        </button>
      </div>

      <!-- Recent month listing for admins -->
      <div class="card" style="margin-top: 18px;">
        <h3 style="margin-top: 0;">Payslips for {{ monthName(genMonth) }} {{ genYear }}</h3>
        <button class="btn btn-sm" (click)="loadMonthList()">Refresh</button>
        @if (monthListLoading()) {
          <div class="empty">Loading…</div>
        } @else if (monthList().length === 0) {
          <div class="empty">No payslips for this period.</div>
        } @else {
          <table class="table" style="margin-top: 12px;">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Net</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Days</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of monthList(); track p.id) {
                <tr>
                  <td><strong>{{ p.employeeName }}</strong> <span class="muted small">{{ p.employeeCode }}</span></td>
                  <td><strong>₹ {{ formatMoney(p.netSalary) }}</strong></td>
                  <td>₹ {{ formatMoney(p.grossSalary) }}</td>
                  <td>₹ {{ formatMoney(p.deductions) }}</td>
                  <td>{{ p.paidDays }} / {{ p.workingDays }}</td>
                  <td>
                    <button class="btn btn-sm" (click)="openDetail(p)">View</button>
                    <button class="btn btn-sm" (click)="downloadPdf(p)">PDF</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }

    @if (detailPayslip(); as p) {
      <app-payslip-detail [payslip]="p" (close)="detailPayslip.set(null)" />
    }
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; gap: 24px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 22px; flex-wrap: wrap; }
    .page-bar h2 { margin: 0; flex: 0 0 auto; }
    .tabs { display: flex; gap: 28px; flex: 1; }
    .tab { background: transparent; border: none; padding: 6px 0; font-size: 14px; font-weight: 600; color: var(--text-soft); cursor: pointer; font-family: inherit; position: relative; transition: color 0.12s; }
    .tab:hover { color: var(--primary); }
    .tab.active { color: var(--primary); }
    .tab.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -15px; height: 3px; background: var(--primary); border-radius: 2px 2px 0 0; }

    .small { font-size: 12px; }

    /* Payslip cards grid */
    .payslip-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .payslip-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .payslip-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary); }
    .ps-head { display: flex; justify-content: space-between; align-items: flex-start; }
    .ps-month { font-weight: 700; font-size: 16px; }
    .ps-net { margin: 16px 0 14px 0; }
    .ps-net-amount { font-size: 26px; font-weight: 800; color: var(--primary-deep); margin-top: 2px; }
    .ps-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); }
    .meta-pair > div + div { font-weight: 600; margin-top: 2px; }
    .ps-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

    .structure-card { padding: 22px; }

    .row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

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

    .result-card { margin-top: 14px; padding: 12px 14px; background: var(--primary-soft); border: 1px solid var(--primary-soft-hover); border-radius: 8px; font-size: 13px; }
  `]
})
export class PayrollPageComponent {
  private payroll = inject(PayrollService);
  private employeeSvc = inject(EmployeeService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  tab = signal<Tab>('mine');
  detailPayslip = signal<Payslip | null>(null);

  /* My payslips */
  mine = signal<Payslip[]>([]);
  mineLoading = signal(true);
  downloadingId = signal<number | null>(null);

  /* Structures */
  selectedEmployeeId: number | null = null;
  structures = signal<SalaryStructure[]>([]);
  employees = signal<Employee[]>([]);
  structureDrawerOpen = signal(false);
  editingStructure = signal<SalaryStructure | null>(null);
  structureBusy = signal(false);
  structureErr = signal<string | null>(null);
  structureForm = this.fb.nonNullable.group({
    effectiveFrom: [new Date().toISOString().slice(0, 10), Validators.required],
    basic: [0, [Validators.required, Validators.min(0)]],
    hra: [0, [Validators.required, Validators.min(0)]],
    allowances: [0, [Validators.required, Validators.min(0)]],
    deductions: [0, [Validators.required, Validators.min(0)]]
  });
  structureGross = computed(() => {
    const v = this.structureForm.getRawValue();
    return Number(v.basic) + Number(v.hra) + Number(v.allowances);
  });
  structureNet = computed(() => this.structureGross() - Number(this.structureForm.getRawValue().deductions));

  /* Generate */
  genYear = new Date().getFullYear();
  genMonth = new Date().getMonth() + 1;
  genScope: 'all' | 'one' = 'all';
  genEmployeeId: number | null = null;
  generating = signal(false);
  generateErr = signal<string | null>(null);
  generateResult = signal<PayslipGenerateResult | null>(null);
  monthList = signal<Payslip[]>([]);
  monthListLoading = signal(false);

  months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  canManage = computed(() => this.auth.hasRole('ADMIN', 'MANAGER'));

  ic = {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  constructor() {
    this.payroll.myPayslips().subscribe({
      next: r => { this.mine.set(r); this.mineLoading.set(false); },
      error: () => this.mineLoading.set(false)
    });
    if (this.canManage()) {
      this.employeeSvc.list().subscribe(list => this.employees.set(list));
    }
  }

  monthName(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }

  formatMoney(n: number): string {
    return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  openDetail(p: Payslip) { this.detailPayslip.set(p); }

  downloadPdf(p: Payslip) {
    this.downloadingId.set(p.id);
    this.payroll.pdfBlob(p.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip-${p.employeeCode}-${p.year}-${String(p.month).padStart(2,'0')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloadingId.set(null);
      },
      error: () => this.downloadingId.set(null)
    });
  }

  /* Structures handlers */
  onEmployeeChange() {
    if (this.selectedEmployeeId == null) return;
    this.payroll.structuresFor(this.selectedEmployeeId).subscribe(r => this.structures.set(r));
  }

  startNewStructure() {
    if (!this.selectedEmployeeId) { alert('Pick an employee first.'); return; }
    this.editingStructure.set(null);
    this.structureForm.reset({
      effectiveFrom: new Date().toISOString().slice(0, 10),
      basic: 0, hra: 0, allowances: 0, deductions: 0
    });
    this.structureErr.set(null);
    this.structureDrawerOpen.set(true);
  }

  editStructure(s: SalaryStructure) {
    this.editingStructure.set(s);
    this.structureForm.setValue({
      effectiveFrom: s.effectiveFrom,
      basic: s.basic, hra: s.hra,
      allowances: s.allowances, deductions: s.deductions
    });
    this.structureErr.set(null);
    this.structureDrawerOpen.set(true);
  }

  closeStructureDrawer() {
    this.structureDrawerOpen.set(false);
    this.editingStructure.set(null);
  }

  submitStructure() {
    if (this.structureForm.invalid || !this.selectedEmployeeId) return;
    this.structureBusy.set(true);
    this.structureErr.set(null);
    const body = this.structureForm.getRawValue();
    const payload = {
      effectiveFrom: body.effectiveFrom,
      basic: Number(body.basic),
      hra: Number(body.hra),
      allowances: Number(body.allowances),
      deductions: Number(body.deductions)
    };

    const editing = this.editingStructure();
    const obs = editing
      ? this.payroll.updateStructure(editing.id, payload)
      : this.payroll.addStructure(this.selectedEmployeeId, payload);

    obs.subscribe({
      next: () => {
        this.structureBusy.set(false);
        this.closeStructureDrawer();
        this.onEmployeeChange();
      },
      error: (err) => {
        this.structureErr.set(err?.error?.message ?? 'Save failed');
        this.structureBusy.set(false);
      }
    });
  }

  deleteStructure(s: SalaryStructure) {
    if (!confirm(`Delete the salary structure effective from ${s.effectiveFrom}?`)) return;
    this.payroll.deleteStructure(s.id).subscribe({
      next: () => this.onEmployeeChange(),
      error: (err) => alert(err?.error?.message ?? 'Delete failed')
    });
  }

  /* Generate handlers */
  onGenerate() {
    this.generating.set(true);
    this.generateErr.set(null);
    this.generateResult.set(null);
    const empId = this.genScope === 'one' ? this.genEmployeeId : null;
    this.payroll.generate(this.genYear, this.genMonth, empId).subscribe({
      next: (r) => {
        this.generateResult.set(r);
        this.generating.set(false);
        this.loadMonthList();
        // Refresh "My Payslips" too in case the admin's own payslip was generated
        this.payroll.myPayslips().subscribe(list => this.mine.set(list));
      },
      error: (err) => {
        this.generateErr.set(err?.error?.message ?? 'Generation failed');
        this.generating.set(false);
      }
    });
  }

  loadMonthList() {
    this.monthListLoading.set(true);
    this.payroll.monthPayslips(this.genYear, this.genMonth).subscribe({
      next: r => { this.monthList.set(r); this.monthListLoading.set(false); },
      error: () => this.monthListLoading.set(false)
    });
  }
}
