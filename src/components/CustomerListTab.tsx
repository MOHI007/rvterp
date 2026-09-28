import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Phone, Edit2, MessageCircle, X, CheckCircle2 } from 'lucide-react';
import { type Customer } from '../types';

export const CustomerListTab: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'top' | 'credit'>('all');
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editCredit, setEditCredit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toBn = (num: number | string) => num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  const toEn = (str: string) => str.replace(/[০-৯]/g, d => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);

  const fetchCRM = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('total_matches', { ascending: false });
    if (data) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCRM();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('customers').update({
        name: editName,
        advance_balance: parseInt(editCredit) || 0
      }).eq('phone_number', editingCustomer.phone_number);
      
      if (error) throw error;
      await fetchCRM();
      setEditingCustomer(null);
    } catch (err) {
      alert('আপডেট ফেইল হয়েছে!');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    // Search
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || 
                          c.phone_number.includes(search) || 
                          toEn(c.phone_number).includes(toEn(search));
    if (!matchesSearch) return false;

    // Filter
    if (filter === 'top') return c.total_matches >= 5;
    if (filter === 'credit') return c.advance_balance > 0;
    
    return true;
  });

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4">
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-brand-orange text-sm font-semibold"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button 
          onClick={() => setFilter('all')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          সব
        </button>
        <button 
          onClick={() => setFilter('top')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filter === 'top' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          নিয়মিত (৫+ ম্যাচ)
        </button>
        <button 
          onClick={() => setFilter('credit')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filter === 'credit' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          ক্রেডিট আছে
        </button>
      </div>

      {/* List */}
      <div className="space-y-3 pb-20">
        {loading ? (
          <p className="text-center text-gray-400 py-10 font-bold">লোড হচ্ছে...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-center text-gray-400 py-10 font-bold">কোনো গ্রাহক পাওয়া যায়নি</p>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.phone_number} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    {customer.name} 
                    {customer.total_matches >= 10 && <span className="bg-brand-orange text-white text-[10px] px-2 py-0.5 rounded-full">VIP</span>}
                  </h3>
                  <p className="text-sm font-semibold text-gray-500 font-mono tracking-wider">{customer.phone_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">ম্যাচ: {toBn(customer.total_matches)}</p>
                  {customer.advance_balance > 0 && (
                    <p className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg inline-block mt-1 font-bold">
                      ক্রেডিট: ৳{toBn(customer.advance_balance)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 border-t border-gray-50 pt-3">
                <a 
                  href={`tel:${toEn(customer.phone_number)}`}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                >
                  <Phone size={18} />
                </a>
                <a 
                  href={`https://wa.me/88${toEn(customer.phone_number)}`}
                  target="_blank" rel="noreferrer"
                  className="p-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl transition-colors"
                >
                  <MessageCircle size={18} />
                </a>
                <button 
                  onClick={() => {
                    setEditingCustomer(customer);
                    setEditName(customer.name);
                    setEditCredit(customer.advance_balance.toString());
                  }}
                  className="p-2 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange rounded-xl transition-colors"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit2 size={20} /> এডিট গ্রাহক
              </h2>
              <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={22} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">নাম</label>
                <input 
                  type="text" required
                  value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ক্রেডিট ব্যালেন্স (৳)</label>
                <input 
                  type="number" min="0" onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                  value={editCredit} onChange={(e) => setEditCredit(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-bold text-lg text-gray-800"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full py-3.5 mt-2 text-white font-bold text-lg rounded-2xl bg-brand-orange active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isSaving ? 'সেভ হচ্ছে...' : <><CheckCircle2 size={20} /> সেভ করুন</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
