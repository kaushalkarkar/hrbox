import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Holiday } from './models';

export interface HolidayPayload {
  date: string;
  name: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/holidays`;

  list(year?: number): Observable<Holiday[]> {
    let params = new HttpParams();
    if (year != null) params = params.set('year', year);
    return this.http.get<Holiday[]>(this.base, { params });
  }

  create(payload: HolidayPayload): Observable<Holiday> {
    return this.http.post<Holiday>(this.base, payload);
  }

  update(id: number, payload: HolidayPayload): Observable<Holiday> {
    return this.http.put<Holiday>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
