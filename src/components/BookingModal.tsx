import React, { useState, useEffect } from 'react';
import { X, Phone, User, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { type Slot, type Customer } from '../types';
import { useAuth } from '../context/AuthContext';

interface BookingModalProps {
  initialSlot: Slot;
  selectedDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ initialSlot, selectedDate, onClose, onSuccess }) => {
  const { settings } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  
  const [hours, setHours] = useState(1);
  const [discount, setDiscount] = useState('');
  const [advance, setAdvance] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState<'Cash' | 'bKash' | 'Nagad'>('Cash');
  const [advanceTrxId, setAdvanceTrxId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9০-৯]/g, '');
    raw = raw.replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);
    raw = raw.slice(0, 11);
    
    setPhone(raw);
    setPhoneError('');
  };

  const handleTrxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9০-৯]/g, '');
    raw = raw.replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);
    raw = raw.slice(0, 4);
    setAdvanceTrxId(raw);
  };

  const basePrice = initialSlot.price * hours;
  const parsedDiscount = parseInt(discount) || 0;
  const maxDiscount = hours * (settings?.max_discount_allowed || 100);
  
  const netAmount = basePrice - parsedDiscount;
  const dueAmount = Math.max(0, netAmount - (parseInt(advance) || 0));

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  const toEn = (str: string) => str.replace(/[০-৯]/g, d => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);

  // Auto-lookup customer
  useEffect(() => {
    if (phone.length !== 11) {
      setName('');
      setTotalMatches(0);
      setIsExistingCustomer(false);
      setCustomerInfo(null);
      return;
    }

    const fetchCustomer = async () => {
      const enPhone = toEn(phone);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`phone_number.eq.${phone},phone_number.eq.${enPhone}`)
        .limit(1);
        
      if (error) console.error("Error fetching customer:", error);
      
      if (data && data.length > 0) {
        setCustomerInfo(data[0]);
        setName(data[0].name);
        setTotalMatches(data[0].total_matches || 0);
        setIsExistingCustomer(true);
      } else {
        setCustomerInfo(null);
        setName('');
        setTotalMatches(0);
        setIsExistingCustomer(false);
      }
    };
    fetchCustomer();
  }, [phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPhoneError('');

    if (phone.length !== 11 || (!phone.startsWith('০১') && !phone.startsWith('01'))) {
      setPhoneError('মোবাইল নাম্বার সঠিক নয় (১১ ডিজিট হতে হবে)');
      return;
    }

    if (parsedDiscount > maxDiscount) {
      setErrorMsg(`সর্বোচ্চ ছাড়ের সীমা ৳${toBn(maxDiscount)}!`);
      return;
    }

    const parsedAdvance = parseInt(advance) || 0;
    if (settings?.force_advance_payment && parsedAdvance <= 0) {
      setErrorMsg('এই বুকিংয়ের জন্য অগ্রিম পেমেন্ট বাধ্যতামূলক!');
      return;
    }
    
    if (parsedAdvance > 0 && advanceMethod !== 'Cash' && advanceTrxId.length !== 4) {
      setErrorMsg('বিকাশ/নগদ এর ক্ষেত্রে নাম্বার এর শেষ ৪ ডিজিট দেওয়া বাধ্যতামূলক।');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const finalName = name.trim() || 'অজানা গ্রাহক';
      
      // Call create-booking Edge Function
      const { data, error } = await supabase.functions.invoke('create-booking', {
        headers: {
          'x-session-token': localStorage.getItem('session_token') || ''
        },
        body: {
          date: selectedDate,
          start_time: initialSlot.startTime,
          hours,
          phone,
          name: finalName,
          discount: parsedDiscount,
          advance: parsedAdvance,
          advanceMethod,
          advanceTrxId
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'বুকিং তৈরি করা যায়নি');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Booking Error:', err);
      setErrorMsg(err.message || 'বুকিং সম্পন্ন করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-orange to-brand-amber p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock size={20} /> নতুন বুকিং
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-8">
          
          <div className="flex justify-between items-center bg-orange-50 px-3 py-2 rounded-xl text-brand-orange font-bold text-sm border border-orange-100">
            <span>স্লট: {initialSlot.timeLabel}</span>
            <span>{initialSlot.isPrime ? '(প্রাইম)' : '(রেগুলার)'}</span>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">মোবাইল নাম্বার</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-orange" size={18} />
                <input 
                  type="tel" required placeholder="০১XXXXXXXXX"
                  value={phone} onChange={handlePhoneChange} maxLength={11}
                  className={`w-full pl-10 pr-3 py-3 bg-gray-50 border-2 ${
                    phone.length === 11 
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500' 
                      : phone.length > 0 
                        ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                        : 'border-gray-200 focus:ring-brand-orange focus:border-brand-orange'
                  } rounded-xl outline-none transition-all font-semibold`}
                />
              </div>
              {phoneError && <p className="text-xs text-red-500 font-bold mt-1">{phoneError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">গ্রাহকের নাম (ঐচ্ছিক)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-orange" size={18} />
                <input 
                  type="text" placeholder="নাম লিখুন"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className={`w-full pl-10 pr-10 py-3 bg-gray-50 border ${customerInfo ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-brand-orange outline-none transition-all font-semibold`}
                />
                {customerInfo && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />}
              </div>
              {phone.length === 11 && (
                isExistingCustomer ? (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    ✓ পুরাতন গ্রাহক (মোট ম্যাচ: {toBn(totalMatches)})
                  </p>
                ) : (
                  <p className="text-xs text-blue-500 font-semibold mt-1">
                    নতুন গ্রাহক (New Customer)
                  </p>
                )
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Pricing Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">কত ঘণ্টা?</label>
              <select 
                value={hours} onChange={(e) => setHours(Number(e.target.value))}
                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-semibold"
              >
                {[1, 2, 3].map(h => (
                  <option key={h} value={h}>{toBn(h)} ঘণ্টা</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">ছাড় (৳)</label>
              <input 
                type="number" placeholder="0" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                value={discount} onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-semibold"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-200 text-sm font-semibold">
            <div className="flex justify-between text-gray-600">
              <span>ভাড়া (বেস):</span>
              <span>৳{toBn(basePrice)}</span>
            </div>
            <div className="flex justify-between text-gray-800 text-lg border-b border-gray-200 pb-2">
              <span>মোট বিল:</span>
              <span>৳{toBn(netAmount)}</span>
            </div>

            <div className="pt-2">
              <label className="block text-sm text-gray-500 mb-1">অগ্রিম জমা</label>
              <input 
                type="number" required={settings?.force_advance_payment} placeholder="৳ 0" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                value={advance} onChange={(e) => setAdvance(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-brand-orange rounded-xl focus:ring-2 focus:ring-brand-orange outline-none text-xl font-bold text-brand-orange text-center shadow-sm"
              />
            </div>

            {(parseInt(advance) || 0) > 0 && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">পেমেন্ট মেথড</label>
                  <div className="flex gap-2">
                    {['Cash', 'bKash', 'Nagad'].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => { setAdvanceMethod(method as any); setAdvanceTrxId(''); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg border-2 transition-all ${
                          advanceMethod === method 
                            ? 'border-brand-orange bg-orange-50 text-brand-orange' 
                            : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        {method === 'Cash' ? 'ক্যাশ' : method === 'bKash' ? 'বিকাশ' : 'নগদ'}
                      </button>
                    ))}
                  </div>
                </div>

                {advanceMethod !== 'Cash' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">TrxID (শেষ ৪ ডিজিট)</label>
                    <input 
                      type="tel" required placeholder="XXXX"
                      value={advanceTrxId} onChange={handleTrxIdChange} maxLength={4}
                      className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-brand-orange outline-none text-center font-bold tracking-widest ${
                        advanceTrxId.length === 4 ? 'border-green-500' : 'border-red-400'
                      }`}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center text-red-500 pt-2 text-lg">
              <span>বকেয়া:</span>
              <span>৳{toBn(dueAmount)}</span>
            </div>
          </div>

          {errorMsg && <p className="text-red-500 text-sm font-bold text-center">{errorMsg}</p>}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 mt-2 text-white font-bold text-lg rounded-2xl bg-gradient-to-r from-brand-orange to-brand-amber active:scale-95 transition-transform shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'প্রসেসিং...' : <><CheckCircle2 size={24} /> নিশ্চিত করুন</>}
          </button>

        </form>
      </div>
    </div>
  );
};
