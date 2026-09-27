import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateDailySlots, type Slot, type Booking } from '../types';
import { SlotCard } from './SlotCard';
import { BookingModal } from './BookingModal';
import { ActiveBookingDetails } from './ActiveBookingDetails';
import { ExpenseModal } from './ExpenseModal';
import { ShiftCloseModal } from './ShiftCloseModal';
import { Calendar, ChevronLeft, ChevronRight, LogOut, Wallet, Lock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logout, activeShiftId, settings } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const slots = React.useMemo(() => generateDailySlots(settings || undefined), [settings]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [activeBooked, setActiveBooked] = useState<{ booking: Booking, slot: Slot } | null>(null);
  const [showExpense, setShowExpense] = useState(false);
  const [showShiftClose, setShowShiftClose] = useState(false);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, customers(*)')
      .eq('date', selectedDate)
      .neq('status', 'cancelled');
      
    if (error) {
      console.error("Error fetching bookings:", error);
    } else if (data) {
      setBookings(data as Booking[]);
      
      if (activeBooked) {
        const updatedBooking = data.find(b => b.id === activeBooked.booking.id);
        if (updatedBooking) {
          setActiveBooked({ ...activeBooked, booking: updatedBooking as Booking });
        }
      }
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [selectedDate]);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const todayStr = new Date().toISOString().split('T')[0];
  const unbookedPrimeSlots = slots.filter(
    s => s.isPrime && !bookings.find(b => b.start_time === s.startTime)
  ).length;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans pb-10">
      <header className="bg-gradient-to-r from-brand-orange to-brand-amber text-white p-4 rounded-b-[2rem] shadow-md sticky top-0 z-10 no-print">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">রিভার ভিউ টার্ফ</h1>
            <p className="text-sm font-medium opacity-90">{user?.name} (ম্যানেজার)</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowExpense(true)} 
              className="px-3 py-2 bg-white/20 rounded-xl active:bg-white/30 active:scale-95 transition-all text-sm font-bold flex items-center gap-1.5 shadow-sm backdrop-blur-md"
            >
              <Wallet size={16} /> খরচ
            </button>
            <button 
              onClick={() => {
                if (activeShiftId) setShowShiftClose(true);
                else logout();
              }} 
              className="px-3 py-2 bg-red-500/80 hover:bg-red-500 rounded-xl active:scale-95 transition-all text-sm font-bold flex items-center gap-1.5 shadow-sm backdrop-blur-md"
            >
              {activeShiftId ? <><Lock size={16} /> শিফট শেষ</> : <><LogOut size={16} /> লগআউট</>}
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-white text-gray-800 p-1.5 rounded-2xl shadow-sm">
          <button onClick={() => changeDate(-1)} className="p-3 active:bg-gray-100 rounded-xl text-gray-500 transition-colors"><ChevronLeft size={22}/></button>
          <div className="font-bold flex items-center gap-2 text-brand-orange text-[15px]">
            <Calendar size={18} />
            {new Date(selectedDate).toLocaleDateString('bn-BD', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <button onClick={() => changeDate(1)} className="p-3 active:bg-gray-100 rounded-xl text-gray-500 transition-colors"><ChevronRight size={22}/></button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5 mt-2 no-print">
        
        {unbookedPrimeSlots > 0 && selectedDate === todayStr && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mb-2">
            <span className="font-bold text-lg">⚠️ আজ রাতের {toBn(unbookedPrimeSlots)}টি প্রাইম স্লট এখনো খালি!</span>
          </div>
        )}

        <div className="flex justify-between items-end">
          <h2 className="font-bold text-gray-800 text-lg">সময়সূচী (স্লট)</h2>
          <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded-lg">মোট বুকিং: {toBn(bookings.length)}</span>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {slots.map(slot => (
            <SlotCard 
              key={slot.id} 
              slot={slot} 
              booking={bookings.find(b => b.start_time === slot.startTime)}
              onBook={(s) => setActiveSlot(s)}
              onViewBooking={(booking, slot) => setActiveBooked({ booking, slot })}
            />
          ))}
        </div>
      </main>

      {/* Modals */}
      {activeSlot && (
        <BookingModal 
          initialSlot={activeSlot} 
          selectedDate={selectedDate}
          onClose={() => setActiveSlot(null)}
          onSuccess={() => {
            setActiveSlot(null);
            fetchBookings();
          }}
        />
      )}

      {activeBooked && (
        <ActiveBookingDetails 
          booking={activeBooked.booking}
          slot={activeBooked.slot}
          onClose={() => setActiveBooked(null)}
          onRefresh={fetchBookings}
        />
      )}

      {showExpense && (
        <ExpenseModal 
          onClose={() => setShowExpense(false)} 
          onSuccess={() => {
            setShowExpense(false);
            alert('খরচ এন্ট্রি সফল হয়েছে!');
          }} 
        />
      )}

      {showShiftClose && (
        <ShiftCloseModal 
          onClose={() => setShowShiftClose(false)} 
        />
      )}
    </div>
  );
};
