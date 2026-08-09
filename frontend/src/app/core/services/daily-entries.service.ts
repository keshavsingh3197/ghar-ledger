import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateDailyEntryRequest, DailyEntry, MonthlyVendorTotal, UpdateDailyEntryRequest,
} from '../models/daily-entry.models';

@Injectable({ providedIn: 'root' })
export class DailyEntriesService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(householdId: string, from: Date, to: Date): Observable<DailyEntry[]> {
    const q = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    return this.http.get<DailyEntry[]>(`${this.baseUrl}/households/${householdId}/entries${q}`);
  }

  monthlyTotals(householdId: string, year: number, month: number): Observable<MonthlyVendorTotal[]> {
    const q = `?year=${year}&month=${month}`;
    return this.http.get<MonthlyVendorTotal[]>(
      `${this.baseUrl}/households/${householdId}/entries/monthly-totals${q}`);
  }

  rangeTotals(householdId: string, from: Date, to: Date): Observable<MonthlyVendorTotal[]> {
    const q = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    return this.http.get<MonthlyVendorTotal[]>(
      `${this.baseUrl}/households/${householdId}/entries/range-totals${q}`);
  }

  create(householdId: string, req: CreateDailyEntryRequest): Observable<DailyEntry> {
    return this.http.post<DailyEntry>(`${this.baseUrl}/households/${householdId}/entries`, req);
  }

  update(id: string, req: UpdateDailyEntryRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/entries/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/entries/${id}`);
  }
}
