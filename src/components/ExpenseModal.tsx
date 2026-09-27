import React, { useState } from 'react';
import { X, Receipt, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const ExpenseModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { activeShiftId } = useAuth();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Maintenance');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShiftId) {
      alert('কোনো সক্রিয় শিফট পাওয়া যায়নি।');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        shift_id: activeShiftId,
        amount: parseInt(amount) || 0,
        category,
        note
      });
      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('খরচ এন্ট্রি করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
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
              type="number" required placeholder="0"
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
              <option value="Maintenance">মেইনটেন্যান্স (পরিষ্কার/মেরামত)</option>
              <option value="Utility">ইউটিলিটি (পানি/বিদ্যুৎ)</option>
              <option value="Miscellaneous">বিবিধ (অন্যান্য)</option>
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
    </div>
  );
};
