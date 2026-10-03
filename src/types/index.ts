export interface Customer {
  phone_number: string;
  name: string;
  total_matches: number;
  advance_balance: number;
}

export interface Booking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  booking_group_id?: string;
  receipt_id?: string;
  actual_check_in?: string;
  actual_check_out?: string;
  customer_phone: string;
  total_price: number;
  discount: number;
  advance_paid: number;
  due_amount: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  note?: string;
  booked_by_role?: 'admin' | 'manager';
  customers?: Customer; // Joined property from Supabase
}

export interface Slot {
  id: string; // e.g. "18:00:00"
  timeLabel: string;
  startTime: string;
  endTime: string;
  price: number;
  isPrime: boolean;
}

export interface AppSettings {
  id: number;
  dynamic_pricing_rules: {
    day_rate: number;
    night_rate: number;
    night_start_hour: number;
    max_discount_per_day: number;
  };
  max_discount_allowed: number;
  receipt_footer_text?: string;
  force_advance_payment?: boolean;
  print_office_copy?: boolean;
  print_expense_voucher?: boolean;
  expense_categories?: string[];
  income_categories?: string[];
}

export const generateDailySlots = (settings?: AppSettings): Slot[] => {
  const slots: Slot[] = [];
  let currentHour = 6; // Starts at 6 AM
  
  const dayRate = settings?.dynamic_pricing_rules?.day_rate || 600;
  const nightRate = settings?.dynamic_pricing_rules?.night_rate || 1000;
  const nightStart = settings?.dynamic_pricing_rules?.night_start_hour || 18;
  
  for (let i = 0; i < 22; i++) {
    const isPrime = currentHour >= nightStart || currentHour < 4; 
    const price = isPrime ? nightRate : dayRate;
    
    const formatHour = (h: number) => {
      const period = h >= 12 && h < 24 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH}:00 ${period}`;
    };
    
    const nextHour = (currentHour + 1) % 24;
    
    slots.push({
      id: `${currentHour.toString().padStart(2, '0')}:00:00`,
      timeLabel: `${formatHour(currentHour)} - ${formatHour(nextHour)}`,
      startTime: `${currentHour.toString().padStart(2, '0')}:00:00`,
      endTime: `${nextHour.toString().padStart(2, '0')}:00:00`,
      price,
      isPrime,
    });
    
    currentHour = nextHour;
  }
  return slots;
};
