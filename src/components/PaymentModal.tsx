import React, { useState } from 'react';
import { X, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { type Booking } from '../types';

interface PaymentModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ booking, onClose, onSuccess }) => {
  const [method, setMethod] = useState<'Cash' | 'bKash' | 'Nagad'>('Cash');
  const [last4, setLast4] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((method === 'bKash' || method === 'Nagad') && last4.length !== 4) {
      setErrorMsg('অবশ্যই ট্রানজেকশনের শেষ ৪ ডিজিট দিতে হবে।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Log Payment
      const { error: paymentError } = await supabase.from('payments').insert({
        booking_id: booking.id,
        method,
        last_4_digits: method === 'Cash' ? null : last4,
        amount: booking.due_amount,
        type: 'Due'
      });

      if (paymentError) throw paymentError;

      // 2. Clear Due from Booking
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({ due_amount: 0 })
        .eq('id', booking.id);

      if (bookingUpdateError) throw bookingUpdateError;

      // 3. Increment Customer total_matches since the booking is now fully paid
      if (booking.customer_phone) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('total_matches')
          .eq('phone_number', booking.customer_phone)
          .single();
          
        if (customerData) {
          await supabase
            .from('customers')
            .update({ total_matches: (customerData.total_matches || 0) + 1 })
            .eq('phone_number', booking.customer_phone);
        }
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg('পেমেন্ট সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DollarSign size={20} /> বাকি গ্রহণ
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          
          <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-500 font-semibold mb-1">মোট বকেয়া পরিমাণ</p>
            <p className="text-3xl font-bold text-red-600">৳{toBn(booking.due_amount)}</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-600">পেমেন্ট মাধ্যম</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                type="button" 
                onClick={() => { setMethod('Cash'); setLast4(''); setErrorMsg(''); }}
                className={`py-3 rounded-xl border font-bold text-sm transition-all ${method === 'Cash' ? 'bg-brand-orange text-white border-brand-orange shadow-md' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
              >
                ক্যাশ
              </button>
              <button 
                type="button" 
                onClick={() => { setMethod('bKash'); setErrorMsg(''); }}
                className={`py-3 rounded-xl border font-bold text-sm transition-all ${method === 'bKash' ? 'bg-pink-500 text-white border-pink-500 shadow-md' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
              >
                বিকাশ
              </button>
              <button 
                type="button" 
                onClick={() => { setMethod('Nagad'); setErrorMsg(''); }}
                className={`py-3 rounded-xl border font-bold text-sm transition-all ${method === 'Nagad' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
              >
                নগদ
              </button>
            </div>
          </div>

          {(method === 'bKash' || method === 'Nagad') && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">ট্রানজেকশনের শেষ ৪ ডিজিট (TrxID)</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  maxLength={4} 
                  required
                  placeholder="যেমন: 4A21"
                  value={last4} 
                  onChange={(e) => setLast4(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-bold tracking-widest text-lg"
                />
              </div>
            </div>
          )}

          {errorMsg && <p className="text-red-500 text-sm font-bold text-center">{errorMsg}</p>}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 text-white font-bold text-lg rounded-2xl bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'প্রসেসিং...' : <><CheckCircle2 size={20} /> পেমেন্ট সম্পূর্ণ করুন</>}
          </button>
        </form>
      </div>
    </div>
  );
};
