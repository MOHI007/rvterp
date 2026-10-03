import React, { useState, useEffect } from 'react';
import { getBusinessDateStr } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateDailySlots, type Slot, type Booking } from '../types';
import { SlotCard } from './SlotCard';
import { BookingModal } from './BookingModal';
import { ActiveBookingDetails } from './ActiveBookingDetails';
import { ExpenseModal } from './ExpenseModal';
import { ManagerPrintReport } from './ManagerPrintReport';
import { Calendar, ChevronLeft, ChevronRight, LogOut, Wallet, Printer } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logout, settings } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getBusinessDateStr());
  const slots = React.useMemo(() => generateDailySlots(settings || undefined), [settings]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [activeBooked, setActiveBooked] = useState<{ booking: Booking, slot: Slot, duration: number } | null>(null);
  const [showExpense, setShowExpense] = useState(false);
  
  // Force re-render every minute to keep past slots hiding dynamically
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchBookings = async () => {
    const { data, error } = await supabase.functions.invoke('get-day', {
      headers: {
        'x-session-token': localStorage.getItem('session_token') || ''
      },
      body: { date: selectedDate }
    });
      
    if (error) {
      console.error("Error fetching bookings:", error);
    } else if (data && data.success) {
      setBookings(data.bookings as Booking[]);
      
      if (activeBooked) {
        const updatedBooking = data.bookings.find((b: any) => b.id === activeBooked.booking.id);
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
    const [y, m, day] = selectedDate.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    d.setDate(d.getDate() + days);
    setSelectedDate(getBusinessDateStr(d));
  };

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const todayStr = getBusinessDateStr();
  
  // Time-Aware Slot Filtering Logic
  const getCurrentHourBDST = () => {
    // Current BDST time
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const bdTime = new Date(d.getTime() + offset + (6 * 3600000)); // offset local time to UTC, then add 6 hours for BD
    return bdTime.getHours();
  };

  const isToday = selectedDate === todayStr;
  const currentHour = getCurrentHourBDST();

  const isPastSlot = (startTimeStr: string) => {
    if (!isToday) return false;
    const slotHour = parseInt(startTimeStr.split(':')[0], 10);
    
    // Turf is open till 4 AM. So hours 0, 1, 2, 3 are technically "next day" but part of today's schedule.
    // If current time is early morning (e.g., 2 AM) and slot is 20:00 (8 PM), the 8 PM slot is definitely past.
    // Let's normalize hours relative to the 6 AM start time.
    const normalizedSlot = slotHour < 6 ? slotHour + 24 : slotHour;
    const normalizedCurrent = currentHour < 6 ? currentHour + 24 : currentHour;
    
    return normalizedSlot < normalizedCurrent;
  };

  const visibleSlots = slots.filter(slot => {
    const isBooked = bookings.some(b => b.start_time === slot.startTime);
    if (isToday && isPastSlot(slot.startTime) && !isBooked) {
      return false; // Hide empty past slots
    }
    return true;
  });

  const getSlotBookingInfo = (slot: Slot) => {
    const booking = bookings.find(b => b.start_time === slot.startTime);
    if (!booking) return null;
    
    const groupId = booking.booking_group_id || booking.id;
    const groupBookings = bookings.filter(b => (b.booking_group_id || b.id) === groupId).sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    const isPrimary = groupBookings[0].id === booking.id;
    const primaryBooking = groupBookings[0];
    const duration = groupBookings.length;
    
    return { booking, isPrimary, primaryBooking, duration };
  };

  const unbookedPrimeSlots = visibleSlots.filter(
    s => s.isPrime && !bookings.some(b => b.start_time === s.startTime)
  ).length;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans pb-10">
      <header className="bg-gradient-to-r from-brand-orange to-brand-amber text-white p-4 rounded-b-[2rem] shadow-md sticky top-0 z-10 no-print">
        <div className="flex justify-between items-center mb-5 w-full">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold tracking-wide">রিভার ভিউ টার্ফ</h1>
            <p className="text-sm font-medium opacity-90">{user?.role === 'admin' ? 'অ্যাডমিন' : 'ম্যানেজার'}</p>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Expense Button */}
            <button 
              onClick={() => setShowExpense(true)}
              title="খরচ যোগ করুন"
              className="w-10 h-10 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full shadow-sm backdrop-blur-sm transition-all flex items-center justify-center"
            >
              <Wallet size={20} />
            </button>

            {/* Print Button (Manager Daily Print) */}
            <button 
              onClick={() => window.print()}
              title="আজকের হিসাব প্রিন্ট করুন"
              className="w-10 h-10 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full shadow-sm backdrop-blur-sm transition-all flex items-center justify-center"
            >
              <Printer size={20} />
            </button>

            {/* Logout Button */}
            <button 
              onClick={logout}
              title="লগআউট"
              className="w-10 h-10 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full shadow-sm backdrop-blur-sm transition-all flex items-center justify-center"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-white text-gray-800 p-1.5 rounded-2xl shadow-sm">
          <button onClick={() => changeDate(-1)} className="p-3 active:bg-gray-100 rounded-xl text-gray-500 transition-colors"><ChevronLeft size={22}/></button>
          <div className="font-bold flex items-center gap-2 text-brand-orange text-[15px]">
            <Calendar size={18} />
            {(() => {
              const [y, m, day] = selectedDate.split('-');
              const d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
              return d.toLocaleDateString('bn-BD', { weekday: 'long', month: 'long', day: 'numeric' });
            })()}
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
          {visibleSlots.map(slot => {
            const info = getSlotBookingInfo(slot);
            return (
              <SlotCard 
                key={slot.id} 
                slot={slot} 
                bookingInfo={info}
                onBook={(s) => setActiveSlot(s)}
                onViewBooking={(booking, s) => setActiveBooked({ booking, slot: s, duration: info?.duration || 1 })}
              />
            );
          })}
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
          duration={activeBooked.duration}
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

      <ManagerPrintReport date={todayStr} />

      <footer className="text-center py-4 text-xs text-gray-400 font-medium no-print mt-auto">
        Dev by Engr. A N M AL MUHI
      </footer>
    </div>
  );
};
