"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiFetch } from "../api";

interface User {
  id: string;
  email: string;
  role: "CUSTOMER" | "PROVIDER";
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    role: "CUSTOMER" | "PROVIDER",
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;

  (async () => {
    await Promise.resolve();

    const saved = localStorage.getItem('token');
    if (!saved) {
      if (!cancelled) setLoading(false);
      return;
    }

    if (!cancelled) setToken(saved);
    try {
      const data = await apiFetch('/auth/me', {}, saved);
      if (!cancelled) setUser(data.user);
    } catch {
      localStorage.removeItem('token');
      if (!cancelled) setToken(null);
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);
  async function login(email: string, password: string) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function signup(
    email: string,
    password: string,
    role: "CUSTOMER" | "PROVIDER",
  ) {
    const data = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
