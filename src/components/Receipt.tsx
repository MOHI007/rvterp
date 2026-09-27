import React from 'react';
import { type Booking } from '../types';

interface ReceiptProps {
  booking: Booking;
}

export const Receipt: React.FC<ReceiptProps> = ({ booking }) => {
  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const ReceiptBlock = ({ title }: { title: string }) => (
    <div className="text-black text-sm pb-2 pt-1 font-sans">
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold tracking-wider leading-tight">রিভার ভিউ টার্ফ</h1>
        <p className="text-[11px] leading-snug font-semibold mt-1">মাতামুহুরি ব্রিজ সংলগ্ন, চকরিয়া, কক্সবাজার।</p>
        <p className="text-[11px] leading-snug font-bold mt-0.5">মোবাইল: ০১৮২৩৫০৫০৮০</p>
        <p className="font-bold text-xs mt-1 border border-black inline-block px-2 py-0.5 rounded">{title}</p>
      </div>

      <div className="space-y-0.5 text-xs mb-2">
        <p><strong>তারিখ:</strong> {new Date(booking.date).toLocaleDateString('bn-BD')}</p>
        <p><strong>বুকিং আইডি:</strong> #{booking.id.slice(0, 6).toUpperCase()}</p>
        <p><strong>গ্রাহক:</strong> {booking.customers?.name}</p>
        <p><strong>ফোন:</strong> {toBn(booking.customer_phone)}</p>
      </div>

      <div className="border-t-2 border-b-2 border-dashed border-black py-1.5 mb-2 space-y-0.5 text-xs font-semibold">
        <div className="flex justify-between">
          <span>মোট বিল:</span>
          <span>৳{toBn(booking.total_price)}</span>
        </div>
        <div className="flex justify-between">
          <span>ছাড়:</span>
          <span>৳{toBn(booking.discount)}</span>
        </div>
        <div className="flex justify-between">
          <span>অগ্রিম:</span>
          <span>৳{toBn(booking.advance_paid)}</span>
        </div>
        <div className="flex justify-between text-[14px] font-bold mt-1 pt-1 border-t border-black">
          <span>বকেয়া:</span>
          <span>৳{toBn(booking.due_amount)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] space-y-1">
        <p className="font-bold">*** ধন্যবাদ ***</p>
        <p>দয়া করে টার্ফ শু পরিধান করুন।</p>
      </div>
    </div>
  );

  return (
    <div className="print-receipt-container hidden">
      <ReceiptBlock title="গ্রাহক কপি" />
      <div className="border-b-2 border-dashed border-black my-2"></div>
      <ReceiptBlock title="অফিস কপি" />
    </div>
  );
};
