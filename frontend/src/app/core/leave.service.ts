import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Leave, LeaveApply, LeaveBalance } from './models';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/leaves`;

  apply(payload: LeaveApply): Observable<Leave> {
    return this.http.post<Leave>(this.base, payload);
  }

  myLeaves(): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.base}/me`);
  }

  pending(): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.base}/pending`);
  }

  all(): Observable<Leave[]> {
    return this.http.get<Leave[]>(this.base);
  }

  approve(id: number, comment?: string): Observable<Leave> {
    return this.http.put<Leave>(`${this.base}/${id}/approve`, { comment });
  }

  reject(id: number, comment?: string): Observable<Leave> {
    return this.http.put<Leave>(`${this.base}/${id}/reject`, { comment });
  }

  myBalance(year?: number): Observable<LeaveBalance[]> {
    let params = new HttpParams();
    if (year != null) params = params.set('year', year);
    return this.http.get<LeaveBalance[]>(`${this.base}/balance`, { params });
  }
}
