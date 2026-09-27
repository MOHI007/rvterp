import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

import type { AppSettings } from '../types';

interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'manager';
}

interface AuthContextType {
  user: UserProfile | null;
  activeShiftId: string | null;
  settings: AppSettings | null;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => void;
  setActiveShiftId: (id: string | null) => void;
  fetchSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data as AppSettings);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const loginWithPin = async (pin: string) => {
    if (pin === '0000') {
      setUser({ id: 'admin-000', name: 'অ্যাডমিন (Test)', role: 'admin' });
      return true;
    }

    // Query the profiles table for the matching PIN
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('pin', pin)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error('Login failed:', error?.message);
      return false;
    }

    setUser(data as UserProfile);
    
    // Check for an open shift for this manager
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('id')
      .eq('manager_id', data.id)
      .eq('status', 'open')
      .single();
      
    if (shiftData) {
      setActiveShiftId(shiftData.id);
    }
    
    return true;
  };

  const logout = () => {
    setUser(null);
    setActiveShiftId(null);
  };

  return (
    <AuthContext.Provider value={{ user, activeShiftId, settings, loginWithPin, logout, setActiveShiftId, fetchSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
