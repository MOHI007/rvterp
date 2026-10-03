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
  settings: AppSettings | null;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    // We allow anon read on settings table (P2 says so)
    const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data as AppSettings);
  };

  const validateSession = async () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-session', {
        headers: {
          'x-session-token': token
        }
      });

      if (error || !data || !data.success) {
        localStorage.removeItem('session_token');
        setUser(null);
      } else {
        setUser({ id: data.id, name: data.name, role: data.role as 'admin' | 'manager' });
      }
    } catch (err) {
      console.error('Session validation error:', err);
      localStorage.removeItem('session_token');
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSettings();
    validateSession();
  }, []);

  const loginWithPin = async (pin: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { pin }
      });

      if (error || !data || !data.success) {
        console.error('Login failed:', error?.message || data?.error);
        return false;
      }

      localStorage.setItem('session_token', data.token);
      setUser({ id: data.id, name: data.name, role: data.role as 'admin' | 'manager' });
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const logout = async () => {
    const token = localStorage.getItem('session_token');
    if (token) {
      try {
        await supabase.functions.invoke('validate-session', {
          method: 'DELETE',
          headers: {
            'x-session-token': token
          }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, settings, loginWithPin, logout, fetchSettings, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
