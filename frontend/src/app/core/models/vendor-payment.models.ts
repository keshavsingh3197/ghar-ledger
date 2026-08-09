export interface VendorPayment {
  id: string;
  householdId: string;
  vendorId: string;
  date: string;
  amount: number;
  note?: string | null;
  createdAt: string;
}

export interface CreateVendorPaymentRequest {
  vendorId: string;
  date: string;
  amount: number;
  note?: string | null;
}