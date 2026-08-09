import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateVendorRateRequest, CreateVendorRequest, UpdateVendorRequest, Vendor, VendorRate } from '../models/vendor.models';

@Injectable({ providedIn: 'root' })
export class VendorsService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(householdId: string): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${this.baseUrl}/households/${householdId}/vendors`);
  }

  create(householdId: string, req: CreateVendorRequest): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.baseUrl}/households/${householdId}/vendors`, req);
  }

  update(id: string, req: UpdateVendorRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/vendors/${id}`, req);
  }

  addRate(id: string, req: CreateVendorRateRequest): Observable<VendorRate> {
    return this.http.post<VendorRate>(`${this.baseUrl}/vendors/${id}/rates`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/vendors/${id}`);
  }
}
