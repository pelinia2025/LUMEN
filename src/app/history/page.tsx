
"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ArrowLeft, 
  Plane, 
  Stethoscope, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Calendar as CalendarIcon
} from "lucide-react";

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const q = query(
      collection(db, "employees", user.id, "requests"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprobada</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none"><XCircle className="w-3 h-3 mr-1" /> Rechazada</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "vacation": return <Plane className="w-5 h-5 text-primary" />;
      case "permission": return <FileText className="w-5 h-5 text-purple-500" />;
      case "sick": return <Stethoscope className="w-5 h-5 text-red-500" />;
      default: return <CalendarIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "vacation": return "Vacaciones";
      case "permission": return "Permiso Especial";
      case "sick": return "Enfermedad";
      default: return "Solicitud";
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-muted/20 pb-10">
      <header className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="mr-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold font-headline">Mis Solicitudes</h1>
      </header>

      <main className="container mx-auto max-w-2xl p-4 mt-4 space-y-4">
        {requests.length === 0 ? (
          <Card className="border-dashed bg-white/50 py-10">
            <CardContent className="text-center text-muted-foreground">
              <p>Aún no has realizado ninguna solicitud.</p>
              <Button variant="link" onClick={() => router.push("/dashboard")} className="mt-2 text-primary">
                Volver al inicio para crear una
              </Button>
            </CardContent>
          </Card>
        ) : (
          requests.map((req) => (
            <Card key={req.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b bg-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted/50 rounded-lg">
                      {getIcon(req.type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{getTypeText(req.type)}</CardTitle>
                      <CardDescription className="text-xs">
                        Enviada el {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'PPP', { locale: es }) : 'Recientemente'}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 bg-white">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase font-bold">Desde</p>
                    <p className="font-semibold">{req.startDate?.toDate ? format(req.startDate.toDate(), 'PPP', { locale: es }) : format(new Date(req.startDate), 'PPP', { locale: es })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase font-bold">Hasta</p>
                    <p className="font-semibold">{req.endDate?.toDate ? format(req.endDate.toDate(), 'PPP', { locale: es }) : format(new Date(req.endDate), 'PPP', { locale: es })}</p>
                  </div>
                </div>

                {req.reason && (
                  <div className="pt-2 border-t text-sm">
                    <p className="text-muted-foreground text-xs uppercase font-bold mb-1">Motivo</p>
                    <p className="text-muted-foreground italic">"{req.reason}"</p>
                  </div>
                )}

                {req.hrComment && (
                  <div className="pt-2 mt-2 bg-amber-50 p-3 rounded-lg border border-amber-100 text-sm">
                    <p className="text-amber-800 text-xs uppercase font-bold mb-1">Respuesta de RRHH</p>
                    <p className="text-amber-700">{req.hrComment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
