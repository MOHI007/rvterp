import React, { useState } from 'react';
import { X, Lock, CheckCircle2, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
}

export const ShiftCloseModal: React.FC<Props> = ({ onClose }) => {
  const { activeShiftId, logout } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [blindCash, setBlindCash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Totals
  const [expectedCash, setExpectedCash] = useState(0);
  const [bkashTotal, setBkashTotal] = useState(0);
  const [nagadTotal, setNagadTotal] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

  const handleNextStep = async () => {
    if (!blindCash || isNaN(Number(blindCash))) return;
    setIsProcessing(true);
    
    try {
      // 1. Get Shift Info
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .select('created_at')
        .eq('id', activeShiftId)
        .single();
        
      if (shiftError || !shift) throw new Error("Shift not found");
      const shiftStartTime = shift.created_at;

      // 2. Fetch Payments since shift start
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, method')
        .gte('created_at', shiftStartTime);

      // 3. Fetch Expenses for this shift
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('shift_id', activeShiftId);

      let cashSum = 0;
      let bkashSum = 0;
      let nagadSum = 0;
      let expSum = 0;

      payments?.forEach(p => {
        if (p.method === 'Cash') cashSum += p.amount;
        if (p.method === 'bKash') bkashSum += p.amount;
        if (p.method === 'Nagad') nagadSum += p.amount;
      });

      expenses?.forEach(e => {
        expSum += e.amount;
      });

      setBkashTotal(bkashSum);
      setNagadTotal(nagadSum);
      setExpensesTotal(expSum);
      setExpectedCash(cashSum - expSum);
      
      setStep(2);
    } catch (err) {
      console.error(err);
      alert('ডেটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          end_time: new Date().toISOString(),
          expected_cash: expectedCash,
          blind_counted_cash: parseInt(blindCash),
          bkash_total: bkashTotal,
          nagad_total: nagadTotal,
          status: 'closed'
        })
        .eq('id', activeShiftId);

      if (error) throw error;
      
      logout();
    } catch (err) {
      console.error(err);
      alert('শিফট বন্ধ করতে সমস্যা হয়েছে।');
      setIsProcessing(false);
    }
  };

  const parsedBlindCash = parseInt(blindCash) || 0;
  const discrepancy = parsedBlindCash - expectedCash;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="bg-red-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Lock size={20} /> শিফট শেষ করুন
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>
        
        {step === 1 ? (
          <div className="p-5 space-y-5 animate-in slide-in-from-right-4">
            
            <div className="text-center">
              <div className="bg-red-50 text-red-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign size={32} />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">ক্যাশ ড্রয়ারে কত টাকা আছে?</h3>
              <p className="text-sm text-gray-500 mt-1">সঠিক পরিমাণ গণনা করে নিচে লিখুন।</p>
            </div>

            <div>
              <input 
                type="number" required placeholder="৳ 0" autoFocus
                value={blindCash} onChange={(e) => setBlindCash(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-red-500 outline-none font-bold text-3xl text-center tracking-wider text-gray-800 transition-colors"
              />
            </div>

            <button 
              onClick={handleNextStep}
              disabled={isProcessing || !blindCash}
              className="w-full py-4 mt-2 text-white font-bold text-lg rounded-2xl bg-gray-800 active:scale-95 transition-transform shadow-lg disabled:opacity-70"
            >
              {isProcessing ? 'হিসাব করা হচ্ছে...' : 'পরবর্তী ধাপ'}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4 animate-in slide-in-from-right-4">
            
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl space-y-2 text-sm font-semibold">
              <div className="flex justify-between text-gray-600">
                <span>হিসাব অনুযায়ী ক্যাশ (Expected):</span>
                <span>৳{toBn(expectedCash)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>আপনার গোনা ক্যাশ (Counted):</span>
                <span>৳{toBn(parsedBlindCash)}</span>
              </div>
              
              <div className={`flex justify-between text-lg font-bold pt-2 border-t border-gray-200 mt-2 ${discrepancy === 0 ? 'text-green-600' : 'text-red-500'}`}>
                <span>গরমিল (Discrepancy):</span>
                <span>{discrepancy > 0 ? '+' : ''}৳{toBn(discrepancy)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-pink-50 border border-pink-100 p-3 rounded-xl">
                <p className="text-xs font-bold text-pink-600 mb-1">বিকাশ (সর্বমোট)</p>
                <p className="font-bold text-gray-800">৳{toBn(bkashTotal)}</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
                <p className="text-xs font-bold text-orange-600 mb-1">নগদ (সর্বমোট)</p>
                <p className="font-bold text-gray-800">৳{toBn(nagadTotal)}</p>
              </div>
            </div>
            
            <div className="bg-gray-100 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-gray-500 mb-1">শিফটের খরচ (সর্বমোট)</p>
              <p className="font-bold text-gray-800">৳{toBn(expensesTotal)}</p>
            </div>

            <button 
              onClick={handleFinalize}
              disabled={isProcessing}
              className="w-full py-4 mt-2 text-white font-bold text-lg rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 transition-transform shadow-lg shadow-red-500/30 flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isProcessing ? 'প্রসেসিং...' : <><CheckCircle2 size={24} /> নিশ্চিত করুন (লগআউট)</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
