import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppNotification } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/notifications`;

  unreadCount = signal<number>(0);
  recent = signal<AppNotification[]>([]);

  list(limit = 20): Observable<AppNotification[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<AppNotification[]>(this.base, { params }).pipe(
      tap(list => this.recent.set(list))
    );
  }

  refreshUnread(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`).pipe(
      tap(r => this.unreadCount.set(r.count))
    );
  }

  markRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/read`, {}).pipe(
      tap(() => {
        this.recent.update(list => list.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
        this.unreadCount.update(c => Math.max(0, c - 1));
      })
    );
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.base}/read-all`, {}).pipe(
      tap(() => {
        const now = new Date().toISOString();
        this.recent.update(list => list.map(n => ({ ...n, readAt: n.readAt ?? now })));
        this.unreadCount.set(0);
      })
    );
  }
}
