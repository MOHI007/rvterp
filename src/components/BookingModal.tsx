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
  
  const [hours, setHours] = useState(1);
  const [discount, setDiscount] = useState('');
  const [advance, setAdvance] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const basePrice = initialSlot.price * hours;
  const parsedDiscount = parseInt(discount) || 0;
  const maxDiscount = hours * (settings?.max_discount_allowed || 100);
  
  const netAmount = basePrice - parsedDiscount;
  const dueAmount = Math.max(0, netAmount - (parseInt(advance) || 0));

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  // Auto-lookup customer
  useEffect(() => {
    if (phone.length >= 11) {
      const fetchCustomer = async () => {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('phone_number', phone)
          .single();
        
        if (data) {
          setCustomerInfo(data);
          setName(data.name);
        } else {
          setCustomerInfo(null);
        }
      };
      fetchCustomer();
    }
  }, [phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPhoneError('');

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setPhoneError('মোবাইল নাম্বার সঠিক নয় (১১ ডিজিট হতে হবে)');
      return;
    }

    if (parsedDiscount > maxDiscount) {
      setErrorMsg(`সর্বোচ্চ ছাড়ের সীমা ৳${toBn(maxDiscount)}!`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const finalName = name.trim() || 'অজানা গ্রাহক';
      
      // 1. Upsert Customer
      await supabase.from('customers').upsert({
        phone_number: phone,
        name: finalName,
      }, { onConflict: 'phone_number' });

      // 2. Insert Booking (ignoring end time calculation accuracy for this phase)
      const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
        date: selectedDate,
        start_time: initialSlot.startTime,
        end_time: initialSlot.endTime, 
        customer_phone: phone,
        total_price: basePrice,
        discount: parsedDiscount,
        advance_paid: parseInt(advance) || 0,
        due_amount: dueAmount,
        status: 'confirmed'
      }).select().single();

      if (bookingError) throw bookingError;

      // 3. Insert Advance Payment
      if ((parseInt(advance) || 0) > 0 && booking) {
        await supabase.from('payments').insert({
          booking_id: booking.id,
          method: 'Cash', // Default
          amount: parseInt(advance),
          type: 'Advance'
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Booking Error:', err);
      setErrorMsg('বুকিং সম্পন্ন করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।');
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
                  type="tel" required placeholder="01XXXXXXXXX"
                  value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                  className={`w-full pl-10 pr-3 py-3 bg-gray-50 border ${phoneError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand-orange'} rounded-xl focus:ring-2 outline-none transition-all font-semibold`}
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
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none transition-all font-semibold"
                />
              </div>
              {customerInfo && (
                <p className="text-xs text-green-600 font-semibold mt-1">
                  ✓ পুরাতন গ্রাহক (মোট ম্যাচ: {toBn(customerInfo.total_matches)})
                </p>
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
                type="number" placeholder="0"
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
              <span>৳{toBn(totalAmount)}</span>
            </div>

            <div className="pt-2">
              <label className="block text-sm text-gray-500 mb-1">অগ্রিম জমা (ক্যাশ)</label>
              <input 
                type="number" required placeholder="৳ 0"
                value={advance} onChange={(e) => setAdvance(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-brand-orange rounded-xl focus:ring-2 focus:ring-brand-orange outline-none text-xl font-bold text-brand-orange text-center shadow-sm"
              />
            </div>

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
