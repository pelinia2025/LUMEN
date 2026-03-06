
"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Plane, Stethoscope, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function RequestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { type } = useParams();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getTitle = () => {
    if (type === "vacation") return "Solicitar Vacaciones";
    if (type === "permission") return "Solicitar Permiso Especial";
    if (type === "sick") return "Reportar Enfermedad";
    return "Nueva Solicitud";
  };

  const getIcon = () => {
    if (type === "vacation") return <Plane className="w-10 h-10 text-primary" />;
    if (type === "permission") return <FileText className="w-10 h-10 text-purple-500" />;
    if (type === "sick") return <Stethoscope className="w-10 h-10 text-red-500" />;
    return <Calendar className="w-10 h-10 text-primary" />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Sesión no encontrada", description: "Por favor vuelve a iniciar sesión." });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast({ variant: "destructive", title: "Error", description: "La fecha final no puede ser anterior a la inicial." });
      return;
    }

    setSubmitting(true);
    try {
      // Guardar en la subcolección del empleado según la estructura /employees/{id}/requests/
      const requestsRef = collection(db, "employees", user.id, "requests");
      
      await addDoc(requestsRef, {
        employeeId: user.id,
        type: type as string,
        startDate: new Date(startDate + "T12:00:00"), // Evitar problemas de zona horaria
        endDate: new Date(endDate + "T12:00:00"),
        reason: reason.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Solicitud enviada", description: "Tu petición está en espera de aprobación por RRHH." });
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error al enviar solicitud:", err);
      toast({ 
        variant: "destructive", 
        title: "Error de permisos", 
        description: "No tienes permiso para realizar esta acción. Contacta a soporte." 
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" className="mb-2" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Volver
        </Button>

        <Card className="shadow-xl border-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 p-4 bg-muted/50 rounded-full w-fit">{getIcon()}</div>
            <CardTitle className="text-2xl font-headline">{getTitle()}</CardTitle>
            <CardDescription>Completa los detalles para procesar tu solicitud.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start">Fecha Inicio</Label>
                <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fecha Fin</Label>
                <Input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo / Comentarios</Label>
                <Textarea id="reason" placeholder="Escribe el motivo aquí..." value={reason} onChange={e => setReason(e.target.value)} rows={3} />
              </div>
              
              {type === "vacation" && (
                <div className="bg-primary/5 p-3 rounded-lg text-sm text-primary font-medium flex gap-2 items-center">
                  <Plane className="w-4 h-4" /> Tienes {user?.vacation_balance} días hábiles disponibles.
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-12 text-lg" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin mr-2" /> : "Enviar Solicitud"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
