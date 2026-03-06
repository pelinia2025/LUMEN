
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  logAction, 
  normalizeName, 
  approveVacationRequest, 
  accrueMonthlyVacation, 
  deleteVacationRequest, 
  cancelVacationRequest,
  bulkDeleteRequests
} from "@/lib/db";
import { 
  UserPlus, 
  Check, 
  X, 
  ChevronLeft,
  Pencil,
  Trash2,
  Plane,
  Calendar as CalendarIcon,
  RotateCcw,
  Loader2,
  History,
  Car
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [newEmployee, setNewEmployee] = useState({ name: "", pin: "", group: "A", role: "user", vacation_balance: "15", parkingSpot: "" });
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", balance: "", pin: "", group: "", role: "", parkingSpot: "" });
  
  const [newRefDate, setNewRefDate] = useState("");
  const [newPattern, setNewPattern] = useState("A_MWF");

  const [rejectingRequest, setRejectingRequest] = useState<any>(null);
  const [rejectionComment, setRejectionComment] = useState("");
  const [manageRequest, setManageRequest] = useState<any>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const unsubEmp = onSnapshot(collection(db, "employees"), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReq = onSnapshot(query(collectionGroup(db, "requests")), (snap) => {
      const fetchedRequests = snap.docs.map(d => {
        const data = d.data();
        const pathParts = d.ref.path.split('/');
        // Ruta típica: employees/{empId}/requests/{reqId} -> partes [employees, empId, requests, reqId]
        const empIdFromPath = pathParts[1];

        return { 
          id: d.id, 
          ...data, 
          employeeId: empIdFromPath
        };
      });
      
      fetchedRequests.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
      setRequests(fetchedRequests);
      setLoading(false);
    });

    const unsubSet = onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        if (data.week1_monday_date) {
          setNewRefDate(format(data.week1_monday_date.toDate(), 'yyyy-MM-dd'));
        }
        setNewPattern(data.week1Pattern || "A_MWF");
      }
    });

    return () => { unsubEmp(); unsubReq(); unsubSet(); };
  }, [user, router]);

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.pin) {
      toast({ variant: "destructive", title: "Error", description: "Nombre y PIN obligatorios." });
      return;
    }
    try {
      const norm = normalizeName(newEmployee.name);
      const docRef = await addDoc(collection(db, "employees"), {
        ...newEmployee,
        name_normalized: norm,
        vacation_balance: parseFloat(newEmployee.vacation_balance),
        parkingSpot: newEmployee.parkingSpot || "S/N",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAction(user!.id, "EMPLOYEE_CREATE", { employeeId: docRef.id, name: norm });
      toast({ title: "Empleado creado" });
      setNewEmployee({ name: "", pin: "", group: "A", role: "user", vacation_balance: "15", parkingSpot: "" });
    } catch (e) { toast({ variant: "destructive", title: "Error al crear" }); }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    try {
      const norm = normalizeName(editForm.name);
      const updates: any = { 
        name: editForm.name,
        name_normalized: norm,
        vacation_balance: parseFloat(editForm.balance),
        group: editForm.group,
        role: editForm.role,
        parkingSpot: editForm.parkingSpot || "S/N",
        updatedAt: serverTimestamp() 
      };
      if (editForm.pin) updates.pin = editForm.pin;
      await updateDoc(doc(db, "employees", editingEmployee.id), updates);
      toast({ title: "Perfil actualizado" });
      setEditingEmployee(null);
    } catch (e) { toast({ variant: "destructive", title: "Error al actualizar" }); }
  };

  const handleApprove = async (req: any) => {
    setIsProcessing(req.id);
    try {
      const result = await approveVacationRequest(req.id, req.employeeId, user!.id);
      toast({ title: "Solicitud aprobada", description: result.discounted ? `Se descontaron ${result.days} días.` : "Aprobada sin consumo." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsProcessing(null); }
  };

  const handleReject = async () => {
    if (!rejectingRequest || !rejectionComment) return;
    setIsProcessing(rejectingRequest.id);
    try {
      await updateDoc(doc(db, "employees", rejectingRequest.employeeId, "requests", rejectingRequest.id), {
        status: "rejected",
        hrComment: rejectionComment,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Solicitud rechazada" });
      setRejectingRequest(null);
      setRejectionComment("");
    } catch (e) { toast({ variant: "destructive", title: "Error al rechazar" }); }
    finally { setIsProcessing(null); }
  };

  const handleCancel = async (req: any) => {
    setIsProcessing(req.id);
    try {
      await cancelVacationRequest(req.id, req.employeeId, user!.id);
      toast({ title: "Solicitud cancelada", description: "Saldo restaurado." });
      setManageRequest(null);
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsProcessing(null); }
  };

  const handleDeletePermanent = async (req: any) => {
    if (!req) return;
    setIsProcessing(req.id);
    try {
      await deleteVacationRequest(req.id, req.employeeId, user!.id);
      toast({ title: "Registro eliminado" });
      setManageRequest(null);
    } catch (e: any) { toast({ variant: "destructive", title: "Error al eliminar", description: e.message }); }
    finally { setIsProcessing(null); }
  };

  const handleBulkApprove = async () => {
    const toApprove = requests.filter(r => selectedIds.has(r.id) && r.status === "pending");
    if (toApprove.length === 0) return;
    setIsProcessing("bulk");
    for (const req of toApprove) {
      try { await approveVacationRequest(req.id, req.employeeId, user!.id); } catch (e) {}
    }
    toast({ title: "Acción masiva completada" });
    setSelectedIds(new Set());
    setIsProcessing(null);
  };

  const handleBulkDelete = async () => {
    const toDelete = requests.filter(r => selectedIds.has(r.id));
    if (toDelete.length === 0) return;
    if (!confirm(`¿Eliminar permanentemente ${toDelete.length} registros?`)) return;
    setIsProcessing("bulk");
    try {
      await bulkDeleteRequests(toDelete.map(r => ({ id: r.id, employeeId: r.employeeId })), user!.id);
      toast({ title: "Registros eliminados" });
      setSelectedIds(new Set());
    } catch (e) { toast({ variant: "destructive", title: "Error masivo" }); }
    finally { setIsProcessing(null); }
  };

  if (loading) return null;
  const pendingRequests = requests.filter(r => r.status === "pending");

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold font-headline">Admin v1.0.7</h1>
        </div>
        
        {selectedIds.size > 0 && (
          <div className="bg-primary/5 border border-primary/20 px-4 py-1 rounded-full flex items-center gap-3">
            <span className="text-xs font-bold text-primary">{selectedIds.size} seleccionados</span>
            <Button variant="ghost" size="sm" onClick={handleBulkApprove} disabled={!!isProcessing}><Check className="w-3 h-3 mr-1" /> Aprobar</Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} disabled={!!isProcessing}><Trash2 className="w-3 h-3 mr-1 text-destructive" /> Borrar</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())}><X className="w-4 h-4" /></Button>
          </div>
        )}
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <Tabs defaultValue="requests">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-12">
            <TabsTrigger value="requests">Solicitudes {pendingRequests.length > 0 && <Badge className="ml-2">{pendingRequests.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="employees">Personas</TabsTrigger>
            <TabsTrigger value="settings">Ajustes</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-6">
            <div className="grid gap-4">
              {pendingRequests.map((req) => {
                const emp = employees.find(e => e.id === req.employeeId);
                return (
                  <Card key={req.id} className="shadow-sm">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <Checkbox checked={selectedIds.has(req.id)} onCheckedChange={() => {
                            const newSet = new Set(selectedIds);
                            if (newSet.has(req.id)) newSet.delete(req.id); else newSet.add(req.id);
                            setSelectedIds(newSet);
                          }} />
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                              {req.type === 'vacation' ? <Plane className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold">{emp?.name || '...'}</p>
                              <p className="text-xs text-muted-foreground uppercase">{req.type} • {emp?.group}</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm font-bold">
                          {req.startDate?.toDate ? format(req.startDate.toDate(), 'dd MMM', {locale: es}) : '...'} - {req.endDate?.toDate ? format(req.endDate.toDate(), 'dd MMM', {locale: es}) : '...'}
                        </p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setRejectingRequest(req)}>Rechazar</Button>
                        <Button size="sm" onClick={() => handleApprove(req)} disabled={isProcessing === req.id}>
                          {isProcessing === req.id ? <Loader2 className="animate-spin w-4 h-4" /> : 'Aprobar'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <div className="mt-10 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5" /> Historial</h3>
                <Card className="border-none shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader><TableRow><TableHead></TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Periodo</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {requests.filter(r => r.status !== "pending").slice(0, 100).map((req) => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        return (
                          <TableRow key={req.id}>
                            <TableCell><Checkbox checked={selectedIds.has(req.id)} onCheckedChange={() => {
                              const newSet = new Set(selectedIds);
                              if (newSet.has(req.id)) newSet.delete(req.id); else newSet.add(req.id);
                              setSelectedIds(newSet);
                            }} /></TableCell>
                            <TableCell className="text-xs font-bold">{emp?.name || '...'}</TableCell>
                            <TableCell className="text-xs capitalize">{req.type}</TableCell>
                            <TableCell className="text-[10px]">{req.startDate?.toDate ? format(req.startDate.toDate(), 'dd/MM') : ''} - {req.endDate?.toDate ? format(req.endDate.toDate(), 'dd/MM') : ''}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{req.status}</Badge></TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setManageRequest(req)}><Pencil className="w-4 h-4" /></Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Personal</h3>
              <Dialog>
                <DialogTrigger asChild><Button><UserPlus className="mr-2 w-4 h-4" /> Nuevo</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Agregar Colaborador</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Nombre Completo</Label><Input value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>PIN (4 dígitos)</Label><Input type="password" maxLength={4} value={newEmployee.pin} onChange={e => setNewEmployee({...newEmployee, pin: e.target.value.replace(/\D/g, '')})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Saldo</Label><Input type="number" value={newEmployee.vacation_balance} onChange={e => setNewEmployee({...newEmployee, vacation_balance: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Grupo</Label><Select value={newEmployee.group} onValueChange={v => setNewEmployee({...newEmployee, group: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">Grupo A</SelectItem><SelectItem value="B">Grupo B</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="space-y-2"><Label>Parqueo</Label><Input value={newEmployee.parkingSpot} onChange={e => setNewEmployee({...newEmployee, parkingSpot: e.target.value})} placeholder="Ej: P-01" /></div>
                  </div>
                  <DialogFooter><Button onClick={handleCreateEmployee}>Guardar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Grupo</TableHead><TableHead>Saldo</TableHead><TableHead>Parqueo</TableHead><TableHead className="text-right">Edición</TableHead></TableRow></TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-bold">{emp.name}</TableCell>
                      <TableCell><Badge variant="secondary">Grupo {emp.group}</Badge></TableCell>
                      <TableCell className="text-primary font-bold">{emp.vacation_balance}d</TableCell>
                      <TableCell><Badge variant="outline"><Car className="w-3 h-3 mr-1" /> {emp.parkingSpot || 'S/N'}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => {
                        setEditingEmployee(emp);
                        setEditForm({ name: emp.name, balance: (emp.vacation_balance || 0).toString(), pin: "", group: emp.group, role: emp.role, parkingSpot: emp.parkingSpot || "" });
                      }}><Pencil className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <h3 className="text-2xl font-bold mb-4">Ajustes Globales</h3>
            <Card className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Lunes de Referencia</Label><Input type="date" value={newRefDate} onChange={e => setNewRefDate(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Patrón Semana 1</Label>
                  <Select value={newPattern} onValueChange={setNewPattern}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A_MWF">Grupo A: L-M-V</SelectItem>
                      <SelectItem value="B_MWF">Grupo B: L-M-V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={async () => {
                try {
                  await updateDoc(doc(db, "settings", "global"), {
                    week1_monday_date: new Date(newRefDate + "T12:00:00"),
                    week1Pattern: newPattern,
                    updatedAt: serverTimestamp()
                  });
                  toast({ title: "Guardado" });
                } catch (e) { toast({ variant: "destructive", title: "Error" }); }
              }}>Aplicar</Button>

              <div className="pt-6 border-t">
                <h4 className="font-bold mb-4">Acciones</h4>
                <Button variant="outline" onClick={async () => {
                  if (!confirm("Sumar 1.25 días a todos. ¿Continuar?")) return;
                  try {
                    const count = await accrueMonthlyVacation(user!.id);
                    toast({ title: "Devengo completado", description: `${count} personas actualizadas.` });
                  } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
                }}>Ejecutar Devengo Mensual (+1.25d)</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        <Dialog open={!!editingEmployee} onOpenChange={o => !o && setEditingEmployee(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Nombre</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Saldo</Label><Input type="number" step="0.01" value={editForm.balance} onChange={e => setEditForm({...editForm, balance: e.target.value})} /></div>
                <div className="space-y-2"><Label>Grupo</Label><Select value={editForm.group} onValueChange={v => setEditForm({...editForm, group: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">Grupo A</SelectItem><SelectItem value="B">Grupo B</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Parqueo</Label><Input value={editForm.parkingSpot} onChange={e => setEditForm({...editForm, parkingSpot: e.target.value})} /></div>
              <div className="pt-2 border-t">
                <p className="text-xs mb-2">PIN Actual: <span className="font-bold">{editingEmployee?.pin}</span></p>
                <Label>Cambiar PIN (Opcional)</Label>
                <Input type="password" maxLength={4} value={editForm.pin} onChange={e => setEditForm({...editForm, pin: e.target.value.replace(/\D/g, '')})} placeholder="****" />
              </div>
            </div>
            <DialogFooter><Button onClick={handleUpdateEmployee}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!manageRequest} onOpenChange={o => !o && setManageRequest(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Gestionar Solicitud</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-muted p-4 rounded-lg text-xs space-y-1">
                <p><strong>Colaborador:</strong> {employees.find(e => e.id === manageRequest?.employeeId)?.name}</p>
                <p><strong>Tipo:</strong> {manageRequest?.type}</p>
                <p><strong>Estado Actual:</strong> {manageRequest?.status}</p>
              </div>
              <div className="flex flex-col gap-3">
                {manageRequest?.status === 'approved' && (
                  <Button variant="outline" className="w-full text-amber-600" onClick={() => handleCancel(manageRequest)} disabled={!!isProcessing}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Cancelar (Devolver Saldo)
                  </Button>
                )}
                <Button variant="destructive" className="w-full" onClick={() => handleDeletePermanent(manageRequest)} disabled={!!isProcessing}>
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanentemente
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!rejectingRequest} onOpenChange={o => !o && setRejectingRequest(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rechazar Solicitud</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <Label>Motivo</Label>
              <Textarea value={rejectionComment} onChange={e => setRejectionComment(e.target.value)} />
            </div>
            <DialogFooter><Button variant="destructive" onClick={handleReject}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
