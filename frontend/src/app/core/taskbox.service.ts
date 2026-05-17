import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TaskBoxView } from './models';

@Injectable({ providedIn: 'root' })
export class TaskBoxService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/taskbox`;

  get(): Observable<TaskBoxView> {
    return this.http.get<TaskBoxView>(this.base);
  }
}
