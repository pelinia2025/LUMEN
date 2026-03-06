
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { normalizeName, logAction } from "./db";

interface Employee {
  id: string;
  name: string;
  name_normalized: string;
  pin: string;
  group: "A" | "B";
  role: "admin" | "user";
  vacation_balance: number;
  parkingSpot?: string;
  active: boolean;
}

interface AuthContextType {
  user: Employee | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("lumen_session");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("lumen_session");
      }
    }

    const unsub = auth.onAuthStateChanged((fbUser) => {
      if (!fbUser) {
        signInAnonymously(auth).catch(err => console.error("Anonymous sign in error:", err));
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (name: string, pin: string) => {
    try {
      if (!name || name.trim().length < 2) {
        return { success: false, message: "Nombre demasiado corto" };
      }
      if (!pin || pin.length !== 4) {
        return { success: false, message: "El PIN debe ser de 4 dígitos" };
      }

      const norm = normalizeName(name);
      const q = query(
        collection(db, "employees"), 
        where("name_normalized", "==", norm),
        limit(1)
      );
      
      const snap = await getDocs(q);

      if (snap.empty) {
        await logAction("system", "LOGIN_FAIL_NAME", { input: name, normalized: norm, reason: "NOT_FOUND" });
        return { success: false, message: "Usuario no encontrado." };
      }

      const docData = snap.docs[0];
      const empData = { id: docData.id, ...docData.data() } as Employee;

      if (!empData.active) {
        return { success: false, message: "Usuario desactivado" };
      }

      // Verificación de PIN
      if (empData.pin !== pin) {
        await logAction(empData.id, "LOGIN_FAIL_PIN", { reason: "WRONG_PIN" });
        return { success: false, message: "PIN incorrecto." };
      }

      setUser(empData);
      localStorage.setItem("lumen_session", JSON.stringify(empData));
      await logAction(empData.id, "LOGIN_SUCCESS", {});
      return { success: true, message: "Bienvenido" };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, message: "Error al conectar con la base de datos." };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("lumen_session");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
