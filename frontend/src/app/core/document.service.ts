import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DocumentCategory, EmployeeDocument } from './models';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/documents`;

  myDocs(): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.base}/me`);
  }

  employeeDocs(id: number): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.base}/employee/${id}`);
  }

  uploadMine(file: File, category: DocumentCategory, description?: string): Observable<EmployeeDocument> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    if (description) fd.append('description', description);
    return this.http.post<EmployeeDocument>(`${this.base}/me`, fd);
  }

  uploadFor(id: number, file: File, category: DocumentCategory, description?: string): Observable<EmployeeDocument> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    if (description) fd.append('description', description);
    return this.http.post<EmployeeDocument>(`${this.base}/employee/${id}`, fd);
  }

  downloadBlob(docId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${docId}/file`, { responseType: 'blob' });
  }

  delete(docId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${docId}`);
  }
}
