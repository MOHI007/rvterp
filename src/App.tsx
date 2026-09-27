import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { Settings } from 'lucide-react';

const MainApp = () => {
  const { user } = useAuth();
  const [view, setView] = useState<'pos' | 'admin'>('pos');

  if (!user) {
    return <LoginScreen />;
  }

  if (user.role === 'admin' && view === 'admin') {
    return <AdminDashboard onSwitchToPOS={() => setView('pos')} />;
  }

  return (
    <div className="relative">
      <Dashboard />
      
      {/* Floating Admin Toggle Button (Hidden on Print) */}
      {user.role === 'admin' && view === 'pos' && (
        <div className="fixed bottom-6 right-6 z-50 no-print">
          <button 
            onClick={() => setView('admin')}
            className="p-4 bg-gray-900 text-white rounded-full shadow-2xl font-bold flex items-center justify-center active:scale-95 transition-transform border-2 border-gray-700 hover:bg-black hover:border-gray-600"
            title="অ্যাডমিন প্যানেল"
          >
            <Settings size={28} className="text-brand-orange" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
