export type HouseholdTransactionType = 'Income' | 'Expense';

export interface HouseholdTransaction {
  id: string;
  householdId: string;
  date: string;
  type: HouseholdTransactionType;
  category: string;
  amount: number;
  memberName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface CreateHouseholdTransactionRequest {
  date: string;
  type: HouseholdTransactionType;
  category: string;
  amount: number;
  memberName?: string | null;
  note?: string | null;
}

export interface HouseholdCashflowSummary {
  income: number;
  expenses: number;
  netIncome: number;
}