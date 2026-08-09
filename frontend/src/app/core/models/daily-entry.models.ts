export interface DailyEntry {
  id: string;
  householdId: string;
  vendorId: string;
  date: string;
  period: DeliveryPeriod;
  quantity: number;
  ratePerUnit: number;
  amount: number;
  paidAmount: number;
  note?: string | null;
  createdAt: string;
}

export type DeliveryPeriod = 'Morning' | 'Evening' | 'Anytime';

export interface CreateDailyEntryRequest {
  vendorId: string;
  date: string;
  quantity: number;
  ratePerUnit?: number | null;
  period?: DeliveryPeriod;
  paidAmount?: number;
  note?: string | null;
}

export interface UpdateDailyEntryRequest {
  date: string;
  quantity: number;
  ratePerUnit: number;
  period: DeliveryPeriod;
  paidAmount: number;
  note?: string | null;
}

export interface MonthlyVendorTotal {
  vendorId: string;
  vendorName: string;
  entryCount: number;
  totalQuantity: number;
  totalAmount: number;
  totalPaid: number;
  balance: number;
}
