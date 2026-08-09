import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Household } from '../models/household.models';

@Injectable({ providedIn: 'root' })
export class HouseholdsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMine(): Observable<Household[]> {
    return this.http.get<Household[]>(`${this.baseUrl}/households`);
  }

  getById(id: string): Observable<Household> {
    return this.http.get<Household>(`${this.baseUrl}/households/${id}`);
  }

  create(name: string): Observable<Household> {
    return this.http.post<Household>(`${this.baseUrl}/households`, { name });
  }

  addMember(householdId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/households/${householdId}/members`, { userId });
  }

  removeMember(householdId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/households/${householdId}/members/${userId}`);
  }
}
