
"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy,
  collectionGroup 
} from "firebase/firestore";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAction, normalizeName, approveVacationRequest } from "@/lib/db";
import { 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  UserPlus, 
  Check, 
  X, 
  Activity,
  ChevronLeft,
  Pencil,
  AlertCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AdminPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newEmployee, setNewEmployee] = useState({ name: "", group: "A", role: "user", vacation_balance: "15" });
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editBalance, setEditBalance] = useState<string>("");
  
  // Rejection state
  const [rejectingRequest, setRejectingRequest] = useState<any>(null);
  const [rejectionComment, setRejectionComment] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const unsubEmp = onSnapshot(collection(db, "employees"), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReq = onSnapshot(query(collectionGroup(db, "requests")), (snap) => {
      const fetchedRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedRequests.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
      setRequests(fetchedRequests);
    });

    const unsubSet = onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) setSettings(snap.data());
      setLoading(false);
    });

    return () => {
      unsubEmp();
      unsubReq();
      unsubSet();
    };
  }, [user, router]);

  const handleCreateEmployee = async () => {
    try {
      if (!newEmployee.name) {
        toast({ variant: "destructive", title: "Error", description: "El nombre es obligatorio." });
        return;
      }

      const norm = normalizeName(newEmployee.name);
      if (employees.some(e => e.name_normalized === norm)) {
        toast({ variant: "destructive", title: "Error", description: "El usuario ya existe." });
        return;
      }

      const docRef = await addDoc(collection(db, "employees"), {
        name: newEmployee.name,
        name_normalized: norm,
        group: newEmployee.group,
        role: newEmployee.role,
        vacation_balance: parseInt(newEmployee.vacation_balance),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logAction(user!.id, "EMPLOYEE_CREATE", { employeeId: docRef.id, name: norm });
      toast({ title: "Empleado creado", description: `Se ha registrado a ${newEmployee.name}` });
      setNewEmployee({ name: "", group: "A", role: "user", vacation_balance: "15" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el usuario." });
    }
  };

  const toggleEmployeeActive = async (emp: any) => {
    try {
      await updateDoc(doc(db, "employees", emp.id), { active: !emp.active });
      await logAction(user!.id, "EMPLOYEE_TOGGLE_ACTIVE", { id: emp.id, active: !emp.active });
      toast({ title: "Estado actualizado", description: `${emp.name} ahora está ${!emp.active ? 'Activo' : 'Desactivado'}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleUpdateBalance = async () => {
    if (!editingEmployee) return;
    try {
      const balance = parseInt(editBalance);
      if (isNaN(balance)) {
        toast({ variant: "destructive", title: "Error", description: "El saldo debe ser un número." });
        return;
      }

      await updateDoc(doc(db, "employees", editingEmployee.id), { 
        vacation_balance: balance,
        updatedAt: serverTimestamp() 
      });
      
      await logAction(user!.id, "EMPLOYEE_BALANCE_ADJUST", { 
        employeeId: editingEmployee.id, 
        oldBalance: editingEmployee.vacation_balance, 
        newBalance: balance 
      });

      toast({ title: "Saldo actualizado", description: `Nuevo saldo para ${editingEmployee.name}: ${balance} días.` });
      setEditingEmployee(null);
      setEditBalance("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el saldo." });
    }
  };

  const handleApprove = async (req: any) => {
    try {
      await approveVacationRequest(req.id, req.employeeId, user!.id);
      await logAction(user!.id, "REQUEST_APPROVE", { id: req.id, type: req.type });
      toast({ title: "Solicitud aprobada", description: "Se ha actualizado el saldo y estado." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest || !rejectionComment) {
      toast({ variant: "destructive", title: "Comentario requerido", description: "Debes dar un motivo para rechazar." });
      return;
    }
    try {
      const reqRef = doc(db, "employees", rejectingRequest.employeeId, "requests", rejectingRequest.id);
      await updateDoc(reqRef, { 
        status: "rejected", 
        hrComment: rejectionComment, 
        updatedAt: serverTimestamp() 
      });
      await logAction(user!.id, "REQUEST_REJECT", { id: rejectingRequest.id });
      toast({ title: "Solicitud rechazada" });
      setRejectingRequest(null);
      setRejectionComment("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");

  if (loading) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold font-headline">Administración RRHH</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/diagnostics")}>
            <Activity className="mr-2 w-4 h-4" /> Diagnóstico
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-8">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-12 bg-white/50 backdrop-blur-sm border shadow-sm">
            <TabsTrigger value="requests" className="flex gap-2 relative">
              <Bell className="w-4 h-4" /> 
              Solicitudes
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold animate-pulse shadow-md">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex gap-2"><Users className="w-4 h-4" /> Personas</TabsTrigger>
            <TabsTrigger value="settings" className="flex gap-2"><SettingsIcon className="w-4 h-4" /> Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Bandeja de Entrada</h3>
              <Badge variant="outline" className="px-3 py-1 font-medium bg-white">
                {pendingRequests.length} pendientes por procesar
              </Badge>
            </div>

            <div className="grid gap-4">
              {pendingRequests.length === 0 ? (
                <Card className="bg-white/50 border-dashed py-16">
                  <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-muted/50 rounded-full">
                      <Clock className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Todo al día</h4>
                      <p className="text-muted-foreground">No hay nuevas solicitudes que requieran tu atención.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pendingRequests.map((req) => {
                  const emp = employees.find(e => e.id === req.employeeId);
                  return (
                    <Card key={req.id} className="shadow-md border-l-4 border-l-primary overflow-hidden hover:shadow-lg transition-shadow bg-white">
                      <CardHeader className="pb-3 border-b bg-muted/5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Bell className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {req.type === "vacation" ? "Vacaciones" : req.type === "permission" ? "Permiso" : "Enfermedad"}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{emp?.name || 'Cargando...'}</span>
                                <span className="text-xs">•</span>
                                <span className="text-xs uppercase">Grupo {emp?.group}</span>
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-white border">
                            Enviada {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'PP p', {locale: es}) : 'Recientemente'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl">
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Desde</p>
                                <p className="font-bold text-base">{req.startDate?.toDate ? format(req.startDate.toDate(), 'PPP', {locale: es}) : '...'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Hasta</p>
                                <p className="font-bold text-base">{req.endDate?.toDate ? format(req.endDate.toDate(), 'PPP', {locale: es}) : '...'}</p>
                              </div>
                            </div>
                            {req.reason && (
                              <div className="text-sm bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                                <p className="text-amber-800 text-[10px] uppercase font-bold mb-1">Motivo del colaborador:</p>
                                <p className="italic text-amber-900 font-medium">"{req.reason}"</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col justify-between border-l pl-6 space-y-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase font-bold">Estado del Saldo</p>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-black">{emp?.vacation_balance}d</span>
                                <span className="text-xs text-muted-foreground">disponibles actualmente</span>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button 
                                variant="outline" 
                                className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setRejectingRequest(req)}
                              >
                                <X className="w-4 h-4 mr-2" /> Rechazar
                              </Button>
                              <Button 
                                className="flex-1 h-12 bg-primary shadow-lg shadow-primary/20"
                                onClick={() => handleApprove(req)}
                              >
                                <Check className="w-4 h-4 mr-2" /> Aprobar Solicitud
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              <h3 className="text-xl font-bold mt-10 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" /> Historial de Decisiones
              </h3>
              <Card className="border-none shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Decidido el</TableHead>
                      <TableHead>Comentario RRHH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.filter(r => r.status !== "pending").slice(0, 15).map((req) => {
                      const emp = employees.find(e => e.id === req.employeeId);
                      return (
                        <TableRow key={req.id} className="bg-white">
                          <TableCell className="font-medium">{emp?.name || '...'}</TableCell>
                          <TableCell className="capitalize">{req.type === 'vacation' ? 'Vacaciones' : req.type === 'sick' ? 'Enfermedad' : 'Permiso'}</TableCell>
                          <TableCell>
                            <Badge className={req.status === "approved" ? "bg-green-100 text-green-700 border-none" : "bg-red-100 text-red-700 border-none"}>
                              {req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {req.updatedAt?.toDate ? format(req.updatedAt.toDate(), 'PP p', {locale: es}) : '...'}
                          </TableCell>
                          <TableCell className="text-xs italic text-muted-foreground max-w-[200px] truncate">
                            {req.hrComment || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Base de Colaboradores</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90"><UserPlus className="mr-2 w-4 h-4" /> Nuevo Empleado</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Colaborador</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre Completo</Label>
                      <Input value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="Ej: Luis Pedro" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Saldo Inicial Vacaciones</Label>
                        <Input type="number" value={newEmployee.vacation_balance} onChange={e => setNewEmployee({...newEmployee, vacation_balance: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Grupo Asistencia</Label>
                        <Select value={newEmployee.group} onValueChange={v => setNewEmployee({...newEmployee, group: v as "A" | "B"})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Grupo A</SelectItem>
                            <SelectItem value="B">Grupo B</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <Select value={newEmployee.role} onValueChange={v => setNewEmployee({...newEmployee, role: v as "admin" | "user"})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Colaborador</SelectItem>
                          <SelectItem value="admin">Administrador RRHH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateEmployee}>Guardar Empleado</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell><Badge variant="outline">{emp.group}</Badge></TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">{emp.role === 'admin' ? 'Admin' : 'Colaborador'}</TableCell>
                      <TableCell className="font-bold">{emp.vacation_balance}d</TableCell>
                      <TableCell>
                        <Badge className={emp.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} variant="secondary">
                          {emp.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Editar Saldo" 
                          onClick={() => {
                            setEditingEmployee(emp);
                            setEditBalance(emp.vacation_balance.toString());
                          }}
                        >
                          <Pencil className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Toggle Estado" onClick={() => toggleEmployeeActive(emp)}>
                          {emp.active ? <X className="w-4 h-4 text-red-500" /> : <Check className="w-4 h-4 text-green-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Saldo de Vacaciones</DialogTitle>
                  <CardDescription>Ajusta los días disponibles para {editingEmployee?.name}.</CardDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Días de Vacaciones Disponibles</Label>
                    <Input 
                      type="number" 
                      value={editBalance} 
                      onChange={e => setEditBalance(e.target.value)} 
                      placeholder="Ej: 15"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
                  <Button onClick={handleUpdateBalance}>Actualizar Saldo</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="settings">
            <h3 className="text-2xl font-bold mb-6">Configuración Global</h3>
            <div className="grid gap-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Ciclo de Asistencia</CardTitle>
                  <CardDescription>Define qué lunes inicia el ciclo A/B. Por defecto: 3 de Marzo 2025.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="flex gap-4 items-center">
                    <div className="p-4 bg-muted/50 rounded-lg flex-1">
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Día de Referencia (Lunes)</p>
                      <p className="font-bold text-lg">{settings?.week1_monday_date?.toDate ? format(settings.week1_monday_date.toDate(), 'PPP', {locale: es}) : "No configurado"}</p>
                    </div>
                    <Button variant="outline">Cambiar Fecha</Button>
                   </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog for Rejection Reason */}
        <Dialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" /> Rechazar Solicitud
              </DialogTitle>
              <CardDescription>
                Indica el motivo por el cual no se aprueba la solicitud de <strong>{employees.find(e => e.id === rejectingRequest?.employeeId)?.name}</strong>.
              </CardDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reject-comment">Motivo del rechazo</Label>
                <Textarea 
                  id="reject-comment"
                  placeholder="Ej: El departamento tiene mucha carga laboral en esas fechas..." 
                  value={rejectionComment} 
                  onChange={e => setRejectionComment(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRejectingRequest(null);
                setRejectionComment("");
              }}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject}>Confirmar Rechazo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
