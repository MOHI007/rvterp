import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calculator } from 'lucide-react';

export const PnLCard: React.FC = () => {
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [digitalTotal, setDigitalTotal] = useState(0);
  
  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  useEffect(() => {
    const fetchPnL = async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);
      const startStr = startOfMonth.toISOString();

      const { data: payments } = await supabase.from('payments').select('*').gte('created_at', startStr);
      const { data: exps } = await supabase.from('expenses').select('amount').gte('created_at', startStr);
      const { data: bookings } = await supabase.from('bookings').select('discount, id').gte('date', startOfMonth.toISOString().split('T')[0]);

      let rev = 0;
      let cTotal = 0;
      let dTotal = 0;
      
      payments?.forEach(p => {
        rev += p.amount;
        if (p.method === 'Cash') cTotal += p.amount;
        else dTotal += p.amount;
      });

      let exp = 0;
      exps?.forEach(e => exp += e.amount);
      
      let disc = 0;
      bookings?.forEach(b => disc += (b.discount || 0));

      setRevenue(rev);
      setExpenses(exp);
      setTotalMatches(bookings?.length || 0);
      setTotalDiscount(disc);
      setCashTotal(cTotal);
      setDigitalTotal(dTotal);
    };
    fetchPnL();
  }, []);

  const profit = revenue - expenses;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-5 rounded-2xl shadow-sm border border-gray-700 space-y-4 mb-4">
      <h3 className="font-bold flex items-center gap-2 border-b border-gray-700 pb-2"><Calculator size={18}/> চলতি মাসের হিসাব (P&L)</h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
        <div className="bg-white/10 p-3 rounded-xl">
          <p className="text-gray-400 mb-1">মোট আয় (Revenue)</p>
          <p className="text-xl font-bold text-green-400">৳{toBn(revenue)}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-xl">
          <p className="text-gray-400 mb-1">মোট খরচ (Expenses)</p>
          <p className="text-xl font-bold text-red-400">৳{toBn(expenses)}</p>
        </div>
      </div>
      
      <div className="bg-brand-orange/20 border border-brand-orange/30 p-3 rounded-xl flex justify-between items-center text-lg">
        <span className="font-bold text-orange-100">নীট লাভ (Net Profit):</span>
        <span className="font-bold text-brand-orange text-2xl">৳{toBn(profit)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mt-4">
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl">
          <p className="text-gray-400 text-xs">মোট ম্যাচ</p>
          <p className="text-lg font-bold">{toBn(totalMatches)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl">
          <p className="text-gray-400 text-xs">মোট ছাড়</p>
          <p className="text-lg font-bold text-brand-amber">৳{toBn(totalDiscount)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl">
          <p className="text-gray-400 text-xs">ক্যাশ কালেকশন</p>
          <p className="text-lg font-bold text-green-400">৳{toBn(cashTotal)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl">
          <p className="text-gray-400 text-xs">ডিজিটাল (বিকাশ/নগদ)</p>
          <p className="text-lg font-bold text-blue-400">৳{toBn(digitalTotal)}</p>
        </div>
      </div>
    </div>
  );
};
