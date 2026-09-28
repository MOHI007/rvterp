import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { activeShiftId, settings, user } = useAuth();
  
  const defaultCats = ['মেইনটেন্যান্স', 'ইউটিলিটি', 'বিবিধ'];
  const categories = (settings?.expense_categories && settings.expense_categories.length > 0) ? settings.expense_categories : defaultCats;
  
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShiftId && user?.role !== 'admin') {
      alert('কোনো সক্রিয় শিফট পাওয়া যায়নি।');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        shift_id: activeShiftId || null,
        amount: parseInt(amount) || 0,
        category,
        note
      });
      if (error) throw error;
      
      if (settings?.print_expense_voucher) {
        window.print();
        setTimeout(() => onSuccess(), 2000);
      } else {
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      alert('খরচ এন্ট্রি করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 no-print">
        
        <div className="bg-brand-orange p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Receipt size={20} /> খরচ এন্ট্রি
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">পরিমাণ (৳)</label>
            <input 
              type="number" required placeholder="0" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()}
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ক্যাটাগরি</label>
            <select 
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-semibold"
            >
              {categories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">বিবরণ</label>
            <textarea 
              rows={2} required placeholder="খরচের কারণ লিখুন..."
              value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-medium text-sm resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 text-white font-bold text-lg rounded-2xl bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'প্রসেসিং...' : <><CheckCircle2 size={20} /> এন্ট্রি করুন</>}
          </button>
        </form>
      </div>

      {/* Hidden Thermal Expense Voucher - Portaled to Body */}
      {createPortal(
        <div className="print-receipt-container hidden text-black text-sm pb-2 pt-1 font-sans">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold tracking-wider leading-tight">রিভার ভিউ টার্ফ</h1>
            <p className="font-bold text-xs mt-2 border border-black inline-block px-2 py-0.5 rounded">খরচের ভাউচার</p>
          </div>
          
          <div className="space-y-1 text-xs mb-3 font-semibold">
            <p><strong>তারিখ:</strong> {new Date().toLocaleDateString('bn-BD')}</p>
            <p><strong>সময়:</strong> {new Date().toLocaleTimeString('bn-BD')}</p>
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-black py-2 mb-3 space-y-1 text-xs font-semibold">
            <div className="flex justify-between text-gray-800">
              <span>ক্যাটাগরি:</span>
              <span>{category}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>বিবরণ:</span>
              <span className="text-right max-w-[60%]">{note}</span>
            </div>
            <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-black">
              <span>মোট খরচ:</span>
              <span>৳{toBn(amount || 0)}</span>
            </div>
          </div>
          
          <div className="mt-8 flex justify-between text-[10px] font-bold">
            <span className="border-t border-black pt-1 px-2">ম্যানেজার স্বাক্ষর</span>
            <span className="border-t border-black pt-1 px-2">কর্তৃপক্ষ স্বাক্ষর</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
