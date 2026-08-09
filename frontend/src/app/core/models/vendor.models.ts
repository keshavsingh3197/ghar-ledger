export interface Vendor {
  id: string;
  householdId: string;
  name: string;
  unit: string;
  ratePerUnit: number;
  isActive: boolean;
  createdAt: string;
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
