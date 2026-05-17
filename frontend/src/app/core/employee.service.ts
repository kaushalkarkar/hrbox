import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Department, Employee, EmployeeCreate, EmployeeUpdate, OrgChart } from './models';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/employees`;
  private deptBase = `${environment.apiUrl}/departments`;

  list(filter: { departmentId?: number | null; q?: string } = {}): Observable<Employee[]> {
    let params = new HttpParams();
    if (filter.departmentId != null) params = params.set('departmentId', filter.departmentId);
    if (filter.q) params = params.set('q', filter.q);
    return this.http.get<Employee[]>(this.base, { params });
  }

  get(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.base}/${id}`);
  }

  me(): Observable<Employee> {
    return this.http.get<Employee>(`${this.base}/me`);
  }

  orgChart(id: number): Observable<OrgChart> {
    return this.http.get<OrgChart>(`${this.base}/${id}/org-chart`);
  }

  create(payload: EmployeeCreate): Observable<Employee> {
    return this.http.post<Employee>(this.base, payload);
  }

  update(id: number, payload: EmployeeUpdate): Observable<Employee> {
    return this.http.put<Employee>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadPhoto(id: number, file: File): Observable<{ filename: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ filename: string }>(`${this.base}/${id}/photo`, fd);
  }

  deletePhoto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/photo`);
  }

  fetchPhotoBlob(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/photo`, { responseType: 'blob' });
  }

  resetPassword(id: number, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/reset-password`, { newPassword });
  }

  departments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.deptBase);
  }

  createDepartment(name: string): Observable<Department> {
    return this.http.post<Department>(this.deptBase, { name });
  }
}
