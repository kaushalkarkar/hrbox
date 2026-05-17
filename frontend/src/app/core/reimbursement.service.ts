import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Expense, ExpenseStats, ExpenseSubmit } from './models';

@Injectable({ providedIn: 'root' })
export class ReimbursementService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reimbursements`;

  mine(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.base}/me`);
  }

  pending(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.base}/pending`);
  }

  all(): Observable<Expense[]> {
    return this.http.get<Expense[]>(this.base);
  }

  myStats(): Observable<ExpenseStats> {
    return this.http.get<ExpenseStats>(`${this.base}/me/stats`);
  }

  submit(body: ExpenseSubmit): Observable<Expense> {
    return this.http.post<Expense>(this.base, body);
  }

  approve(id: number, comment?: string): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/${id}/approve`, { comment });
  }

  reject(id: number, comment?: string): Observable<Expense> {
    return this.http.put<Expense>(`${this.base}/${id}/reject`, { comment });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
