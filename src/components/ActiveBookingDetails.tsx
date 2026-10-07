import React, { useState } from 'react';
import { X, Clock, User, Phone, Play, Square, AlertCircle, CheckCircle2, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { type Booking, type Slot } from '../types';
import { PaymentModal } from './PaymentModal';
import { Receipt } from './Receipt';
import { MessageButtons } from './MessageButtons';

interface Props {
  booking: Booking;
  slot: Slot;
  duration?: number;
  onClose: () => void;
  onRefresh: () => void;
}

export const ActiveBookingDetails: React.FC<Props> = ({ booking, slot, duration = 1, onClose, onRefresh }) => {
  const [showPayment, setShowPayment] = useState(false);
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  const [checkoutNote, setCheckoutNote] = useState(booking.note || '');

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const handleTimeUpdate = async (type: 'actual_check_in' | 'actual_check_out') => {
    setIsUpdatingTime(true);
    
    // Get current time in HH:mm:ss format (Local Time)
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    try {
      const payload: any = { 
        [type]: timeStr, 
        status: type === 'actual_check_out' ? 'completed' : 'confirmed' 
      };

      if (type === 'actual_check_out') {
        payload.note = checkoutNote;
      }

      const { data, error } = await supabase.functions.invoke('update-booking-time', {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        body: { booking_id: booking.id, ...payload }
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message);
      onRefresh();
    } catch (err: any) {
      console.error('Time update failed:', err);
      alert(err.message || 'সময় আপডেট করা যায়নি।');
    } finally {
      setIsUpdatingTime(false);
    }
  };

  const formatTimeStr = (t?: string) => {
    if (!t) return '--:--';
    const [h, m] = t.split(':');
    let hour = parseInt(h);
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${period}`;
  };

  const handleCancelAndCredit = async () => {
    if (!window.confirm("আপনি কি নিশ্চিত যে বুকিং বাতিল করে অগ্রিম টাকা গ্রাহকের ক্রেডিটে জমা করতে চান?")) return;
    
    setIsUpdatingTime(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-booking', {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        body: { booking_id: booking.id }
      });

      if (error || !data?.success) throw new Error(data?.error || error?.message);

      alert("বুকিং বাতিল এবং ক্রেডিট সেভ সফল হয়েছে!");
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'বাতিল করতে সমস্যা হয়েছে।');
    } finally {
      setIsUpdatingTime(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isInPlay = booking.actual_check_in && !booking.actual_check_out;
  const isCompleted = booking.actual_check_in && booking.actual_check_out;

  const basePrice = (booking.total_price || 0) + (booking.discount || 0);
  const methodT = { cash: 'ক্যাশ', bkash: 'বিকাশ', nagad: 'নগদ' };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
        <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300 no-print">
          
          <div className={`p-4 text-white flex justify-between items-center transition-colors ${isInPlay ? 'bg-green-600' : isCompleted ? 'bg-gray-800' : 'bg-gradient-to-r from-brand-orange to-brand-amber'}`}>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock size={20} /> 
              {isInPlay ? 'চলমান ম্যাচ' : isCompleted ? 'ম্যাচ সম্পন্ন' : 'বুকিং বিস্তারিত'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-5 space-y-6 max-h-[85vh] overflow-y-auto">
            
            {/* Customer Info */}
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-center gap-4">
              <div className="bg-brand-orange/10 p-3 rounded-full text-brand-orange shrink-0">
                <User size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">{booking.customers?.name || 'গ্রাহক'}</h3>
                <p className="text-gray-500 font-medium flex items-center gap-1 text-sm mt-0.5">
                  <Phone size={14} /> {booking.customer_phone}
                </p>
              </div>
            </div>

            {/* Timing Section */}
            <div>
              <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-brand-orange"/> সময় ট্র্যাকিং
              </h4>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-2xl text-center">
                  <p className="text-xs text-gray-500 font-bold mb-1">নির্ধারিত সময়</p>
                  <p className="text-sm font-bold text-gray-800">
                    {(() => {
                      if (duration <= 1) return slot.timeLabel;
                      // Calculate the end time based on start_time + duration
                      const [startHStr, startMStr] = slot.startTime.split(':');
                      let startH = parseInt(startHStr);
                      const endH = (startH + duration) % 24;
                      
                      const formatH = (h: number) => {
                        const period = h >= 12 ? 'PM' : 'AM';
                        let hr = h % 12 || 12;
                        return `${toBn(hr)}:${toBn(startMStr)} ${period}`;
                      };
                      return `${formatH(startH)} - ${formatH(endH)}`;
                    })()}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-2xl text-center">
                  <p className="text-xs text-gray-500 font-bold mb-1">তারিখ</p>
                  <p className="text-sm font-bold text-gray-800">{new Date(booking.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  disabled={!!booking.actual_check_in || isUpdatingTime}
                  onClick={() => handleTimeUpdate('actual_check_in')}
                  className={`flex-1 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all border ${
                    booking.actual_check_in 
                      ? 'bg-green-50 border-green-200 text-green-700 opacity-100' 
                      : 'bg-white border-gray-200 text-gray-700 hover:border-green-500 hover:text-green-600 shadow-sm active:scale-95'
                  }`}
                >
                  <Play size={20} className={booking.actual_check_in ? 'text-green-500' : ''} />
                  <span>{booking.actual_check_in ? formatTimeStr(booking.actual_check_in) : isUpdatingTime ? 'অপেক্ষা করুন...' : 'চেক-ইন'}</span>
                </button>

                <button 
                  disabled={!booking.actual_check_in || !!booking.actual_check_out || isUpdatingTime}
                  onClick={() => handleTimeUpdate('actual_check_out')}
                  className={`flex-1 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all border ${
                    booking.actual_check_out 
                      ? 'bg-red-50 border-red-200 text-red-700 opacity-100' 
                      : !booking.actual_check_in 
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-red-500 hover:text-red-600 shadow-sm active:scale-95'
                  }`}
                >
                  <Square size={20} className={booking.actual_check_out ? 'text-red-500' : ''} />
                  <span>{booking.actual_check_out ? formatTimeStr(booking.actual_check_out) : isUpdatingTime ? 'অপেক্ষা করুন...' : 'চেক-আউট'}</span>
                </button>
              </div>

              {(!booking.actual_check_out && booking.actual_check_in) && (
                <div className="mt-4 animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">মন্তব্য (ঐচ্ছিক)</label>
                  <input 
                    type="text" 
                    placeholder="ওভারটাইম বা অন্য কোনো কারণ..."
                    value={checkoutNote} 
                    onChange={(e) => setCheckoutNote(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-medium text-sm transition-all"
                  />
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Financials Section */}
            <div>
              <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-brand-orange"/> বিল বিবরণী
              </h4>
              
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-sm font-semibold">
                {(booking.discount || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>মূল ভাড়া:</span>
                      <span>৳{toBn(basePrice)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>ছাড়:</span>
                      <span>৳{toBn(booking.discount || 0)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>মোট বিল:</span>
                  <span>৳{toBn(booking.total_price)}</span>
                </div>
                <div className="flex justify-between text-gray-600 border-b border-gray-200 pb-2">
                  <span>অগ্রিম গ্রহণ:</span>
                  <span>
                    ৳{toBn(booking.advance_paid)} {booking.advance_paid > 0 && booking.payment_method ? `(${methodT[booking.payment_method as keyof typeof methodT] || booking.payment_method})` : ''}
                  </span>
                </div>

                {booking.due_amount > 0 ? (
                  <>
                    <div className="flex justify-between items-center text-red-500 pt-2 text-lg">
                      <span>বকেয়া:</span>
                      <span>৳{toBn(booking.due_amount)}</span>
                    </div>
                    <button 
                      onClick={() => setShowPayment(true)}
                      className="w-full mt-4 py-3 bg-gray-800 text-white rounded-xl font-bold active:scale-95 transition-transform"
                    >
                      বাকি গ্রহণ করুন
                    </button>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-green-600 pt-2 text-lg">
                    <span className="flex items-center gap-1"><CheckCircle2 size={20}/> সম্পূর্ণ পরিশোধিত</span>
                    <span>৳০</span>
                  </div>
                )}
              </div>
              
              <div className="mt-5 space-y-3">
                <MessageButtons booking={booking} slot={slot} />
                
                <button 
                  onClick={handleCancelAndCredit}
                  disabled={isUpdatingTime}
                  className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingTime ? 'অপেক্ষা করুন...' : 'বুকিং বাতিল ও ক্রেডিট সেভ'}
                </button>

                <button 
                  onClick={handlePrint}
                  className="w-full py-3 bg-gray-100 text-gray-800 border border-gray-200 rounded-xl font-bold active:scale-95 transition-transform flex justify-center items-center gap-2"
                >
                  <Printer size={18} /> রশিদ প্রিন্ট করুন
                </button>
              </div>
            </div>

          </div>
        </div>

        {showPayment && (
          <PaymentModal 
            booking={booking} 
            onClose={() => setShowPayment(false)} 
            onSuccess={() => {
              setShowPayment(false);
              onRefresh(); // Refresh parent to get updated due amount
            }} 
          />
        )}
      </div>

      {/* Hidden Thermal Receipt component */}
      <Receipt booking={booking} duration={duration} />
    </>
  );
};
