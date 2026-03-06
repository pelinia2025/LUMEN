
"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, collectionGroup } from "firebase/firestore";
import { getWorkStatus, getWeekType } from "@/lib/date-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Building2, 
  Home, 
  XCircle, 
  Calendar, 
  Plane, 
  Stethoscope, 
  FileText, 
  LogOut, 
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  Users,
  Bell
} from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  const [settings, setSettings] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    });

    const qRequests = query(collection(db, "employees", user.id, "requests"), where("status", "==", "approved"));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Si es admin, contar solicitudes pendientes globalmente
    let unsubPending: any = () => {};
    if (user.role === "admin") {
      const qPending = query(collectionGroup(db, "requests"), where("status", "==", "pending"));
      unsubPending = onSnapshot(qPending, (snap) => {
        setPendingCount(snap.size);
      });
    }

    return () => {
      unsubSettings();
      unsubRequests();
      unsubPending();
    };
  }, [user, router]);

  if (!user || !settings) return null;

  const todayStatus = getWorkStatus(new Date(), user, settings, requests);
  const weekType = getWeekType(new Date(), settings.week1_monday_date?.toDate() || new Date("2025-03-03"));

  // Lunes a Viernes únicamente
  const mon = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(mon, i));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OFICINA": return "bg-primary text-primary-foreground";
      case "HOME OFFICE": return "bg-secondary text-secondary-foreground";
      case "VACACIONES": return "bg-orange-500 text-white";
      case "PERMISO": return "bg-purple-500 text-white";
      case "ENFERMO": return "bg-red-500 text-white";
      case "CERRADO": return "bg-gray-400 text-white";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OFICINA": return <Building2 className="w-5 h-5" />;
      case "HOME OFFICE": return <Home className="w-5 h-5" />;
      case "VACACIONES": return <Plane className="w-5 h-5" />;
      case "ENFERMO": return <Stethoscope className="w-5 h-5" />;
      case "CERRADO": return <XCircle className="w-5 h-5" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">L</div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Portal Lumen</h2>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => logout()}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 mt-6 space-y-8">
        <Card className="border-none shadow-lg overflow-hidden">
          <div className={`p-1 ${getStatusColor(todayStatus)}`} />
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-3">
            <span className="text-xs uppercase tracking-widest font-bold opacity-70">Hoy te toca</span>
            <div className={`p-4 rounded-full ${getStatusColor(todayStatus)} bg-opacity-10 mb-2`}>
              {getStatusIcon(todayStatus)}
            </div>
            <h1 className="text-4xl font-black">{todayStatus}</h1>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">Grupo {user.group}</Badge>
              <Badge variant="outline" className="text-xs">{weekType}</Badge>
            </div>
          </CardContent>
          <div className="border-t bg-muted/30 p-4 flex justify-around">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Saldo Vacaciones</p>
              <p className="font-bold text-2xl text-primary">{user.vacation_balance} días</p>
            </div>
          </div>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xl">Mi Semana (L-V)</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 pb-2">
            {weekDays.map((day, i) => {
              const status = getWorkStatus(day, user, settings, requests);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={i} className={`flex flex-col items-center min-w-[60px] p-2 rounded-xl border ${isToday ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-white shadow-sm'}`}>
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">{format(day, 'EEE', { locale: es })}</span>
                  <span className="text-lg font-bold my-1">{format(day, 'd')}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          {user.role === "admin" && (
            <Card className="col-span-2 bg-primary/10 border-primary hover:bg-primary/20 transition-all cursor-pointer shadow-md" onClick={() => router.push("/admin")}>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2 relative">
                <Bell className="w-10 h-10 text-primary" />
                <p className="font-black text-xl text-primary">Aprobar Solicitudes</p>
                <p className="text-sm text-primary/70">Gestionar trámites pendientes de colaboradores</p>
                {pendingCount > 0 && (
                  <Badge className="absolute top-4 right-4 bg-primary animate-pulse text-sm px-3 py-1">
                    {pendingCount} PENDIENTES
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
          
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => router.push("/requests/vacation")}>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
              <Plane className="w-8 h-8 text-primary" />
              <p className="font-bold">Solicitar Vacaciones</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => router.push("/requests/permission")}>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
              <FileText className="w-8 h-8 text-purple-500" />
              <p className="font-bold">Permiso Especial</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => router.push("/requests/sick")}>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
              <Stethoscope className="w-8 h-8 text-red-500" />
              <p className="font-bold">Reportar Enfermedad</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary transition-colors cursor-pointer" onClick={() => router.push("/history")}>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
              <Calendar className="w-8 h-8 text-secondary" />
              <p className="font-bold">Mis Solicitudes</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
