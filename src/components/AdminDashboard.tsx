import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Copy, Download, Users, FileText, ArrowLeft, TrendingUp, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { type Customer } from '../types';
import { PnLCard } from './PnLCard';
import { SettingsTab } from './SettingsTab';

export const AdminDashboard: React.FC<{ onSwitchToPOS: () => void }> = ({ onSwitchToPOS }) => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'report' | 'crm' | 'settings'>('report');
  
  const [reportText, setReportText] = useState('লোড হচ্ছে...');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const generateDailyReport = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .gte('created_at', today + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z');

    let expectedCash = 0;
    let actualCash = 0;
    let bkash = 0;
    let nagad = 0;

    shifts?.forEach(s => {
      expectedCash += s.expected_cash || 0;
      actualCash += s.blind_counted_cash || 0;
      bkash += s.bkash_total || 0;
      nagad += s.nagad_total || 0;
    });

    const discrepancy = actualCash - expectedCash;
    
    const text = `📊 *ডেইলি রিপোর্ট* (${new Date().toLocaleDateString('bn-BD')})\n\n` +
                 `মোট ক্যাশ সেলস: ৳${expectedCash}\n` +
                 `বিকাশ: ৳${bkash}\n` +
                 `নগদ: ৳${nagad}\n` +
                 `---------------------------\n` +
                 `ম্যানেজার জমা ক্যাশ: ৳${actualCash}\n` +
                 `গরমিল: ${discrepancy > 0 ? '+' : ''}৳${discrepancy}`;
                 
    setReportText(text);
  };

  const fetchCRM = async () => {
    const { data } = await supabase.from('customers').select('*').order('total_matches', { ascending: false });
    if (data) setCustomers(data);
  };

  useEffect(() => {
    generateDailyReport();
    fetchCRM();
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
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

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
      a.download = `monthly_report_${new Date().toISOString().split('T')[0]}.csv`;
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

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 whitespace-pre-wrap font-medium text-gray-800 text-sm leading-relaxed">
              {reportText}
            </div>

            <button 
              onClick={handleCopy}
              className="w-full py-4 bg-brand-orange text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-lg shadow-orange-500/30"
            >
              <Copy size={20} /> কপি করুন (WhatsApp)
            </button>

            <button 
              onClick={downloadMonthlyCSV}
              disabled={isGeneratingCSV}
              className="w-full py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-sm mt-4"
            >
              <Download size={20} /> {isGeneratingCSV ? 'ডাউনলোড হচ্ছে...' : 'মান্থলি রিপোর্ট ডাউনলোড (CSV)'}
            </button>
          </div>
        )}

        {activeTab === 'crm' && (
          <div className="space-y-3 animate-in slide-in-from-right-4">
            <h2 className="font-bold text-gray-800 mb-2">সর্বোচ্চ ম্যাচ খেলা গ্রাহক</h2>
            {customers.map(customer => (
              <div key={customer.phone_number} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">{customer.name}</h3>
                  <p className="text-xs font-semibold text-gray-500">{customer.phone_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-orange">{toBn(customer.total_matches)} ম্যাচ</p>
                  {customer.advance_balance > 0 && (
                    <p className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg inline-block mt-1 font-bold">
                      ক্রেডিট: ৳{toBn(customer.advance_balance)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};
