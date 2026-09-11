export type ShiftMode = 'AUTOMATIC' | 'MANUAL';
export type ShiftStatus = 'OPEN' | 'CLOSED';
export type ShiftScope = 'PER_LOCATION' | 'GLOBAL';

export interface Shift {
  id: number;
  shiftNumber: string;
  mode: ShiftMode;
  status: ShiftStatus;
  scope: ShiftScope;
  locationId?: string | null;
  scheduleName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openedByUserId?: number | null;
  openedByName?: string | null;
  closedByUserId?: number | null;
  closedByName?: string | null;
  openingCashFloat?: number | null;
  expectedClosingCash?: number | null;
  actualClosingCash?: number | null;
  cashVariance?: number | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface CurrentShiftStatus {
  enabled: boolean;
  mode: ShiftMode;
  scope: ShiftScope;
  shift: Shift | null;
}

export interface OpenShiftRequest {
  locationId?: string;
  openingCashFloat?: number;
  notes?: string;
}

export interface CloseShiftRequest {
  actualClosingCash?: number;
  notes?: string;
}

export interface ShiftSchedule {
  id?: number;
  name: string;
  startTime: string; // "HH:mm" or "HH:mm:ss"
  endTime: string;
  daysOfWeek?: string | null; // comma list of DayOfWeek names, blank = every day
  active: boolean;
  sortOrder?: number | null;
}

export interface ShiftSummary {
  shift: Shift;
  paymentsByMethod: Record<string, number>;
  totalTendered: number;
  totalRefunds: number;
  saleCount: number;
}
