import React, { useState, useEffect } from 'react';
import { getBusinessDateStr } from '../utils/dateUtils';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Calendar, Printer, Copy, FileText, ArrowDown, ArrowUp, Wallet, Download } from 'lucide-react';
import { BkashIcon } from './icons/BkashIcon';
import { NagadIcon } from './icons/NagadIcon';

export const DailyReportTab: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDateStr());
  const [loading, setLoading] = useState(true);
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  
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

  const fetchData = async () => {
    setLoading(true);
    
    const startDate = new Date(`${selectedDate}T06:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(5, 59, 59, 999);
    
    // Handle invalid date fallback
    if (isNaN(startDate.getTime())) {
      setLoading(false);
      return;
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const { data: bData } = await supabase
      .from('bookings')
      .select('*, customers(name)')
      .eq('date', selectedDate)
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
    
    setBookings(bData || []);
    setExpenses(eData || []);
    
    let rev = 0; let cash = 0; let bk = 0; let ng = 0;
    pData?.forEach(p => {
      rev += p.amount;
      if (p.method === 'Cash') cash += p.amount;
      else if (p.method === 'bKash') bk += p.amount;
      else if (p.method === 'Nagad') ng += p.amount;
    });

    let exp = 0;
    eData?.forEach(e => exp += e.amount);

    setRevenue(rev);
    setExpenseTotal(exp);
    setCashTotal(cash);
    setBkashTotal(bk);
    setNagadTotal(ng);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const cashExpenses = expenses.reduce((sum, e) => (e.method === 'Cash' || !e.method) ? sum + e.amount : sum, 0);
  const netCash = cashTotal - cashExpenses;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const [y, m, day] = selectedDate.split('-');
    const localDateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(day)).toLocaleDateString('bn-BD');
    const text = `📊 *ডেইলি রিপোর্ট* (${localDateStr})\n\n` +
                 `আজকের আয়: ৳${toBn(revenue)}\n` +
                 `আজকের খরচ: ৳${toBn(expenseTotal)}\n` +
                 `---------------------------\n` +
                 `মোট ক্যাশ কালেকশন: ৳${toBn(cashTotal)}\n` +
                 `বিকাশ: ৳${toBn(bkashTotal)}\n` +
                 `নগদ: ৳${toBn(nagadTotal)}\n` +
                 `---------------------------\n` +
                 `ক্যাশ ইন ড্রয়ার (Cash in Hand): ৳${toBn(netCash)}`;
                 
    navigator.clipboard.writeText(text);
    alert('রিপোর্ট কপি করা হয়েছে!');
  };

  const downloadMonthlyCSV = async () => {
    setIsGeneratingCSV(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: bData } = await supabase
        .from('bookings')
        .select('*')
        .gte('date', getBusinessDateStr(thirtyDaysAgo));

      if (!bData) return;
      
      const headers = ['ID', 'Date', 'Start Time', 'Phone', 'Total Price', 'Advance', 'Due', 'Status'];
      const csvRows = [headers.join(',')];
      
      bData.forEach(b => {
        csvRows.push(`${b.id},${b.date},${b.start_time},${b.customer_phone},${b.total_price},${b.advance_paid},${b.due_amount},${b.status}`);
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly_report_${getBusinessDateStr()}.csv`;
      a.click();
    } catch (e) {
      alert("ডাউনলোড ফেইল হয়েছে।");
    } finally {
      setIsGeneratingCSV(false);
    }
  };

  const reportContent = (
    <div className="print-area space-y-4 print:text-[12px] print:w-[58mm] print:m-0 print:p-0 print:text-black">
      
      <div className="hidden print:block text-center border-b border-black pb-2 mb-2">
        <h2 className="font-bold text-lg leading-tight">River View Turf</h2>
        <p className="text-sm">ডেইলি রিপোর্ট</p>
        <p className="text-xs">তারিখ: {(() => {
          const [y, m, day] = selectedDate.split('-');
          return new Date(parseInt(y), parseInt(m) - 1, parseInt(day)).toLocaleDateString('bn-BD');
        })()}</p>
      </div>

      {/* Summary Cards (Grid in UI, stacked in Print) */}
      <div className="grid grid-cols-2 print:grid-cols-1 gap-3 print:gap-1">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:flex print:justify-between print:bg-transparent">
          <p className="text-gray-500 text-xs font-bold mb-1 flex items-center gap-1 print:text-black"><ArrowUp size={14} className="text-green-500 print:hidden"/> মোট আয়</p>
          <p className="text-xl font-bold text-green-600 print:text-black print:text-sm">৳{toBn(revenue)}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:flex print:justify-between print:bg-transparent">
          <p className="text-gray-500 text-xs font-bold mb-1 flex items-center gap-1 print:text-black"><ArrowDown size={14} className="text-red-500 print:hidden"/> মোট খরচ</p>
          <p className="text-xl font-bold text-red-500 print:text-black print:text-sm">৳{toBn(expenseTotal)}</p>
        </div>
        <div className="col-span-2 print:col-span-1 bg-gray-800 text-white p-4 rounded-2xl shadow-sm print:bg-transparent print:text-black print:border-y print:border-black print:rounded-none print:py-1 print:px-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="print:hidden text-brand-orange" />
            <span className="font-bold text-sm print:text-[12px]">ক্যাশ ইন ড্রয়ার</span>
          </div>
          <span className="text-2xl font-bold text-brand-orange print:text-black print:text-sm">৳{toBn(netCash)}</span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="grid grid-cols-3 print:hidden gap-2 text-sm bg-white p-3 rounded-2xl border border-gray-100">
        <div className="text-center border-r border-gray-100">
          <p className="text-xs text-gray-400 mb-1">ক্যাশ</p>
          <p className="font-bold text-gray-700">৳{toBn(cashTotal)}</p>
        </div>
        <div className="text-center border-r border-gray-100">
          <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><BkashIcon size={12}/> বিকাশ</p>
          <p className="font-bold text-pink-500">৳{toBn(bkashTotal)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><NagadIcon size={12}/> নগদ</p>
          <p className="font-bold text-orange-500">৳{toBn(nagadTotal)}</p>
        </div>
      </div>

      <div className="hidden print:block border-b border-black pb-1 mb-1 border-dashed">
        <div className="flex justify-between"><span className="text-[10px]">ক্যাশ:</span><span className="text-[10px]">৳{toBn(cashTotal)}</span></div>
        <div className="flex justify-between"><span className="text-[10px]">বিকাশ:</span><span className="text-[10px]">৳{toBn(bkashTotal)}</span></div>
        <div className="flex justify-between"><span className="text-[10px]">নগদ:</span><span className="text-[10px]">৳{toBn(nagadTotal)}</span></div>
      </div>

      {/* Bookings List */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:bg-transparent">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black"><FileText size={16} className="print:hidden"/> বুকিং তালিকা</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো বুকিং নেই</p>
        ) : (
          <div className="space-y-3 print:space-y-1">
            {bookings.map(b => (
              <div key={b.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{formatTime(b.start_time)} - {formatTime(b.end_time)}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{b.customers?.name || b.customer_phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">৳{toBn(b.total_price)}</p>
                  {b.due_amount > 0 ? (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold print:border print:border-black print:bg-transparent print:text-black">বকেয়া: ৳{toBn(b.due_amount)}</span>
                  ) : (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold print:hidden">পেইড</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:bg-transparent">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black print:mt-2"><ArrowDown size={16} className="print:hidden text-red-500"/> খরচের তালিকা</h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো খরচ নেই</p>
        ) : (
          <div className="space-y-3 print:space-y-1">
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{new Date(e.created_at).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{e.category} <span className="text-[10px] text-gray-500">({e.method || 'Cash'})</span></p>
                  {e.note && <p className="text-[10px] text-gray-400 print:text-[9px]">{e.note}</p>}
                </div>
                <p className="text-sm font-bold text-red-500 print:text-[11px] print:text-black">৳{toBn(e.amount)}</p>
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

  return (
    <div className="space-y-4 animate-in slide-in-from-left-4 pb-20">
      
      {/* Non-printable Controls */}
      <div className="print:hidden flex justify-between items-center bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-700">
        <div className="relative flex-1 mr-3">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange text-sm font-bold text-white [color-scheme:dark]"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint}
            title="58mm প্রিন্ট করুন"
            className="p-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl shadow-sm flex items-center justify-center transition-colors text-white active:scale-95"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleCopy}
            title="WhatsApp এ কপি করুন"
            className="p-3 bg-green-600 hover:bg-green-500 border border-green-500 rounded-xl shadow-sm flex items-center justify-center transition-colors text-white active:scale-95"
          >
            <Copy size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10 font-bold">লোড হচ্ছে...</p>
      ) : reportContent}

      {/* Hidden Portal strictly for Printing */}
      {!loading && createPortal(
        <div className="print-receipt-container hidden">
          {reportContent}
        </div>,
        document.body
      )}

      {/* CSV Download Button */}
      <div className="print:hidden mt-4">
        <button 
          onClick={downloadMonthlyCSV}
          disabled={isGeneratingCSV}
          className="w-full py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-sm"
        >
          <Download size={20} /> {isGeneratingCSV ? 'ডাউনলোড হচ্ছে...' : 'মান্থলি রিপোর্ট ডাউনলোড (CSV)'}
        </button>
      </div>

    </div>
  );
};
