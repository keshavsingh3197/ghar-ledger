export interface DailyEntry {
  id: string;
  householdId: string;
  vendorId: string;
  date: string;
  quantity: number;
  amount: number;
  note?: string | null;
  createdAt: string;
}

export interface CreateDailyEntryRequest {
  vendorId: string;
  date: string;
  quantity: number;
  note?: string | null;
}

export interface UpdateDailyEntryRequest {
  quantity: number;
  note?: string | null;
}

export interface MonthlyVendorTotal {
  vendorId: string;
  vendorName: string;
  totalQuantity: number;
  totalAmount: number;
}
