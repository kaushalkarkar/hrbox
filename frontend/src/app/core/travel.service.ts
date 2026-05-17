import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TravelRequest, TravelStats, TravelSubmit } from './models';

@Injectable({ providedIn: 'root' })
export class TravelService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/travel`;

  mine(): Observable<TravelRequest[]> {
    return this.http.get<TravelRequest[]>(`${this.base}/me`);
  }

  pending(): Observable<TravelRequest[]> {
    return this.http.get<TravelRequest[]>(`${this.base}/pending`);
  }

  all(): Observable<TravelRequest[]> {
    return this.http.get<TravelRequest[]>(this.base);
  }

  myStats(): Observable<TravelStats> {
    return this.http.get<TravelStats>(`${this.base}/me/stats`);
  }

  submit(body: TravelSubmit): Observable<TravelRequest> {
    return this.http.post<TravelRequest>(this.base, body);
  }

  approve(id: number, comment?: string): Observable<TravelRequest> {
    return this.http.put<TravelRequest>(`${this.base}/${id}/approve`, { comment });
  }

  reject(id: number, comment?: string): Observable<TravelRequest> {
    return this.http.put<TravelRequest>(`${this.base}/${id}/reject`, { comment });
  }

  markBooked(id: number, comment?: string): Observable<TravelRequest> {
    return this.http.put<TravelRequest>(`${this.base}/${id}/mark-booked`, { comment });
  }

  markCompleted(id: number): Observable<TravelRequest> {
    return this.http.put<TravelRequest>(`${this.base}/${id}/mark-completed`, {});
  }

  cancel(id: number): Observable<TravelRequest> {
    return this.http.put<TravelRequest>(`${this.base}/${id}/cancel`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
