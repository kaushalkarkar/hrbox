import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApplicationStage, Candidate, CandidateRequest,
  Job, JobApplication, JobRequest, JobStatus
} from './models';

@Injectable({ providedIn: 'root' })
export class RecruitmentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/recruitment`;

  /* Jobs */
  listJobs(status?: JobStatus): Observable<Job[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Job[]>(`${this.base}/jobs`, { params });
  }
  getJob(id: number): Observable<Job> { return this.http.get<Job>(`${this.base}/jobs/${id}`); }
  createJob(body: JobRequest): Observable<Job> { return this.http.post<Job>(`${this.base}/jobs`, body); }
  updateJob(id: number, body: JobRequest): Observable<Job> { return this.http.put<Job>(`${this.base}/jobs/${id}`, body); }
  deleteJob(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/jobs/${id}`); }

  /* Candidates */
  listCandidates(q?: string): Observable<Candidate[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<Candidate[]>(`${this.base}/candidates`, { params });
  }
  getCandidate(id: number): Observable<Candidate> { return this.http.get<Candidate>(`${this.base}/candidates/${id}`); }
  createCandidate(body: CandidateRequest): Observable<Candidate> { return this.http.post<Candidate>(`${this.base}/candidates`, body); }
  updateCandidate(id: number, body: CandidateRequest): Observable<Candidate> { return this.http.put<Candidate>(`${this.base}/candidates/${id}`, body); }
  deleteCandidate(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/candidates/${id}`); }

  /* Applications */
  applicationsByJob(jobId: number): Observable<JobApplication[]> {
    return this.http.get<JobApplication[]>(`${this.base}/applications/by-job/${jobId}`);
  }
  applicationsByCandidate(candidateId: number): Observable<JobApplication[]> {
    return this.http.get<JobApplication[]>(`${this.base}/applications/by-candidate/${candidateId}`);
  }
  pipeline(): Observable<Record<ApplicationStage, JobApplication[]>> {
    return this.http.get<Record<ApplicationStage, JobApplication[]>>(`${this.base}/pipeline`);
  }
  apply(candidateId: number, jobId: number): Observable<JobApplication> {
    return this.http.post<JobApplication>(`${this.base}/applications`, { candidateId, jobId });
  }
  moveStage(applicationId: number, stage: ApplicationStage, note?: string): Observable<JobApplication> {
    return this.http.put<JobApplication>(`${this.base}/applications/${applicationId}/stage`, { stage, note });
  }
  deleteApplication(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/applications/${id}`);
  }
}
