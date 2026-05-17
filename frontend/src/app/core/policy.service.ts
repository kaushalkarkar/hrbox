import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Policy, PolicyCategory, PolicyRequest, PolicySummary } from './models';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/policies`;

  list(category?: PolicyCategory): Observable<PolicySummary[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    return this.http.get<PolicySummary[]>(this.base, { params });
  }

  get(id: number): Observable<Policy> {
    return this.http.get<Policy>(`${this.base}/${id}`);
  }

  categoryCounts(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/categories`);
  }

  create(body: PolicyRequest): Observable<Policy> {
    return this.http.post<Policy>(this.base, body);
  }

  update(id: number, body: PolicyRequest): Observable<Policy> {
    return this.http.put<Policy>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  acknowledge(id: number): Observable<Policy> {
    return this.http.post<Policy>(`${this.base}/${id}/ack`, {});
  }
}
