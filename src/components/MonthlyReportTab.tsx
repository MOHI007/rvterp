import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

export const MonthlyReportTab: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<{
    totalBookingIncome: number;
    totalExpenses: number;
    totalOtherIncome: number;
    netProfit: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMonthlyReport = async () => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('get-monthly-report', {
        headers: {
          'x-session-token': localStorage.getItem('session_token') || ''
        },
        body: { year: selectedYear, month: selectedMonth }
      });

      if (error) throw error;
      if (result?.success) {
        setData(result);
      }
    } catch (err) {
      console.error("Error fetching monthly report:", err);
      alert("রিপোর্ট ফেচ করতে সমস্যা হয়েছে");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear, selectedMonth]);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const months = [
    { value: 1, label: 'জানুয়ারি' },
    { value: 2, label: 'ফেব্রুয়ারি' },
    { value: 3, label: 'মার্চ' },
    { value: 4, label: 'এপ্রিল' },
    { value: 5, label: 'মে' },
    { value: 6, label: 'জুন' },
    { value: 7, label: 'জুলাই' },
    { value: 8, label: 'আগস্ট' },
    { value: 9, label: 'সেপ্টেম্বর' },
    { value: 10, label: 'অক্টোবর' },
    { value: 11, label: 'নভেম্বর' },
    { value: 12, label: 'ডিসেম্বর' },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 mb-1">বছর</label>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm font-bold"
          >
            {years.map(y => (
              <option key={y} value={y}>{toBn(y)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 mb-1">মাস</label>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-brand-orange text-sm font-bold"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500 text-white rounded-xl">
                <DollarSign size={20} />
              </div>
              <h3 className="font-bold text-gray-800">মোট বুকিং আয়</h3>
            </div>
            <p className="text-3xl font-black text-green-700">৳ {toBn(data.totalBookingIncome)}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-100 border border-blue-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500 text-white rounded-xl">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-gray-800">মোট অন্যান্য আয়</h3>
            </div>
            <p className="text-3xl font-black text-blue-700">৳ {toBn(data.totalOtherIncome)}</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-100 border border-red-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-500 text-white rounded-xl">
                <TrendingDown size={20} />
              </div>
              <h3 className="font-bold text-gray-800">মোট খরচ</h3>
            </div>
            <p className="text-3xl font-black text-red-700">৳ {toBn(data.totalExpenses)}</p>
          </div>

          <div className={`bg-gradient-to-br ${data.netProfit >= 0 ? 'from-gray-800 to-gray-900 border-gray-700' : 'from-red-800 to-red-900 border-red-700'} p-6 rounded-3xl shadow-lg mt-2 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wallet size={80} />
            </div>
            <div className="relative z-10">
              <h3 className="font-bold text-gray-300 text-sm mb-1">{data.netProfit >= 0 ? 'নিট লাভ (Net Profit)' : 'নিট লোকসান (Net Loss)'}</h3>
              <p className={`text-4xl font-black ${data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ৳ {toBn(Math.abs(data.netProfit))}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
