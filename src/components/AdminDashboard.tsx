import React, { useState } from 'react';
import { LogOut, Users, FileText, ArrowLeft, TrendingUp, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DailyReportTab } from './DailyReportTab';
import { SettingsTab } from './SettingsTab';
import { CustomerListTab } from './CustomerListTab';

export const AdminDashboard: React.FC<{ onSwitchToPOS: () => void }> = ({ onSwitchToPOS }) => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'report' | 'crm' | 'settings'>('report');

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans pb-10 print:pb-0 print:bg-white">
      
      <header className="print:hidden bg-gray-800 text-white p-4 rounded-b-[2rem] shadow-md sticky top-0 z-40">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2"><TrendingUp size={24}/> অ্যাডমিন প্যানেল</h1>
            <p className="text-sm font-medium opacity-90">{user?.role === 'admin' ? 'অ্যাডমিন' : 'ম্যানেজার'}</p>
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

      <main className="flex-1 p-4 max-w-lg mx-auto w-full mt-2 print:p-0 print:m-0 print:max-w-none">
        {activeTab === 'report' && <DailyReportTab />}

        {activeTab === 'crm' && <CustomerListTab />}

        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};
