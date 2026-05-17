import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { PayrollService } from '../core/payroll.service';
import { Payslip } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

@Component({
  selector: 'app-payslip-detail',
  standalone: true,
  imports: [SafeHtmlPipe],
  template: `
    <div class="drawer-backdrop" (click)="close.emit()"></div>
    <aside class="drawer" (click)="$event.stopPropagation()">
      <header class="drawer-head">
        <div>
          <div class="muted small">Payslip #{{ payslip.id }}</div>
          <h2>{{ monthLabel }}</h2>
        </div>
        <button class="close-btn" (click)="close.emit()" title="Close">
          <span [innerHTML]="ic.close | safeHtml"></span>
        </button>
      </header>

      <div class="drawer-body">
        <!-- Summary block -->
        <div class="summary">
          <div class="summary-card">
            <div class="muted small">Net pay</div>
            <div class="amount net">₹ {{ formatMoney(payslip.netSalary) }}</div>
          </div>
          <div class="dual">
            <div class="dual-cell">
              <div class="muted small">Gross</div>
              <div class="amount">₹ {{ formatMoney(payslip.grossSalary) }}</div>
            </div>
            <div class="dual-cell">
              <div class="muted small">Deductions</div>
              <div class="amount neg">– ₹ {{ formatMoney(payslip.deductions) }}</div>
            </div>
          </div>
          <div class="dual">
            <div class="dual-cell">
              <div class="muted small">Working days</div>
              <div class="amount minor">{{ payslip.workingDays }}</div>
            </div>
            <div class="dual-cell">
              <div class="muted small">Paid days</div>
              <div class="amount minor">{{ payslip.paidDays }}</div>
            </div>
          </div>
        </div>

        <!-- Earnings -->
        <div class="section-title">Earnings</div>
        <div class="line-table">
          <div class="line"><span>Basic</span><strong>₹ {{ formatMoney(payslip.basic) }}</strong></div>
          <div class="line"><span>House Rent Allowance</span><strong>₹ {{ formatMoney(payslip.hra) }}</strong></div>
          <div class="line"><span>Other allowances</span><strong>₹ {{ formatMoney(payslip.allowances) }}</strong></div>
          <div class="line total"><span>Gross</span><strong>₹ {{ formatMoney(payslip.grossSalary) }}</strong></div>
        </div>

        <!-- Deductions -->
        <div class="section-title">Deductions</div>
        <div class="line-table">
          <div class="line"><span>Total deductions</span><strong>₹ {{ formatMoney(payslip.deductions) }}</strong></div>
        </div>

        <div class="net-card">
          <div>
            <div class="muted small">Net pay</div>
            <div class="muted small">(Gross − Deductions)</div>
          </div>
          <div class="amount net">₹ {{ formatMoney(payslip.netSalary) }}</div>
        </div>

        <div class="muted small" style="margin-top: 16px;">
          Generated {{ generatedAtLabel }}
          <span class="muted"> · {{ payslip.employeeName }} ({{ payslip.employeeCode }})</span>
        </div>

        @if (downloadErr()) { <div class="error">{{ downloadErr() }}</div> }
      </div>

      <footer class="drawer-foot">
        <button class="btn" type="button" (click)="close.emit()">Close</button>
        <button class="btn btn-primary" type="button" (click)="downloadPdf()" [disabled]="downloading()">
          {{ downloading() ? 'Preparing…' : 'Download PDF' }}
        </button>
      </footer>
    </aside>
  `,
  styles: [`
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,21,37,0.45); z-index: 100; animation: fadeIn 0.18s ease both; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(560px, 100vw);
      background: var(--surface);
      z-index: 101;
      display: flex; flex-direction: column;
      box-shadow: -18px 0 48px rgba(15,21,37,0.18);
      animation: slideIn 0.22s ease both;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .drawer-head { padding: 22px 26px 16px 26px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .drawer-head h2 { margin: 4px 0 0 0; font-size: 22px; }
    .close-btn { width: 36px; height: 36px; border: none; background: transparent; color: var(--text-soft); border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .close-btn:hover { background: var(--surface-soft); }

    .drawer-body { flex: 1; overflow-y: auto; padding: 22px 26px 28px 26px; }
    .drawer-foot { padding: 16px 26px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }

    .summary {
      background: linear-gradient(135deg, var(--primary-soft) 0%, #ffffff 100%);
      border: 1px solid var(--primary-soft-hover);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .summary-card .amount.net { font-size: 30px; font-weight: 800; color: var(--primary-deep); margin-top: 2px; }
    .dual { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .dual-cell .amount { font-size: 18px; font-weight: 700; margin-top: 2px; }
    .amount.minor { font-size: 16px; }
    .amount.neg { color: var(--danger); }
    .small { font-size: 12px; }

    .section-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 18px 0 6px 0;
    }
    .line-table { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; }
    .line { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .line:last-child { border-bottom: none; }
    .line.total { background: #fff; font-weight: 700; }

    .net-card {
      margin-top: 18px;
      padding: 18px;
      background: var(--primary-soft);
      border: 1px solid var(--primary-soft-hover);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .net-card .amount.net { font-size: 24px; font-weight: 800; color: var(--primary-deep); }
  `]
})
export class PayslipDetailComponent {
  @Input({ required: true }) payslip!: Payslip;
  @Output() close = new EventEmitter<void>();

  private svc = inject(PayrollService);

  downloading = signal(false);
  downloadErr = signal<string | null>(null);

  ic = {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  get monthLabel(): string {
    return new Date(this.payslip.year, this.payslip.month - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get generatedAtLabel(): string {
    return new Date(this.payslip.generatedAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatMoney(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  downloadPdf() {
    this.downloading.set(true);
    this.downloadErr.set(null);
    this.svc.pdfBlob(this.payslip.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip-${this.payslip.employeeCode}-${this.payslip.year}-${String(this.payslip.month).padStart(2,'0')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloading.set(false);
      },
      error: (err) => {
        this.downloadErr.set(err?.error?.message ?? 'Failed to download');
        this.downloading.set(false);
      }
    });
  }
}
