import React, { useState } from 'react';
import { X, TrendingUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/dateUtils';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  incomeToEdit?: any;
}

export const IncomeModal: React.FC<Props> = ({ onClose, onSuccess, incomeToEdit }) => {
  const { settings } = useAuth();
  
  const defaultCats = ['পুরাতন বল বিক্রি', 'জার্সি ভাড়া', 'পানি/খাবার', 'অন্যান্য'];
  const categories = (settings?.income_categories && settings.income_categories.length > 0) ? settings.income_categories : defaultCats;
  
  const [amount, setAmount] = useState(incomeToEdit?.amount?.toString() || '');
  const [category, setCategory] = useState(incomeToEdit?.category || categories[0]);
  const [method, setMethod] = useState(incomeToEdit?.method || 'Cash');
  const [note, setNote] = useState(incomeToEdit?.note || '');
  const [businessDate, setBusinessDate] = useState(incomeToEdit?.business_date || getBusinessDateStr());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toEn = (bnStr: string) => bnStr.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9০-৯]/g, '');
    val = val.replace(/[0-9]/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);
    setAmount(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const enAmount = parseFloat(toEn(amount)) || 0;
      
      const endpoint = incomeToEdit ? 'update-income' : 'record-income';
      const bodyPayload = incomeToEdit 
        ? { id: incomeToEdit.id, amount: enAmount, category, method, note, business_date: businessDate }
        : { amount: enAmount, category, method, note, business_date: businessDate };

      const { data, error } = await supabase.functions.invoke(endpoint, {
        headers: { 'x-session-token': localStorage.getItem('session_token') || '' },
        body: bodyPayload
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message);
      
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('আয় এন্ট্রি করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 no-print">
        
        <div className="bg-green-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={20} /> {incomeToEdit ? 'আয় আপডেট করুন' : 'অন্যান্য আয় এন্ট্রি'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">তারিখ</label>
            <input 
              type="date" required 
              value={businessDate} onChange={(e) => setBusinessDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">পরিমাণ (৳)</label>
            <input 
              type="text" inputMode="numeric" required placeholder="০" 
              value={amount} onChange={handleAmountChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ক্যাটাগরি</label>
            <select 
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-semibold"
            >
              {categories.map((cat: string, i: number) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">পেমেন্ট মেথড</label>
            <select 
              value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-semibold"
            >
              <option value="Cash">Cash</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">বিবরণ</label>
            <textarea 
              rows={2} placeholder="ঐচ্ছিক विवरण..."
              value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium text-sm resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-3.5 mt-2 text-white font-bold text-lg rounded-2xl bg-green-600 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'প্রসেসিং...' : <><CheckCircle2 size={20} /> {incomeToEdit ? 'আপডেট করুন' : 'এন্ট্রি করুন'}</>}
          </button>
        </form>
      </div>
    </div>
  );
};
