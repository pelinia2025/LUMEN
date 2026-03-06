
"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, setDoc, doc, serverTimestamp, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { normalizeName } from "@/lib/db";
import { Activity, Database, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function DiagnosticsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [stats, setStats] = useState({ employees: 0, requests: 0, settings: false });
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, []);

  const fetchStats = async () => {
    try {
      const emps = await getDocs(collection(db, "employees"));
      const reqs = await getDocs(collection(db, "requests"));
      const settingsSnap = await getDocs(collection(db, "settings"));
      setStats({
        employees: emps.size,
        requests: reqs.size,
        settings: settingsSnap.size > 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  const createDemoData = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "Cargando sesión...", description: "Espera un momento a que Firebase se inicialice." });
      return;
    }

    setIsCreating(true);
    try {
      const currentUid = auth.currentUser.uid;

      // 1. Initial Settings
      await setDoc(doc(db, "settings", "global"), {
        week1_monday_date: new Date("2025-03-03T00:00:00"),
        holidays: [],
        office_closures: [],
        updatedAt: serverTimestamp()
      });

      // 2. Roles Admin - Vincular sesión actual como admin
      await setDoc(doc(db, "roles_admin", currentUid), {
        active: true,
        createdAt: serverTimestamp()
      });

      // 3. Demo Employees
      const demos = [
        { id: currentUid, name: "Admin RRHH", group: "A", role: "admin", balance: 15 },
        { name: "Luis Pedro", group: "A", role: "user", balance: 10 },
        { name: "Ana", group: "B", role: "user", balance: 10 },
      ];

      for (const d of demos) {
        const norm = normalizeName(d.name);
        const data = {
          name: d.name,
          name_normalized: norm,
          pin_hash: "0000",
          group: d.group,
          role: d.role,
          vacation_balance: d.balance,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        if (d.id) {
          await setDoc(doc(db, "employees", d.id), data);
        } else {
          await addDoc(collection(db, "employees"), data);
        }
      }

      toast({ title: "¡Configuración lista!", description: "Datos creados. Ingresa con 'Admin RRHH'." });
      await fetchStats();
      setTimeout(() => router.push("/"), 1500);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudieron crear los datos." });
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-muted/20">
      <Loader2 className="animate-spin w-10 h-10 text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}><ArrowLeft /></Button>
            <h1 className="text-2xl font-bold flex items-center gap-2 font-headline">
              <Activity className="text-primary" /> Panel de Diagnóstico
            </h1>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle>Estado de Firestore</CardTitle>
              <CardDescription>Estadísticas actuales en la nube</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <span className="font-medium">Empleados</span>
                <Badge variant={stats.employees > 0 ? "default" : "destructive"}>{stats.employees}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <span className="font-medium">Configuración Global</span>
                {stats.settings ? <CheckCircle className="text-green-500 w-5 h-5" /> : <AlertCircle className="text-red-500 w-5 h-5" />}
              </div>
              <Button onClick={fetchStats} className="w-full" variant="outline">Refrescar Estado</Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-primary/20 bg-primary/5 shadow-inner">
            <CardHeader>
              <CardTitle>Inicialización Maestra</CardTitle>
              <CardDescription>Usa esto para empezar desde cero si el login te da problemas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={createDemoData} 
                className="bg-primary text-white w-full h-16 text-lg font-bold shadow-lg hover:bg-primary/90 transition-all"
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="animate-spin mr-3 w-6 h-6" /> : <Database className="mr-3 w-6 h-6" />}
                REPARAR Y CREAR ADMIN (Admin RRHH)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
