import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreatePostRequest, PostCategory, ReactionType,
  VibeComment, VibePost, VibePostDetail
} from './models';

@Injectable({ providedIn: 'root' })
export class VibeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/vibe`;

  feed(category?: PostCategory, limit = 50): Observable<VibePost[]> {
    let params = new HttpParams().set('limit', limit);
    if (category) params = params.set('category', category);
    return this.http.get<VibePost[]>(`${this.base}/posts`, { params });
  }

  get(id: number): Observable<VibePostDetail> {
    return this.http.get<VibePostDetail>(`${this.base}/posts/${id}`);
  }

  create(body: CreatePostRequest): Observable<VibePost> {
    return this.http.post<VibePost>(`${this.base}/posts`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/posts/${id}`);
  }

  togglePin(id: number): Observable<VibePost> {
    return this.http.put<VibePost>(`${this.base}/posts/${id}/pin`, {});
  }

  react(postId: number, type: ReactionType): Observable<VibePost> {
    return this.http.post<VibePost>(`${this.base}/posts/${postId}/react`, { type });
  }

  comment(postId: number, body: string): Observable<VibeComment> {
    return this.http.post<VibeComment>(`${this.base}/posts/${postId}/comments`, { body });
  }

  deleteComment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${id}`);
  }
}
