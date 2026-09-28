import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Copy, Download, Users, FileText, ArrowLeft, TrendingUp, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PnLCard } from './PnLCard';
import { SettingsTab } from './SettingsTab';
import { CustomerListTab } from './CustomerListTab';
import { BkashIcon } from './icons/BkashIcon';
import { NagadIcon } from './icons/NagadIcon';

export const AdminDashboard: React.FC<{ onSwitchToPOS: () => void }> = ({ onSwitchToPOS }) => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'report' | 'crm' | 'settings'>('report');
  
  const [reportText, setReportText] = useState('লোড হচ্ছে...');
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayCash, setTodayCash] = useState(0);
  const [todayBkash, setTodayBkash] = useState(0);
  const [todayNagad, setTodayNagad] = useState(0);
  const [todayMatches, setTodayMatches] = useState(0);
  const [todayUnbooked, setTodayUnbooked] = useState(14);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const getLocalDateStr = (d: Date = new Date()) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const generateDailyReport = async () => {
    const today = getLocalDateStr();
    
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .gte('created_at', today + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z');

    const { data: payments } = await supabase.from('payments').select('*').gte('created_at', today + 'T00:00:00Z');
    const { data: exps } = await supabase.from('expenses').select('amount').gte('created_at', today + 'T00:00:00Z');
    const { data: bookings } = await supabase.from('bookings').select('id').eq('date', today);
    
    let rev = 0; let cash = 0; let bkash = 0; let nagad = 0;
    payments?.forEach(p => {
      rev += p.amount;
      if (p.method === 'Cash') cash += p.amount;
      else if (p.method === 'bKash') bkash += p.amount;
      else if (p.method === 'Nagad') nagad += p.amount;
    });

    let exp = 0;
    exps?.forEach(e => exp += e.amount);

    setTodayRevenue(rev);
    setTodayExpenses(exp);
    setTodayCash(cash);
    setTodayBkash(bkash);
    setTodayNagad(nagad);
    setTodayMatches(bookings?.length || 0);
    setTodayUnbooked(Math.max(0, 14 - (bookings?.length || 0)));

    let expectedCash = 0;
    let actualCash = 0;
    let shiftBkash = 0;
    let shiftNagad = 0;

    shifts?.forEach(s => {
      expectedCash += s.expected_cash || 0;
      actualCash += s.blind_counted_cash || 0;
      shiftBkash += s.bkash_total || 0;
      shiftNagad += s.nagad_total || 0;
    });

    const discrepancy = actualCash - expectedCash;
    
    const text = `📊 *ডেইলি রিপোর্ট* (${new Date().toLocaleDateString('bn-BD')})\n\n` +
                 `আজকের আয়: ৳${rev}\n` +
                 `আজকের খরচ: ৳${exp}\n` +
                 `---------------------------\n` +
                 `মোট ক্যাশ কালেকশন: ৳${cash}\n` +
                 `বিকাশ: ৳${shiftBkash}\n` +
                 `নগদ: ৳${shiftNagad}\n` +
                 `---------------------------\n` +
                 `ম্যানেজার জমা ক্যাশ: ৳${actualCash}\n` +
                 `গরমিল: ${discrepancy > 0 ? '+' : ''}৳${discrepancy}`;
                 
    setReportText(text);
  };

  useEffect(() => {
    generateDailyReport();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    alert('রিপোর্ট কপি করা হয়েছে!');
  };

  const downloadMonthlyCSV = async () => {
    setIsGeneratingCSV(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .gte('date', getLocalDateStr(thirtyDaysAgo));

      if (!bookings) return;
      
      const headers = ['ID', 'Date', 'Start Time', 'Phone', 'Total Price', 'Advance', 'Due', 'Status'];
      const csvRows = [headers.join(',')];
      
      bookings.forEach(b => {
        csvRows.push(`${b.id},${b.date},${b.start_time},${b.customer_phone},${b.total_price},${b.advance_paid},${b.due_amount},${b.status}`);
      });
      
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly_report_${getLocalDateStr()}.csv`;
      a.click();
    } catch (e) {
      alert("ডাউনলোড ফেইল হয়েছে।");
    } finally {
      setIsGeneratingCSV(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans pb-10">
      
      <header className="bg-gray-800 text-white p-4 rounded-b-[2rem] shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2"><TrendingUp size={24}/> অ্যাডমিন প্যানেল</h1>
            <p className="text-sm font-medium opacity-90">{user?.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onSwitchToPOS} className="p-2.5 bg-brand-orange rounded-xl active:scale-95 transition-all text-sm font-bold flex items-center gap-1 shadow-sm">
              <ArrowLeft size={16} /> POS প্যানেল
            </button>
            <button onClick={logout} className="p-2.5 bg-white/20 rounded-xl active:scale-95 transition-all shadow-sm">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 p-1 bg-white/10 rounded-2xl">
          <button 
            onClick={() => setActiveTab('report')} 
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'report' ? 'bg-white text-gray-800 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            <FileText size={16} /> ডেইলি রিপোর্ট
          </button>
          <button 
            onClick={() => setActiveTab('crm')} 
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'crm' ? 'bg-white text-gray-800 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            <Users size={16} /> গ্রাহক তালিকা
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'settings' ? 'bg-white text-gray-800 shadow-sm' : 'text-white hover:bg-white/10'}`}
          >
            <Settings size={16} /> সেটিংস
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full mt-2">
        {activeTab === 'report' && (
          <div className="space-y-4 animate-in slide-in-from-left-4">
            
            <PnLCard />

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold flex items-center gap-2 border-b border-gray-100 pb-2 text-gray-800"><FileText size={18}/> আজকের হিসাব (Today's Overview)</h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                  <p className="text-gray-500 mb-1">আজকের আয়</p>
                  <p className="text-xl font-bold text-green-600">৳{toBn(todayRevenue)}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                  <p className="text-gray-500 mb-1">আজকের খরচ</p>
                  <p className="text-xl font-bold text-red-500">৳{toBn(todayExpenses)}</p>
                </div>
              </div>
              
              <div className="bg-brand-orange/10 border border-brand-orange/20 p-3 rounded-xl flex justify-between items-center text-lg">
                <span className="font-bold text-gray-700">ক্যাশ ইন ড্রয়ার:</span>
                <span className="font-bold text-brand-orange text-2xl">৳{toBn(todayCash - todayExpenses)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                  <p className="text-gray-500 text-xs">আজকের ম্যাচ</p>
                  <p className="text-lg font-bold text-gray-800">{toBn(todayMatches)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                  <p className="text-gray-500 text-xs">খালি স্লট</p>
                  <p className="text-lg font-bold text-gray-800">{toBn(todayUnbooked)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                  <p className="text-gray-500 text-xs">আজকের ক্যাশ</p>
                  <p className="text-lg font-bold text-green-600">৳{toBn(todayCash)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-2 rounded-xl flex flex-col justify-center gap-1.5">
                  <div className="flex items-center justify-between text-pink-500">
                    <BkashIcon size={18} />
                    <span className="font-bold text-sm">৳{toBn(todayBkash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-orange-500">
                    <NagadIcon size={18} />
                    <span className="font-bold text-sm">৳{toBn(todayNagad)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleCopy}
                title="রিপোর্ট কপি করুন"
                className="flex-1 py-4 bg-gray-800 hover:bg-black text-white rounded-2xl active:scale-95 transition-all flex justify-center items-center shadow-md border-2 border-gray-700"
              >
                <Copy size={24} />
              </button>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(reportText)}`}
                target="_blank"
                rel="noreferrer"
                title="WhatsApp এ পাঠান"
                className="flex-1 py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl active:scale-95 transition-all flex justify-center items-center shadow-md border-2 border-[#20bd5a]"
              >
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              </a>
            </div>

            <button 
              onClick={downloadMonthlyCSV}
              disabled={isGeneratingCSV}
              className="w-full py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-sm mt-4"
            >
              <Download size={20} /> {isGeneratingCSV ? 'ডাউনলোড হচ্ছে...' : 'মান্থলি রিপোর্ট ডাউনলোড (CSV)'}
            </button>
          </div>
        )}

        {activeTab === 'crm' && <CustomerListTab />}

        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};
