import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { EmployeeService } from '../core/employee.service';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (blobUrl()) {
      <img class="avatar" [src]="blobUrl()" [alt]="alt" [style.width.px]="size" [style.height.px]="size" />
    } @else {
      <div class="avatar fallback" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.4">
        {{ initials }}
      </div>
    }
  `,
  styles: [`
    .avatar {
      border-radius: 50%;
      object-fit: cover;
      background: #eef1fb;
      display: inline-block;
      vertical-align: middle;
    }
    .fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      font-weight: 600;
      border: 1px solid var(--border);
    }
  `]
})
export class AvatarComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) employeeId!: number;
  @Input() photoFilename: string | null | undefined;
  @Input() firstName = '';
  @Input() lastName = '';
  @Input() size = 32;

  private svc = inject(EmployeeService);
  blobUrl = signal<string | null>(null);

  get alt() { return `${this.firstName} ${this.lastName}`.trim() || 'avatar'; }
  get initials(): string {
    const a = (this.firstName || '').charAt(0);
    const b = (this.lastName || '').charAt(0);
    return (a + b).toUpperCase() || '?';
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.revoke();
    if (this.photoFilename && this.employeeId) {
      this.svc.fetchPhotoBlob(this.employeeId).subscribe({
        next: (blob) => this.blobUrl.set(URL.createObjectURL(blob)),
        error: () => this.blobUrl.set(null)
      });
    }
  }

  ngOnDestroy(): void { this.revoke(); }

  private revoke() {
    const u = this.blobUrl();
    if (u) URL.revokeObjectURL(u);
    this.blobUrl.set(null);
  }
}
