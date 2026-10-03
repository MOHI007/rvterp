import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';


interface ManagerPrintReportProps {
  date: string;
}

export const ManagerPrintReport: React.FC<ManagerPrintReportProps> = ({ date }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [bkashTotal, setBkashTotal] = useState(0);
  const [nagadTotal, setNagadTotal] = useState(0);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    return `${toBn(hr)}:${toBn(m)} ${ampm}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      const startDate = new Date(`${date}T06:00:00+06:00`);
      const endDate = new Date(startDate.getTime());
      endDate.setDate(endDate.getDate() + 1);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
      
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      const { data: bData } = await supabase
        .from('bookings')
        .select('*, customers(name)')
        .eq('date', date)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });
        
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso);
        
      const { data: eData } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true });

      const { data: iData } = await supabase
        .from('other_income')
        .select('*')
        .eq('business_date', date)
        .order('created_at', { ascending: true });
      
      setBookings(bData || []);
      setExpenses(eData || []);
      setIncomes(iData || []);
      
      let rev = 0; let cash = 0; let bk = 0; let ng = 0;
      pData?.forEach(p => {
        rev += p.amount;
        if (p.method === 'Cash') cash += p.amount;
        else if (p.method === 'bKash') bk += p.amount;
        else if (p.method === 'Nagad') ng += p.amount;
      });

      iData?.forEach(i => {
        rev += i.amount;
        if (i.method === 'Cash') cash += i.amount;
        else if (i.method === 'bKash') bk += i.amount;
        else if (i.method === 'Nagad') ng += i.amount;
      });

      let exp = 0;
      eData?.forEach(e => exp += e.amount);

      setRevenue(rev);
      setExpenseTotal(exp);
      setCashTotal(cash);
      setBkashTotal(bk);
      setNagadTotal(ng);
    };

    fetchData();
  }, [date]);

  const cashExpenses = expenses.reduce((sum, e) => (e.method === 'Cash' || !e.method) ? sum + e.amount : sum, 0);
  const netCash = cashTotal - cashExpenses;

  const reportContent = (
    <div className="print-area space-y-4 print:text-[12px] print:w-[58mm] print:m-0 print:p-0 print:text-black">
      <div className="hidden print:block text-center border-b border-black pb-2 mb-2">
        <h2 className="font-bold text-lg leading-tight">River View Turf</h2>
        <p className="text-sm">ডেইলি রিপোর্ট</p>
        <p className="text-xs">তারিখ: {(() => {
          const [y, m, day] = date.split('-');
          return new Date(parseInt(y), parseInt(m) - 1, parseInt(day)).toLocaleDateString('bn-BD');
        })()}</p>
      </div>

      <div className="hidden print:grid print:grid-cols-1 print:gap-1">
        <div className="print:flex print:justify-between print:bg-transparent">
          <p className="text-xs font-bold mb-1 flex items-center gap-1 print:text-black">মোট আয়</p>
          <p className="font-bold print:text-black print:text-sm">৳{toBn(revenue)}</p>
        </div>
        <div className="print:flex print:justify-between print:bg-transparent">
          <p className="text-xs font-bold mb-1 flex items-center gap-1 print:text-black">মোট খরচ</p>
          <p className="font-bold print:text-black print:text-sm">৳{toBn(expenseTotal)}</p>
        </div>
        <div className="print:flex print:justify-between print:items-center print:bg-transparent print:text-black print:border-y print:border-black print:py-1 print:px-0">
          <div className="flex items-center gap-2">
            <span className="font-bold print:text-[12px]">ক্যাশ ইন ড্রয়ার</span>
          </div>
          <span className="font-bold print:text-black print:text-sm">৳{toBn(netCash)}</span>
        </div>
      </div>

      <div className="hidden print:block border-b border-black pb-1 mb-1 border-dashed">
        <div className="flex justify-between"><span className="text-[10px]">ক্যাশ:</span><span className="text-[10px]">৳{toBn(cashTotal)}</span></div>
        <div className="flex justify-between"><span className="text-[10px]">বিকাশ:</span><span className="text-[10px]">৳{toBn(bkashTotal)}</span></div>
        <div className="flex justify-between"><span className="text-[10px]">নগদ:</span><span className="text-[10px]">৳{toBn(nagadTotal)}</span></div>
      </div>

      <div className="print:border-none print:shadow-none print:p-0 print:bg-transparent hidden print:block">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black">বুকিং তালিকা</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো বুকিং নেই</p>
        ) : (
          <div className="print:space-y-1">
            {bookings.map(b => (
              <div key={b.id} className="flex justify-between items-center pb-2 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{formatTime(b.start_time)} - {formatTime(b.end_time)}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{b.customers?.name || b.customer_phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">৳{toBn(b.total_price)}</p>
                  {b.due_amount > 0 ? (
                    <span className="text-[10px] font-bold print:border print:border-black print:bg-transparent print:text-black">বকেয়া: ৳{toBn(b.due_amount)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="print:border-none print:shadow-none print:p-0 print:bg-transparent hidden print:block">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black print:mt-2">খরচের তালিকা</h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো খরচ নেই</p>
        ) : (
          <div className="print:space-y-1">
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between items-center pb-2 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{new Date(e.created_at).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{e.category}</p>
                  {e.note && <p className="text-[10px] text-gray-400 print:text-[9px]">{e.note}</p>}
                </div>
                <p className="text-sm font-bold print:text-[11px] print:text-black">৳{toBn(e.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="print:border-none print:shadow-none print:p-0 print:bg-transparent hidden print:block">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black print:mt-2">অন্যান্য আয়ের তালিকা</h3>
        {incomes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো অন্যান্য আয় নেই</p>
        ) : (
          <div className="print:space-y-1">
            {incomes.map(i => (
              <div key={i.id} className="flex justify-between items-center pb-2 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{new Date(i.created_at).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{i.category}</p>
                  {i.note && <p className="text-[10px] text-gray-400 print:text-[9px]">{i.note}</p>}
                </div>
                <p className="text-sm font-bold print:text-[11px] print:text-black">৳{toBn(i.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="hidden print:block text-center mt-4 border-t border-black pt-2 pb-6">
        <p className="text-[10px]">Dev by Engr. A N M AL MUHI</p>
      </div>
    </div>
  );

  return createPortal(
    <div className="print-receipt-container hidden">
      {reportContent}
    </div>,
    document.body
  );
};
