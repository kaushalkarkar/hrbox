import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket, TicketCreate, TicketStats, TicketStatus } from './models';

@Injectable({ providedIn: 'root' })
export class HelpdeskService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/helpdesk`;

  mine(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.base}/me`);
  }

  assignedToMe(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.base}/assigned-to-me`);
  }

  all(status?: TicketStatus): Observable<Ticket[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Ticket[]>(this.base, { params });
  }

  stats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(`${this.base}/stats`);
  }

  get(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/${id}`);
  }

  create(body: TicketCreate): Observable<Ticket> {
    return this.http.post<Ticket>(this.base, body);
  }

  assign(id: number, assigneeId: number | null): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.base}/${id}/assign`, { assigneeId });
  }

  updateStatus(id: number, status: TicketStatus, resolution?: string): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.base}/${id}/status`, { status, resolution });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
