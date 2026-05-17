import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Goal, GoalCreate, GoalUpdate, PerformanceReview, ReviewRequest } from './models';

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/performance`;

  /* === Goals === */

  myGoals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${this.base}/goals/me`);
  }

  goalsForEmployee(id: number): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${this.base}/goals/employee/${id}`);
  }

  teamGoals(): Observable<Goal[]> {
    return this.http.get<Goal[]>(`${this.base}/goals/team`);
  }

  createMyGoal(body: GoalCreate): Observable<Goal> {
    return this.http.post<Goal>(`${this.base}/goals/me`, body);
  }

  createGoalFor(id: number, body: GoalCreate): Observable<Goal> {
    return this.http.post<Goal>(`${this.base}/goals/employee/${id}`, body);
  }

  updateGoal(goalId: number, body: GoalUpdate): Observable<Goal> {
    return this.http.put<Goal>(`${this.base}/goals/${goalId}`, body);
  }

  deleteGoal(goalId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/goals/${goalId}`);
  }

  /* === Reviews === */

  myReviews(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.base}/reviews/me`);
  }

  reviewsForEmployee(id: number): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.base}/reviews/employee/${id}`);
  }

  teamReviews(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.base}/reviews/team`);
  }

  upsertReview(employeeId: number, body: ReviewRequest): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.base}/reviews/employee/${employeeId}`, body);
  }

  deleteReview(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/reviews/${reviewId}`);
  }
}
