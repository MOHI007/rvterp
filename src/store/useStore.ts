import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager';
}

interface AppState {
  currentUser: User | null;
  activeShiftId: string | null;
  setCurrentUser: (user: User | null) => void;
  setActiveShiftId: (id: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: null,
  activeShiftId: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveShiftId: (id) => set({ activeShiftId: id }),
  logout: () => set({ currentUser: null, activeShiftId: null }),
}));
