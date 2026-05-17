import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Payslip, PayslipGenerateResult, SalaryStructure, SalaryStructureRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/payroll`;

  /* === Salary structures === */

  structuresFor(employeeId: number): Observable<SalaryStructure[]> {
    return this.http.get<SalaryStructure[]>(`${this.base}/structures/${employeeId}`);
  }

  addStructure(employeeId: number, body: SalaryStructureRequest): Observable<SalaryStructure> {
    return this.http.post<SalaryStructure>(`${this.base}/structures/${employeeId}`, body);
  }

  updateStructure(structureId: number, body: SalaryStructureRequest): Observable<SalaryStructure> {
    return this.http.put<SalaryStructure>(`${this.base}/structures/id/${structureId}`, body);
  }

  deleteStructure(structureId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/structures/id/${structureId}`);
  }

  /* === Payslips === */

  generate(year: number, month: number, employeeId?: number | null): Observable<PayslipGenerateResult> {
    return this.http.post<PayslipGenerateResult>(`${this.base}/payslips/generate`, {
      year, month, employeeId: employeeId ?? null
    });
  }

  myPayslips(): Observable<Payslip[]> {
    return this.http.get<Payslip[]>(`${this.base}/payslips/me`);
  }

  employeePayslips(employeeId: number): Observable<Payslip[]> {
    return this.http.get<Payslip[]>(`${this.base}/payslips/employee/${employeeId}`);
  }

  monthPayslips(year: number, month: number): Observable<Payslip[]> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<Payslip[]>(`${this.base}/payslips/month`, { params });
  }

  payslip(id: number): Observable<Payslip> {
    return this.http.get<Payslip>(`${this.base}/payslips/${id}`);
  }

  pdfUrl(id: number): string {
    // PDF endpoint requires Authorization header, so we fetch as blob and create a blob URL.
    return `${this.base}/payslips/${id}/pdf`;
  }

  pdfBlob(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/payslips/${id}/pdf`, { responseType: 'blob' });
  }
}
