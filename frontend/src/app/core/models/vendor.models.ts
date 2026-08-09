export interface Vendor {
  id: string;
  householdId: string;
  name: string;
  unit: string;
  ratePerUnit: number;
  rates: VendorRate[];
  isActive: boolean;
  createdAt: string;
}

export interface VendorRate {
  id: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CreateVendorRequest {
  name: string;
  unit: string;
  ratePerUnit: number;
}

export interface UpdateVendorRequest {
  name: string;
  unit: string;
  ratePerUnit: number;
  isActive: boolean;
}

export interface CreateVendorRateRequest {
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}
