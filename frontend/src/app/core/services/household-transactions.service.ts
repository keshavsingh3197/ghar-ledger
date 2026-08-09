import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateHouseholdTransactionRequest, HouseholdCashflowSummary, HouseholdTransaction } from '../models/household-transaction.models';

@Injectable({ providedIn: 'root' })
export class HouseholdTransactionsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(householdId: string, from: Date, to: Date): Observable<HouseholdTransaction[]> {
    const query = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    return this.http.get<HouseholdTransaction[]>(`${this.baseUrl}/households/${householdId}/transactions${query}`);
  }

  summary(householdId: string, from: Date, to: Date): Observable<HouseholdCashflowSummary> {
    const query = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    return this.http.get<HouseholdCashflowSummary>(`${this.baseUrl}/households/${householdId}/transactions/summary${query}`);
  }

  create(householdId: string, request: CreateHouseholdTransactionRequest): Observable<HouseholdTransaction> {
    return this.http.post<HouseholdTransaction>(`${this.baseUrl}/households/${householdId}/transactions`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/transactions/${id}`);
  }
}