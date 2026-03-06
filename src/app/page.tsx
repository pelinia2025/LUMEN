
"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitting(true);
    try {
      const res = await login(name);
      if (res.success) {
        toast({ title: "Acceso concedido", description: res.message });
      } else {
        toast({ variant: "destructive", title: "Error", description: res.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error crítico", description: "Falla de conexión con el servidor." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-background">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold">L</div>
          <h1 className="text-4xl font-bold tracking-tight text-primary font-headline">Portal Lumen</h1>
          <p className="text-muted-foreground">Ingresa con tu nombre de colaborador</p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-left">
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>Usa tu nombre completo registrado en la agencia</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: Admin RRHH o Luis Pedro" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
