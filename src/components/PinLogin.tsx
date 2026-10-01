import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Delete, Shield } from 'lucide-react';

export const PinLogin: React.FC = () => {
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
  useEffect(() => {
    if (pin.length === 4) {
      handleLogin();
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 select-none touch-none relative">
      <div className="w-full max-w-[280px] space-y-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-brand-orange/20 rounded-full flex items-center justify-center">
            <Shield size={32} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">River View Turf</h1>
            <p className="mt-1 text-sm text-gray-400 font-medium tracking-wider">আপনার পিন প্রবেশ করুন</p>
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="h-6 relative">
          <div className={`flex justify-center gap-5 transition-transform ${error ? 'animate-shake' : ''}`}>
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  i < pin.length 
                    ? 'bg-brand-orange shadow-[0_0_10px_rgba(255,107,0,0.5)] scale-110' 
                    : 'bg-gray-700 scale-100'
                }`}
              />
            ))}
          </div>
          {error && (
            <p className="absolute -bottom-6 w-full text-center text-red-500 font-bold text-sm tracking-wide">
              ভুল পিন, আবার চেষ্টা করুন
            </p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-6 place-items-center mt-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button 
              key={num}
              onClick={() => handleNumberPress(num.toString())}
              className="h-[72px] w-[72px] rounded-full bg-gray-800 text-3xl font-semibold text-white hover:bg-gray-700 active:bg-brand-orange transition-colors flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}
          <div className="col-start-2">
            <button 
              onClick={() => handleNumberPress('0')}
              className="h-[72px] w-[72px] rounded-full bg-gray-800 text-3xl font-semibold text-white hover:bg-gray-700 active:bg-brand-orange transition-colors flex items-center justify-center shadow-sm"
            >
              0
            </button>
          </div>
          <div className="col-start-3">
            <button 
              onClick={handleDelete}
              className="h-[72px] w-[72px] rounded-full bg-transparent text-gray-500 hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center justify-center"
            >
              <Delete size={32} />
            </button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 w-full text-center text-xs text-gray-500 font-medium tracking-wide">
        Dev by Engr. A N M AL MUHI
      </div>
    </div>
  );
};
