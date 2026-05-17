import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AttendanceDay, AttendanceRecord, MonthSummary } from './models';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/attendance`;

  today(): Observable<AttendanceRecord | null> {
    return this.http.get<AttendanceRecord | null>(`${this.base}/today`);
  }

  checkIn(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.base}/check-in`, {});
  }

  checkOut(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.base}/check-out`, {});
  }

  myRange(from: string, to: string): Observable<AttendanceDay[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<AttendanceDay[]>(`${this.base}/me`, { params });
  }

  mySummary(year: number, month: number): Observable<MonthSummary> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<MonthSummary>(`${this.base}/me/summary`, { params });
  }

  employeeRange(employeeId: number, from: string, to: string): Observable<AttendanceDay[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<AttendanceDay[]>(`${this.base}/employee/${employeeId}`, { params });
  }

  team(date: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(`${this.base}/team`, { params: new HttpParams().set('date', date) });
  }

  all(date: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(`${this.base}/all`, { params: new HttpParams().set('date', date) });
  }
}
