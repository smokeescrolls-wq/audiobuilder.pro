import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  userId: string | null;
  role: "user" | "admin" | null;
  setSession: (v: { userId: string | null; role: "user" | "admin" | null }) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      role: null,
      setSession: (v) => set({ userId: v.userId, role: v.role }),
      clear: () => set({ userId: null, role: null }),
    }),
    { name: "mg.session.v1" }
  )
);
