import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Delete } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const { loginWithPin } = useAuth();

  const handleNumberPress = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (pin.length === 4) {
      const success = await loginWithPin(pin);
      if (!success) {
        setError(true);
        setPin('');
      }
    }
  };

  // Auto-trigger login when 4 digits are entered
  React.useEffect(() => {
    if (pin.length === 4) {
      handleLogin();
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-8 text-center border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">স্টাফ লগইন</h1>
          <p className="mt-2 text-gray-600">আপনার ৪-ডিজিটের পিন দিন</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 py-4">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length 
                  ? 'bg-brand-orange scale-110' 
                  : 'bg-gray-200 scale-100'
              } ${error ? 'bg-red-500 animate-pulse' : ''}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 font-semibold animate-in slide-in-from-bottom-2">
            ভুল পিন কোড, আবার চেষ্টা করুন
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button 
              key={num}
              onClick={() => handleNumberPress(num.toString())}
              className="h-16 rounded-xl bg-gray-50 text-2xl font-semibold text-gray-800 active:bg-brand-orange active:text-white transition-colors flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <div className="col-start-2">
            <button 
              onClick={() => handleNumberPress('0')}
              className="h-16 rounded-xl bg-gray-50 text-2xl font-semibold text-gray-800 active:bg-brand-orange active:text-white transition-colors flex items-center justify-center w-full"
            >
              0
            </button>
          </div>
          <div className="col-start-3">
            <button 
              onClick={handleDelete}
              className="h-16 rounded-xl bg-red-50 text-red-500 active:bg-red-100 transition-colors flex items-center justify-center w-full"
            >
              <Delete size={28} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
