import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { type Booking } from '../types';

interface ReceiptProps {
  booking: Booking;
  duration?: number;
}

export const Receipt: React.FC<ReceiptProps> = ({ booking, duration = 1 }) => {
  const { settings } = useAuth();
  const [dueCollected, setDueCollected] = useState(0);

  useEffect(() => {
    const fetchDuePayments = async () => {
      const { data } = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', booking.id)
        .eq('type', 'Due');
      
      let sum = 0;
      data?.forEach(p => sum += p.amount);
      setDueCollected(sum);
    };
    fetchDuePayments();
  }, [booking.id]);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const netTotal = booking.total_price - booking.discount;

  const ReceiptBlock = ({ title }: { title: string }) => (
    <div className="text-black text-sm pb-2 pt-1 font-sans">
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold tracking-wider leading-tight">রিভার ভিউ টার্ফ</h1>
        <p className="text-[11px] leading-snug font-semibold mt-1">মাতামুহুরি ব্রিজ সংলগ্ন, চকরিয়া, কক্সবাজার।</p>
        <p className="text-[11px] leading-snug font-bold mt-0.5">মোবাইল: ০১৮২৩৫০৫০৮০</p>
        <p className="font-bold text-xs mt-1 border border-black inline-block px-2 py-0.5 rounded">{title}</p>
      </div>

      <div className="space-y-0.5 text-xs mb-2 mt-3">
        <p><strong>তারিখ:</strong> {new Date(booking.date).toLocaleDateString('bn-BD')}</p>
        <p><strong>সময়:</strong> {(() => {
          const [startHStr, startMStr] = booking.start_time.split(':');
          let startH = parseInt(startHStr);
          const endH = (startH + duration) % 24;
          
          const formatH = (h: number) => {
            const period = h >= 12 ? 'PM' : 'AM';
            let hr = h % 12 || 12;
            return `${toBn(hr)}:${toBn(startMStr)} ${period}`;
          };
          return `${formatH(startH)} - ${formatH(endH)}`;
        })()}</p>
        <p><strong>বুকিং আইডি:</strong> #{booking.receipt_id || booking.id.slice(0, 6).toUpperCase()}</p>
        <p><strong>গ্রাহক:</strong> {booking.customers?.name || 'অজানা গ্রাহক'}</p>
        <p><strong>ফোন:</strong> {toBn(booking.customer_phone)}</p>
      </div>

      <div className="border-t-2 border-b-2 border-dashed border-black py-1.5 mb-2 space-y-0.5 text-xs font-semibold">
        <div className="flex justify-between">
          <span>মোট বিল:</span>
          <span>৳{toBn(booking.total_price)}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>ছাড়:</span>
          <span>- ৳{toBn(booking.discount)}</span>
        </div>
        <div className="flex justify-between border-t border-dashed border-gray-400 pt-0.5 mt-0.5">
          <span>সর্বমোট:</span>
          <span>৳{toBn(netTotal)}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>অগ্রিম:</span>
          <span>- ৳{toBn(booking.advance_paid)}</span>
        </div>
        {dueCollected > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>বকেয়া আদায়:</span>
            <span>- ৳{toBn(dueCollected)}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-bold mt-1 pt-1 border-t border-black">
          <span>বকেয়া:</span>
          <span>৳{toBn(booking.due_amount)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] space-y-1 mt-4">
        <p className="font-bold">*** ধন্যবাদ ***</p>
        <p className="whitespace-pre-wrap">{settings?.receipt_footer_text || 'দয়া করে টার্ফ শু পরিধান করুন।'}</p>
        <p className="pt-2 text-[9px] text-gray-500">Dev by Engr. A N M AL MUHI</p>
      </div>
    </div>
  );

  const receiptContent = (
    <div className="print-receipt-container hidden">
      <ReceiptBlock title="গ্রাহক কপি" />
      {settings?.print_office_copy !== false && (
        <>
          <div className="border-b-[3px] border-dashed border-black my-8"></div>
          <ReceiptBlock title="অফিস কপি" />
        </>
      )}
    </div>
  );

  return createPortal(receiptContent, document.body);
};
