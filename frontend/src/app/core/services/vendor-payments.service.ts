import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateVendorPaymentRequest, VendorPayment } from '../models/vendor-payment.models';

@Injectable({ providedIn: 'root' })
export class VendorPaymentsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(householdId: string, from: Date, to: Date): Observable<VendorPayment[]> {
    const query = `?from=${from.toISOString()}&to=${to.toISOString()}`;
    return this.http.get<VendorPayment[]>(`${this.baseUrl}/households/${householdId}/vendor-payments${query}`);
  }

  create(householdId: string, request: CreateVendorPaymentRequest): Observable<VendorPayment> {
    return this.http.post<VendorPayment>(`${this.baseUrl}/households/${householdId}/vendor-payments`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/vendor-payments/${id}`);
  }
}