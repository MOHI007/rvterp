import React from 'react';
import { MessageCircle } from 'lucide-react';
import { type Booking, type Slot } from '../types';

interface Props {
  booking: Booking;
  slot: Slot;
}

export const WhatsAppButton: React.FC<Props> = ({ booking, slot }) => {
  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  
  const handleSend = () => {
    const text = `আপনার বুকিং নিশ্চিত হয়েছে।\nটার্ফ: সুপার টার্ফ এরিনা।\nতারিখ: ${new Date(booking.date).toLocaleDateString('bn-BD')}, সময়: ${slot.timeLabel}।\nঅগ্রিম: ৳${toBn(booking.advance_paid)}, বাকি: ৳${toBn(booking.due_amount)}।`;
    
    // Format phone: ensure +880 prefix
    let phone = booking.customer_phone;
    if (phone.startsWith('0')) {
      phone = '88' + phone;
    }
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <button 
      onClick={handleSend}
      className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold transition-transform active:scale-95 flex justify-center items-center gap-2 shadow-sm"
    >
      <MessageCircle size={20} /> হোয়াটসঅ্যাপে রশিদ
    </button>
  );
};
