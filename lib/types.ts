export type Customer = {
  no: string;
  date: string;
  car: string;
  name: string;
  phone: string;
  note: string;
  rowIndex: number;
};

export type CustomerInput = {
  car: string;
  name: string;
  phone: string;
  note: string;
};

export type InterestRate = {
  vehicleType: string;
  yearRange: string;
  months48: number | null;
  months60: number | null;
  months72: number | null;
  months84: number | null;
  commission: number;
};

export type InstallmentRow = {
  label: string;
  downRate: number | null;
  downPayment: number;
  financeAmount: number;
  payments: {
    months48: number;
    months60: number;
    months72: number;
    months84: number;
  };
};
