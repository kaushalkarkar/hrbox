import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EmployeeService } from '../core/employee.service';
import { Department, Employee, Role } from '../core/models';
import { AvatarComponent } from './avatar.component';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AvatarComponent],
  template: `
    <div class="header">
      <h2>{{ isEdit() ? 'Edit employee' : 'New employee' }}</h2>
      <a class="btn" routerLink="/employees">← Back</a>
    </div>

    @if (isEdit() && id) {
      <div class="card photo-card">
        <h3 style="margin-top: 0;">Photo</h3>
        <div class="photo-row">
          <app-avatar
            [employeeId]="+id"
            [photoFilename]="currentPhoto()"
            [firstName]="form.value.firstName ?? ''"
            [lastName]="form.value.lastName ?? ''"
            [size]="80" />
          <div style="flex: 1;">
            <input #fileInput type="file" accept="image/png,image/jpeg,image/webp,image/gif" (change)="onFileSelected($event)" />
            <div class="muted small">JPG/PNG/WebP/GIF · max 5 MB</div>
            @if (photoErr()) { <div class="error">{{ photoErr() }}</div> }
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              <button type="button" class="btn btn-sm btn-primary" (click)="uploadPhoto()" [disabled]="!selectedFile() || photoBusy()">
                {{ photoBusy() ? 'Uploading…' : 'Upload' }}
              </button>
              @if (currentPhoto()) {
                <button type="button" class="btn btn-sm btn-danger" (click)="removePhoto()">Remove photo</button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <div class="card">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="row">
          <div class="field">
            <label>First name *</label>
            <input class="input" formControlName="firstName" />
          </div>
          <div class="field">
            <label>Last name *</label>
            <input class="input" formControlName="lastName" />
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>Email *</label>
            <input class="input" type="email" formControlName="email" />
          </div>
          <div class="field">
            <label>Phone</label>
            <input class="input" formControlName="phone" />
          </div>
        </div>

        <div class="field">
          <label>Address</label>
          <textarea formControlName="address" rows="2"></textarea>
        </div>

        <div class="row">
          <div class="field">
            <label>Designation</label>
            <input class="input" formControlName="designation" />
          </div>
          <div class="field">
            <label>Joined on *</label>
            <input class="input" type="date" formControlName="joinedOn" />
          </div>
        </div>

        <div class="row">
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
            <label>Manager</label>
            <select class="select" formControlName="managerId">
              <option [ngValue]="null">— None —</option>
              @for (e of managerOptions(); track e.id) {
                <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
              }
            </select>
          </div>
        </div>

        @if (!isEdit()) {
          <div class="row">
            <div class="field">
              <label>Initial password *</label>
              <input class="input" type="text" formControlName="initialPassword" />
            </div>
            <div class="field">
              <label>Role *</label>
              <select class="select" formControlName="role">
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
        }

        @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }

        <div style="margin-top: 12px;">
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Saving…' : (isEdit() ? 'Save changes' : 'Create employee') }}
          </button>
          <a class="btn" routerLink="/employees" style="margin-left: 8px;">Cancel</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h2 { margin: 0; }
    .photo-card { margin-bottom: 16px; }
    .photo-row { display: flex; gap: 16px; align-items: flex-start; }
    .small { font-size: 12px; }
  `]
})
export class EmployeeFormComponent implements OnInit {
  @Input() id?: string;

  private fb = inject(FormBuilder);
  private svc = inject(EmployeeService);
  private router = inject(Router);

  busy = signal(false);
  errorMsg = signal<string | null>(null);
  departments = signal<Department[]>([]);
  managerOptions = signal<Employee[]>([]);

  selectedFile = signal<File | null>(null);
  photoBusy = signal(false);
  photoErr = signal<string | null>(null);
  currentPhoto = signal<string | null>(null);

  isEdit = computed(() => !!this.id);

  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
    designation: [''],
    departmentId: [null as number | null],
    managerId: [null as number | null],
    joinedOn: [new Date().toISOString().slice(0, 10), Validators.required],
    initialPassword: ['changeme123', Validators.required],
    role: ['EMPLOYEE' as Role, Validators.required]
  });

  ngOnInit(): void {
    this.svc.departments().subscribe(d => this.departments.set(d));
    this.svc.list().subscribe(list => this.managerOptions.set(list));

    if (this.id) {
      this.svc.get(Number(this.id)).subscribe(e => {
        this.form.patchValue({
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          phone: e.phone ?? '',
          address: e.address ?? '',
          designation: e.designation ?? '',
          departmentId: e.departmentId ?? null,
          managerId: e.managerId ?? null,
          joinedOn: e.joinedOn
        });
        this.currentPhoto.set(e.photoFilename ?? null);
        this.form.controls.initialPassword.disable();
        this.form.controls.role.disable();
      });
    }
  }

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.photoErr.set(null);
    if (file && file.size > 5 * 1024 * 1024) {
      this.photoErr.set('File exceeds 5 MB');
      this.selectedFile.set(null);
      return;
    }
    this.selectedFile.set(file);
  }

  uploadPhoto() {
    const file = this.selectedFile();
    if (!file || !this.id) return;
    this.photoBusy.set(true);
    this.photoErr.set(null);
    this.svc.uploadPhoto(Number(this.id), file).subscribe({
      next: (res) => {
        this.currentPhoto.set(res.filename);
        this.selectedFile.set(null);
        this.photoBusy.set(false);
      },
      error: (err) => {
        this.photoErr.set(err?.error?.message ?? 'Upload failed');
        this.photoBusy.set(false);
      }
    });
  }

  removePhoto() {
    if (!this.id || !confirm('Remove photo?')) return;
    this.svc.deletePhoto(Number(this.id)).subscribe({
      next: () => this.currentPhoto.set(null),
      error: (err) => this.photoErr.set(err?.error?.message ?? 'Delete failed')
    });
  }

  submit() {
    this.errorMsg.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    const v = this.form.getRawValue();

    const obs = this.isEdit()
      ? this.svc.update(Number(this.id), {
          firstName: v.firstName!, lastName: v.lastName!, email: v.email!,
          phone: v.phone ?? '', address: v.address ?? '', designation: v.designation ?? '',
          departmentId: v.departmentId, managerId: v.managerId, joinedOn: v.joinedOn!
        })
      : this.svc.create({
          firstName: v.firstName!, lastName: v.lastName!, email: v.email!,
          phone: v.phone ?? '', address: v.address ?? '', designation: v.designation ?? '',
          departmentId: v.departmentId, managerId: v.managerId, joinedOn: v.joinedOn!,
          initialPassword: v.initialPassword!, role: v.role!
        });

    obs.subscribe({
      next: () => this.router.navigateByUrl('/employees'),
      error: (err) => {
        this.errorMsg.set(err?.error?.message ?? 'Save failed');
        this.busy.set(false);
      }
    });
  }
}
