import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LeaveService } from '../core/leave.service';
import { LeaveBalance, LeaveType } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

/**
 * Renders as a right-side drawer over a dimmed backdrop, matching
 * Darwinbox's "Leave Request" panel. Closing navigates back to /leaves/me.
 */
@Component({
  selector: 'app-leave-apply',
  standalone: true,
  imports: [ReactiveFormsModule, SafeHtmlPipe],
  template: `
    <div class="drawer-backdrop" (click)="cancel()"></div>
    <aside class="drawer" (click)="$event.stopPropagation()">
      <!-- Header -->
      <header class="drawer-head">
        <h2>Leave Request</h2>
        <button class="close-btn" (click)="cancel()" title="Close">
          <span [innerHTML]="ic.close | safeHtml"></span>
        </button>
      </header>

      <!-- Body (scrollable) -->
      <div class="drawer-body">
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Leave Type <span class="req">*</span></label>
            <div class="select-wrap">
              <select class="select" formControlName="type">
                <option value="" disabled selected>Select Leave Type</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="PAID">Paid Leave</option>
              </select>
              <span class="select-caret" [innerHTML]="ic.caret | safeHtml"></span>
            </div>
            @if (selectedType() && selectedBalance(); as bal) {
              <div class="balance-hint">
                <strong>{{ bal!.remaining }}</strong> {{ leaveLabel(bal!.type) }} remaining
                <span class="muted"> · {{ bal!.used }}/{{ bal!.allocated }} used</span>
              </div>
            }
          </div>

          <div class="row two">
            <div class="field">
              <label>From <span class="req">*</span></label>
              <div class="date-wrap">
                <input class="input" type="date" formControlName="startDate" />
                <span class="date-icon" [innerHTML]="ic.cal | safeHtml"></span>
              </div>
            </div>
            <div class="field">
              <label>To <span class="req">*</span></label>
              <div class="date-wrap">
                <input class="input" type="date" formControlName="endDate" />
                <span class="date-icon" [innerHTML]="ic.cal | safeHtml"></span>
              </div>
            </div>
          </div>

          @if (requestedDays() > 0) {
            <div class="muted small" style="margin-top: -6px; margin-bottom: 16px;">
              Requesting <strong>{{ requestedDays() }}</strong> day(s)
              @if (overBalance()) { <span class="error" style="margin-left: 8px;">Exceeds remaining balance</span> }
            </div>
          }

          <div class="field">
            <label>Message</label>
            <textarea formControlName="reason" rows="4" placeholder="Enter Details Here"></textarea>
          </div>

          <div class="field">
            <label>Attachment</label>
            <div class="dropzone" (click)="onPickFile()" [class.dragover]="dragOver()"
                 (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
              <span class="upload-ic" [innerHTML]="ic.upload | safeHtml"></span>
              <div class="dz-text">
                Drag and drop to upload or
                <a class="link" (click)="onPickFile(); $event.stopPropagation()">Browse Files</a>
              </div>
              <div class="dz-types">CSV, Word doc, Word doc (OpenXML), Email Message, GIF, JPEG, JPG, PDF, PNG, Excel, Excel (OpenXML), Mail Message (10.00 MB)</div>
              <input #fileInput type="file" hidden multiple
                     accept=".csv,.doc,.docx,.eml,.msg,.gif,.jpg,.jpeg,.pdf,.png,.xls,.xlsx"
                     (change)="onFiles($any($event.target).files)" />
            </div>
            <div class="dz-max muted small">Max: 3</div>
            @if (attachments().length > 0) {
              <ul class="attach-list">
                @for (a of attachments(); track a.name) {
                  <li>
                    <span [innerHTML]="ic.file | safeHtml"></span>
                    <span class="att-name">{{ a.name }}</span>
                    <span class="muted small">({{ formatSize(a.size) }})</span>
                    <button type="button" class="remove-att" (click)="removeAttachment(a)" title="Remove">
                      <span [innerHTML]="ic.close | safeHtml"></span>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }
          @if (success()) { <div class="success">Leave request submitted.</div> }
        </form>
      </div>

      <!-- Footer -->
      <footer class="drawer-foot">
        <button class="btn" type="button" (click)="cancel()">Cancel</button>
        <button class="btn btn-dark" type="button" (click)="submit()" [disabled]="form.invalid || busy() || overBalance()">
          {{ busy() ? 'Submitting…' : 'Submit' }}
        </button>
      </footer>
    </aside>
  `,
  styles: [`
    .drawer-backdrop {
      position: fixed; inset: 0;
      background: rgba(15, 21, 37, 0.45);
      z-index: 100;
      animation: fadeIn 0.18s ease both;
    }
    .drawer {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: min(560px, 100vw);
      background: var(--surface);
      z-index: 101;
      display: flex; flex-direction: column;
      box-shadow: -18px 0 48px rgba(15, 21, 37, 0.18);
      animation: slideIn 0.22s ease both;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .drawer-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 22px 26px 16px 26px;
      border-bottom: 1px solid var(--border);
    }
    .drawer-head h2 { margin: 0; font-size: 20px; }
    .close-btn {
      width: 36px; height: 36px;
      border: none; background: transparent;
      color: var(--text-soft);
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .close-btn:hover { background: var(--surface-soft); }

    .drawer-body { flex: 1; overflow-y: auto; padding: 22px 26px; }
    .drawer-foot {
      padding: 16px 26px;
      border-top: 1px solid var(--border);
      display: flex; gap: 10px; justify-content: flex-end;
    }
    .btn-dark {
      background: #111a2e;
      color: #fff;
      border-color: #111a2e;
    }
    .btn-dark:hover { background: #1f2742; border-color: #1f2742; color: #fff; }

    .field label .req { color: var(--danger); margin-left: 2px; }
    .row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 480px) { .row.two { grid-template-columns: 1fr; } }

    .select-wrap, .date-wrap { position: relative; }
    .select-wrap .select { appearance: none; padding-right: 38px; }
    .select-caret {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      color: var(--muted); pointer-events: none; display: inline-flex;
    }
    .date-wrap .input { padding-right: 38px; }
    .date-icon {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      color: var(--muted); pointer-events: none; display: inline-flex;
    }

    .balance-hint {
      margin-top: 8px;
      padding: 10px 14px;
      background: var(--primary-soft);
      border-radius: 8px;
      font-size: 13px;
      color: var(--primary-deep);
    }

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
    .dz-text .link:hover { text-decoration: underline; }
    .dz-types { font-size: 11px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
    .dz-max { margin-top: 6px; }

    .attach-list { list-style: none; padding: 0; margin: 12px 0 0 0; }
    .attach-list li {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-top: 6px;
      font-size: 13px;
    }
    .attach-list li svg { width: 16px; height: 16px; color: var(--muted); }
    .att-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .remove-att {
      width: 22px; height: 22px;
      border: none; background: transparent; color: var(--muted);
      cursor: pointer; border-radius: 4px;
    }
    .remove-att:hover { background: var(--bg); color: var(--danger); }

    .small { font-size: 12px; }
  `]
})
export class LeaveApplyComponent {
  private fb = inject(FormBuilder);
  private svc = inject(LeaveService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  busy = signal(false);
  errorMsg = signal<string | null>(null);
  success = signal(false);
  balances = signal<LeaveBalance[]>([]);
  attachments = signal<File[]>([]);
  dragOver = signal(false);

  form = this.fb.nonNullable.group({
    type: ['' as LeaveType | '', Validators.required],
    startDate: [new Date().toISOString().slice(0, 10), Validators.required],
    endDate:   [new Date().toISOString().slice(0, 10), Validators.required],
    reason: ['']
  });

  selectedType = computed(() => this.form.controls.type.value || null);

  selectedBalance = computed(() => {
    const t = this.selectedType();
    if (!t) return null;
    return this.balances().find(b => b.type === t) ?? null;
  });

  ic = {
    close:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    caret:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>`,
    cal:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  };

  constructor() {
    this.svc.myBalance().subscribe(b => this.balances.set(b));
    // Pre-select leave type via query param (e.g. /leaves/apply?type=CASUAL)
    const t = this.route.snapshot.queryParamMap.get('type') as LeaveType | null;
    if (t === 'CASUAL' || t === 'SICK' || t === 'PAID') {
      this.form.controls.type.setValue(t);
    }
  }

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
    if (!list) return;
    const max = 3;
    const next = [...this.attachments()];
    for (const f of Array.from(list)) {
      if (next.length >= max) break;
      if (f.size > 10 * 1024 * 1024) {
        this.errorMsg.set(`"${f.name}" exceeds 10 MB`);
        continue;
      }
      next.push(f);
    }
    this.attachments.set(next);
  }
  removeAttachment(f: File) { this.attachments.set(this.attachments().filter(x => x !== f)); }
  formatSize(n: number): string {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  requestedDays(): number {
    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate) return 0;
    const s = new Date(v.startDate);
    const e = new Date(v.endDate);
    const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }

  overBalance(): boolean {
    const bal = this.selectedBalance();
    if (!bal) return false;
    return this.requestedDays() > bal.remaining;
  }

  leaveLabel(t: string): string {
    return ({ CASUAL: 'Casual Leave', SICK: 'Sick Leave', PAID: 'Paid Leave' } as Record<string, string>)[t] ?? t;
  }

  submit() {
    this.errorMsg.set(null);
    this.success.set(false);
    if (this.form.invalid || !this.form.value.type) return;
    if (this.overBalance()) { this.errorMsg.set('Requested days exceed your remaining balance.'); return; }
    this.busy.set(true);
    const v = this.form.getRawValue();
    this.svc.apply({
      type: v.type as LeaveType,
      startDate: v.startDate,
      endDate: v.endDate,
      reason: v.reason || undefined
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(true);
        // Note: attachments are not yet persisted server-side for leaves.
        setTimeout(() => this.router.navigateByUrl('/leaves/me'), 700);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Failed to submit');
        this.busy.set(false);
      }
    });
  }

  cancel() { this.router.navigateByUrl('/leaves/me'); }
}
