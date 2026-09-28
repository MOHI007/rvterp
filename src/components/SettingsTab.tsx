import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsTab: React.FC = () => {
  const { settings, fetchSettings } = useAuth();
  
  const [dayRate, setDayRate] = useState(600);
  const [nightRate, setNightRate] = useState(1000);
  const [nightStartHour, setNightStartHour] = useState(18);
  const [maxDiscountSlot, setMaxDiscountSlot] = useState(100);
  const [maxDiscountDay, setMaxDiscountDay] = useState(500);
  const [receiptFooterText, setReceiptFooterText] = useState('দয়া করে টার্ফ শু পরিধান করুন।');
  const [forceAdvance, setForceAdvance] = useState(false);
  const [printOfficeCopy, setPrintOfficeCopy] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setDayRate(settings.dynamic_pricing_rules?.day_rate || 600);
      setNightRate(settings.dynamic_pricing_rules?.night_rate || 1000);
      setNightStartHour(settings.dynamic_pricing_rules?.night_start_hour || 18);
      setMaxDiscountSlot(settings.max_discount_allowed || 100);
      setMaxDiscountDay(settings.dynamic_pricing_rules?.max_discount_per_day || 500);
      if (settings.receipt_footer_text) setReceiptFooterText(settings.receipt_footer_text);
      setForceAdvance(settings.force_advance_payment || false);
      setPrintOfficeCopy(settings.print_office_copy ?? true);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        dynamic_pricing_rules: {
          day_rate: dayRate,
          night_rate: nightRate,
          night_start_hour: nightStartHour,
          max_discount_per_day: maxDiscountDay
        },
        max_discount_allowed: maxDiscountSlot,
        receipt_footer_text: receiptFooterText,
        force_advance_payment: forceAdvance,
        print_office_copy: printOfficeCopy
      };
      
      const { error } = await supabase
        .from('settings')
        .upsert({ id: settings?.id || 1, ...payload });

      if (error) throw error;
      await fetchSettings();
      alert('সেটিংস সফলভাবে সেভ হয়েছে!');
    } catch (err) {
      console.error(err);
      alert('সেটিংস সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">প্রাইসিং সেটিংস (Pricing)</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">ডে রেট (Day Rate)</label>
            <input type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()} value={dayRate} onChange={e => setDayRate(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">নাইট রেট (Night Rate)</label>
            <input type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()} value={nightRate} onChange={e => setNightRate(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">নাইট শিফট শুরুর সময় (24-Hour e.g. 18 = 6 PM)</label>
            <input type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()} value={nightStartHour} onChange={e => setNightStartHour(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">ডিসকাউন্ট লিমিট (Discount)</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">সর্বোচ্চ ছাড় (প্রতি স্লট)</label>
            <input type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()} value={maxDiscountSlot} onChange={e => setMaxDiscountSlot(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">সর্বোচ্চ ছাড় (প্রতি দিন)</label>
            <input type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()} value={maxDiscountDay} onChange={e => setMaxDiscountDay(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" />
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">প্রিন্ট রশিদের সেটিংস (Receipt)</h3>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">রশিদের নিচের বার্তা (Footer Message)</label>
          <textarea 
            value={receiptFooterText} 
            onChange={e => setReceiptFooterText(e.target.value)} 
            rows={3}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-orange font-semibold text-gray-800" 
          />
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <h4 className="font-bold text-sm text-gray-800">অগ্রিম পেমেন্ট বাধ্যতামূলক করুন</h4>
            <p className="text-[11px] text-gray-500">বুকিংয়ের সময় ম্যানেজারকে অবশ্যই অগ্রিম নিতে হবে</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={forceAdvance} onChange={() => setForceAdvance(!forceAdvance)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <h4 className="font-bold text-sm text-gray-800">অফিস কপি প্রিন্ট করুন</h4>
            <p className="text-[11px] text-gray-500">গ্রাহক কপির সাথে টার্ফের জন্য একটি অফিস কপি প্রিন্ট হবে</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={printOfficeCopy} onChange={() => setPrintOfficeCopy(!printOfficeCopy)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
          </label>
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 bg-brand-orange text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-lg shadow-orange-500/30"
      >
        {isSaving ? 'সেভ হচ্ছে...' : <><Save size={20} /> সেভ করুন</>}
      </button>
    </div>
  );
};
