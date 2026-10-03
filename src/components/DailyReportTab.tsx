import React, { useState, useEffect } from 'react';
import { getBusinessDateStr } from '../utils/dateUtils';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Calendar, Printer, Copy, FileText, ArrowDown, ArrowUp, Wallet, Download, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { IncomeModal } from './IncomeModal';
import { BookingModal } from './BookingModal';
import { groupConsecutiveBookings } from '../utils/bookingUtils';
import { BkashIcon } from './icons/BkashIcon';
import { NagadIcon } from './icons/NagadIcon';

export const DailyReportTab: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDateStr());
  const [loading, setLoading] = useState(true);
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [activeEditGroup, setActiveEditGroup] = useState<any[] | null>(null);
  const [incomeToEdit, setIncomeToEdit] = useState<any>(null);
  
  const [revenue, setRevenue] = useState(0);
  const [sameDayRev, setSameDayRev] = useState(0);
  const [futureRev, setFutureRev] = useState(0);
  const [pastRev, setPastRev] = useState(0);
  const [cancelledRev, setCancelledRev] = useState(0);
  const [otherRev, setOtherRev] = useState(0);
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
    
    const startDate = new Date(`${selectedDate}T06:00:00+06:00`);
    const endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    
    // Handle invalid date fallback
    if (isNaN(startDate.getTime())) {
      setLoading(false);
      return;
    }

    console.log("Daily Report Fetching Date:", selectedDate);

    // Fetch exactly like Dashboard for bookings to bypass RLS
    const dayRes = await supabase.functions.invoke('get-day', {
      headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
      body: { date: selectedDate }
    }).catch(e => ({ error: e, data: null }));

    // Edge function for financials
    const reportRes = await supabase.functions.invoke('get-daily-report', {
      headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
      body: { date: selectedDate }
    }).catch(e => ({ error: e, data: null }));

    // Direct fallback (will return [] if RLS is enabled, but kept for redundancy)
    const { data: directBookings } = await supabase
      .from('bookings')
      .select('*, customers(name)')
      .eq('date', selectedDate)
      .neq('status', 'cancelled');

    // MAPPING STATE: Priority is get-day (since Dashboard uses it successfully)
    let bData = [];
    if (dayRes?.data?.success && dayRes.data.bookings) {
      bData = dayRes.data.bookings;
    } else if (directBookings && directBookings.length > 0) {
      bData = directBookings;
    } else if (reportRes?.data?.bookings) {
      bData = reportRes.data.bookings;
    }

    console.log("Fetched Bookings:", bData);

    setBookings(bData);

    const isReportFailed = reportRes.error || !reportRes?.data?.success;
    if (isReportFailed) {
      console.warn("Edge function get-daily-report failed or returned empty.", reportRes.error || reportRes?.data?.error);
    }

    const pData = !isReportFailed ? (reportRes.data?.payments || []) : [];
    const eData = !isReportFailed ? (reportRes.data?.expenses || []) : [];
    const iData = !isReportFailed ? (reportRes.data?.incomes || []) : [];
    
    setExpenses(eData);
    setIncomes(iData);
    
    let sdRev = 0; // Today's bookings income
    let fRev = 0;  // Future advance collected today
    let pRev = 0;  // Past dues collected today
    let cRev = 0;  // Cancelled bookings income collected today
    let oRev = 0;  // Other income collected today
    
    let cash = 0; 
    let bk = 0; 
    let ng = 0;

    // 1. Process payments table for Payment Methods and Booking Revenue
    if (pData.length > 0) {
      pData.forEach((p: any) => {
        if (p.method === 'Cash') cash += p.amount;
        else if (p.method === 'bKash') bk += p.amount;
        else if (p.method === 'Nagad') ng += p.amount;

        if (p.bookings?.status === 'cancelled') {
          cRev += p.amount;
        } else {
          const bDate = p.bookings?.date;
          if (bDate) {
            if (bDate > selectedDate) fRev += p.amount;
            else if (bDate < selectedDate) pRev += p.amount;
            else sdRev += p.amount;
          }
        }
      });
    } else {
      // Fallback: calculate income purely from the day's bookings direct array
      // This assumes all advance_paid was collected in Cash if no payment data is available
      const processedGroups = new Set();
      bData.forEach((b: any) => {
        const groupId = b.booking_group_id || b.id;
        if (!processedGroups.has(groupId)) {
          const amt = Number(b.advance_paid) || 0;
          sdRev += amt;
          cash += amt; // Default to cash for fallback
          processedGroups.add(groupId);
        }
      });
    }

    // 3. Process other_income
    iData?.forEach((i: any) => {
      oRev += i.amount;
      if (i.method === 'Cash') cash += i.amount;
      else if (i.method === 'bKash') bk += i.amount;
      else if (i.method === 'Nagad') ng += i.amount;
    });

    const rev = sdRev + fRev + pRev + cRev + oRev;

    let exp = 0;
    eData?.forEach((e: any) => exp += e.amount);

    setRevenue(rev);
    setSameDayRev(sdRev);
    setFutureRev(fRev);
    setPastRev(pRev);
    setCancelledRev(cRev);
    setOtherRev(oRev);
    setExpenseTotal(exp);
    setCashTotal(cash);
    setBkashTotal(bk);
    setNagadTotal(ng);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleDeleteIncome = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই আয়টি ডিলিট করতে চান?')) return;
    try {
      const { data, error } = await supabase.functions.invoke('delete-income', {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        body: { id }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      
      alert('আয় ডিলিট করা হয়েছে!');
      fetchData(); // refresh
    } catch (err: any) {
      console.error(err);
      alert('আয় ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

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
                 `  - আজকের বুকিং থেকে: ৳${toBn(sameDayRev)}\n` +
                 `  - ভবিষ্যৎ বুকিংয়ের অগ্রিম: ৳${toBn(futureRev)}\n` +
                 `  - পুরাতন বকেয়া আদায়: ৳${toBn(pastRev)}\n` +
                 (cancelledRev > 0 ? `  - বাতিল বুকিং (ক্যাশ জমা): ৳${toBn(cancelledRev)}\n` : '') +
                 `  - অন্যান্য আয়: ৳${toBn(otherRev)}\n\n` +
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
      
      const { data, error } = await supabase.functions.invoke('get-monthly-pnl', {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        body: { 
          start_date: getBusinessDateStr(thirtyDaysAgo),
          end_date: getBusinessDateStr()
        }
      });

      if (error || !data?.success) return;
      const bData = data.bookings;
      
      const headers = ['ID', 'Booking Date', 'Start Time', 'Phone', 'Total Price', 'Discount', 'Advance Paid', 'Due', 'Status'];
      const csvRows = [headers.join(',')];
      
      bData.forEach((b: any) => {
        csvRows.push(`${b.id},${b.date},${b.start_time},${b.customer_phone},${b.total_price},${b.discount || 0},${b.advance_paid},${b.due_amount},${b.status}`);
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly_bookings_by_booking_date_${getBusinessDateStr()}.csv`;
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
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:bg-transparent">
          <div className="flex justify-between print:flex-row flex-col">
            <p className="text-gray-500 text-xs font-bold mb-1 flex items-center gap-1 print:text-black"><ArrowUp size={14} className="text-green-500 print:hidden"/> মোট আয়</p>
            <p className="text-xl font-bold text-green-600 print:text-black print:text-sm">৳{toBn(revenue)}</p>
          </div>
          <div className="mt-2 space-y-0.5 text-[10px] text-gray-500 print:text-black border-t border-gray-50 pt-1 print:border-dashed print:border-black">
            <div className="flex justify-between"><span>আজকের বুকিং:</span><span>৳{toBn(sameDayRev)}</span></div>
            <div className="flex justify-between"><span>ভবিষ্যৎ অগ্রিম:</span><span>৳{toBn(futureRev)}</span></div>
            <div className="flex justify-between"><span>পুরাতন বকেয়া:</span><span>৳{toBn(pastRev)}</span></div>
            {cancelledRev > 0 && <div className="flex justify-between text-gray-400"><span>বাতিল বুকিং (ক্যাশ জমা):</span><span>৳{toBn(cancelledRev)}</span></div>}
            <div className="flex justify-between"><span>অন্যান্য আয়:</span><span>৳{toBn(otherRev)}</span></div>
          </div>
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
            {(() => {
              const groupedBookings = groupConsecutiveBookings(bookings);

              return groupedBookings.map(b => (
                <div key={b.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0 print:border-dashed print:border-gray-400">
                  <div>
                    <p className="text-xs font-bold text-gray-500 print:text-[10px] flex items-center gap-2">
                      {formatTime(b.start_time)} - {formatTime(b.end_time)}
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => setActiveEditGroup(b.raw_group)}
                          className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-500 print:hidden transition-colors"
                          title="সম্পাদনা"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                    </p>
                    <p className="text-sm font-bold text-gray-800 print:text-[11px]">{b.customers?.name || b.customer_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800 print:text-[11px]">৳{toBn(b.total_price - (b.discount || 0))} <span className="text-[10px] text-gray-400 font-normal">নেট</span></p>
                    {b.due_amount > 0 ? (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold print:border print:border-black print:bg-transparent print:text-black">বকেয়া: ৳{toBn(b.due_amount)}</span>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold print:hidden">পেইড</span>
                    )}
                  </div>
                </div>
              ));
            })()}
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

      {/* Incomes List */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:bg-transparent mt-4 print:mt-2">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 print:text-xs print:mb-1 print:border-b print:border-black"><ArrowUp size={16} className="print:hidden text-green-500"/> অন্যান্য আয়ের তালিকা</h3>
        {incomes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">কোনো অন্যান্য আয় নেই</p>
        ) : (
          <div className="space-y-3 print:space-y-1">
            {incomes.map(i => (
              <div key={i.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0 print:border-dashed print:border-gray-400">
                <div>
                  <p className="text-xs font-bold text-gray-500 print:text-[10px]">{new Date(i.created_at).toLocaleTimeString('bn-BD', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p className="text-sm font-bold text-gray-800 print:text-[11px]">{i.category} <span className="text-[10px] text-gray-500">({i.method || 'Cash'})</span></p>
                  {i.note && <p className="text-[10px] text-gray-400 print:text-[9px]">{i.note}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-bold text-green-600 print:text-[11px] print:text-black">৳{toBn(i.amount)}</p>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-2 print:hidden">
                      <button onClick={() => setIncomeToEdit(i)} className="p-1.5 bg-gray-100 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteIncome(i.id)} className="p-1.5 bg-gray-100 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
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

      {incomeToEdit && (
        <IncomeModal 
          incomeToEdit={incomeToEdit}
          onClose={() => setIncomeToEdit(null)}
          onSuccess={() => {
            setIncomeToEdit(null);
            alert('আয় আপডেট করা হয়েছে!');
            fetchData();
          }}
        />
      )}

      {/* CSV Download Button */}
      <div className="print:hidden mt-4">
        <button 
          onClick={downloadMonthlyCSV}
          disabled={isGeneratingCSV}
          className="w-full py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-sm"
        >
          <Download size={20} /> {isGeneratingCSV ? 'ডাউনলোড হচ্ছে...' : 'মান্থলি বুকিং রিপোর্ট (বুকিং ডেট অনুযায়ী)'}
        </button>
      </div>


      {activeEditGroup && (
        <BookingModal 
          initialSlot={{ id: activeEditGroup[0].start_time, startTime: activeEditGroup[0].start_time, endTime: activeEditGroup[0].end_time, timeLabel: formatTime(activeEditGroup[0].start_time), price: 0, isPrime: false }} 
          existingGroupBookings={activeEditGroup}
          selectedDate={selectedDate}
          onClose={() => setActiveEditGroup(null)}
          onSuccess={() => {
            setActiveEditGroup(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
};
