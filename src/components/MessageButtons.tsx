import React from 'react';
import { MessageCircle, MessageSquare } from 'lucide-react';
import { type Booking, type Slot } from '../types';

interface Props {
  booking: Booking;
  slot: Slot;
}

export const MessageButtons: React.FC<Props> = ({ booking, slot }) => {
  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  const toEn = (str: string) => str.replace(/[০-৯]/g, d => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);
  
  const text = `আপনার বুকিং নিশ্চিত হয়েছে।\nটার্ফ: রিভার ভিউ টার্ফ।\nতারিখ: ${new Date(booking.date).toLocaleDateString('bn-BD')}, সময়: ${slot.timeLabel}।\nঅগ্রিম: ৳${toBn(booking.advance_paid)}, বাকি: ৳${toBn(booking.due_amount)}।\nযোগাযোগ: ০১৮২৩৫০৫০৮০`;

  const handleWhatsApp = () => {
    let phone = toEn(booking.customer_phone);
    if (phone.startsWith('0') || phone.startsWith('০')) {
      phone = '88' + phone;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSMS = () => {
    let phone = toEn(booking.customer_phone);
    const url = `sms:${phone}?body=${encodeURIComponent(text)}`;
    window.open(url, '_self');
  };

  return (
    <div className="flex gap-2 w-full">
      <button 
        onClick={handleWhatsApp}
        title="Send WhatsApp"
        className="flex-1 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold transition-transform active:scale-95 flex justify-center items-center shadow-sm"
      >
        <MessageCircle size={24} />
      </button>
      <button 
        onClick={handleSMS}
        title="Send SMS"
        className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-transform active:scale-95 flex justify-center items-center shadow-sm"
      >
        <MessageSquare size={24} />
      </button>
    </div>
  );
};
