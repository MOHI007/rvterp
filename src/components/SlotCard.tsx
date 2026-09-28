import React from 'react';
import { Plus, User, Clock, Info } from 'lucide-react';
import { type Slot, type Booking } from '../types';

interface SlotCardProps {
  slot: Slot;
  booking?: Booking;
  onBook: (slot: Slot) => void;
  onViewBooking?: (booking: Booking, slot: Slot) => void;
}

export const SlotCard: React.FC<SlotCardProps> = ({ slot, booking, onBook, onViewBooking }) => {
  
  const toBn = (num: number | string) => 
    num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  // Determine State
  let state: 'খালি' | 'বুকড' = 'খালি';
  
  if (booking) {
    state = 'বুকড';
  }

  if (state === 'বুকড' && booking) {
    // If we have actual check in/out times, it's "চলমান" (In-play) or "সম্পন্ন" (Completed)
    const isInPlay = booking.actual_check_in && !booking.actual_check_out;
    const bgClass = isInPlay ? 'bg-[#1F2937] text-white border-none' : 'bg-[#FF6B00] text-white border-none';

    return (
      <button 
        onClick={() => onViewBooking && onViewBooking(booking, slot)}
        className={`w-full text-left rounded-2xl p-4 shadow-md relative overflow-hidden active:scale-[0.98] transition-transform ${bgClass}`}
      >
        <div className="absolute top-0 right-0 bg-white/20 px-3 py-1 rounded-bl-xl text-xs font-bold backdrop-blur-sm shadow-sm flex items-center gap-1.5">
          {isInPlay && <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />}
          {isInPlay ? 'চলমান' : 'বুকড'}
        </div>
        
        <div className="flex justify-between items-start mb-3">
          <span className="font-bold text-sm tracking-wide bg-black/15 border border-white/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Clock size={14} /> {slot.timeLabel}
          </span>
        </div>
        
        <div className="space-y-1">
          <p className="font-semibold text-lg flex items-center gap-2">
            <User size={18} /> {booking.customers?.name || 'গ্রাহক'}
          </p>
          <p className="text-white/80 text-sm font-medium">{booking.customer_phone}</p>
        </div>
        
        <div className="mt-4 pt-3 border-t border-white/20 flex justify-between items-center text-sm font-medium">
          <span>অগ্রিম: ৳{toBn(booking.advance_paid)}</span>
          {booking.due_amount > 0 ? (
            <span className="bg-red-500 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm">
              বকেয়া: ৳{toBn(booking.due_amount)}
            </span>
          ) : (
            <span className="text-green-200 font-bold flex items-center gap-1">
              ✓ পেইড
            </span>
          )}
        </div>
        
        <div className="absolute bottom-4 right-4 bg-white/20 p-1.5 rounded-full z-10">
            <Info size={18} />
        </div>

        {/* Premium Watermark Stamp */}
        {booking.booked_by_role && (
          <div className="absolute top-10 -right-4 -rotate-12 pointer-events-none opacity-[0.15] z-0">
            <span className="border-4 border-white px-3 py-1 rounded-xl text-2xl font-black uppercase tracking-wider text-white">
              {booking.booked_by_role === 'admin' ? 'মালিক দ্বারা' : 'ম্যানেজার'}
            </span>
          </div>
        )}
      </button>
    );
  }

  // Available State
  const emptyClass = slot.isPrime 
    ? 'border-2 border-red-500 shadow-sm' 
    : 'border-2 border-green-200 shadow-sm';

  return (
    <button 
      onClick={() => onBook(slot)}
      className={`w-full bg-white text-gray-800 rounded-2xl p-4 text-left active:scale-[0.98] transition-all hover:border-brand-orange flex flex-col justify-between ${emptyClass}`}
    >
      <div className="flex justify-between items-center mb-3 w-full">
        <span className="font-bold text-gray-800 text-sm bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
          <Clock size={14} className="text-gray-400" /> {slot.timeLabel}
        </span>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
          খালি
        </span>
      </div>
      
      <div className="flex justify-between items-end w-full">
        <div>
          <span className="text-xl font-bold text-gray-800">৳{toBn(slot.price)}</span>
          <span className="text-xs text-gray-500 ml-1">/ ঘণ্টা</span>
        </div>
        
        <div className="bg-brand-orange/10 text-brand-orange p-2 rounded-xl flex items-center gap-1 font-bold text-sm">
          <Plus size={16} /> বুক
        </div>
      </div>
    </button>
  );
};
