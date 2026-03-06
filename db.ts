
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp, 
  runTransaction, 
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateBusinessDays } from "./date-utils";

export const normalizeName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, " ");

export const logAction = async (actorId: string, action: string, payload: any) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      actorEmployeeId: actorId,
      action,
      payload,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Failed to log audit", e);
  }
};

export const approveVacationRequest = async (requestId: string, employeeId: string, adminId: string) => {
  if (!employeeId || !requestId) throw new Error("Datos de solicitud incompletos.");
  
  return await runTransaction(db, async (transaction) => {
    const reqRef = doc(db, "employees", employeeId, "requests", requestId);
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Solicitud no encontrada en la base de datos.");
    
    const reqData = reqSnap.data();
    if (reqData.status !== "pending") throw new Error("La solicitud ya fue procesada previamente.");

    const empRef = doc(db, "employees", employeeId);
    const empSnap = await transaction.get(empRef);
    if (!empSnap.exists()) throw new Error("Empleado no encontrado.");
    const empData = empSnap.data();

    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await transaction.get(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};

    const startDate = reqData.startDate.toDate ? reqData.startDate.toDate() : new Date(reqData.startDate);
    const endDate = reqData.endDate.toDate ? reqData.endDate.toDate() : new Date(reqData.endDate);

    const days = calculateBusinessDays(
      startDate,
      endDate,
      (settings.holidays || []).map((h: any) => h.toDate ? h.toDate() : new Date(h)),
      (settings.office_closures || []).map((c: any) => c.toDate ? c.toDate() : new Date(c))
    );

    let discounted = false;
    if (reqData.type === "vacation") {
      if (empData.vacation_balance < days) {
        throw new Error(`Saldo insuficiente. Solicitado: ${days}, Disponible: ${empData.vacation_balance}`);
      }
      transaction.update(empRef, {
        vacation_balance: (empData.vacation_balance || 0) - days,
        updatedAt: serverTimestamp(),
      });
      discounted = true;
    }

    transaction.update(reqRef, {
      status: "approved",
      employeeId, 
      updatedAt: serverTimestamp(),
    });

    return { days, discounted, type: reqData.type };
  });
};

export const cancelVacationRequest = async (requestId: string, employeeId: string, adminId: string) => {
  if (!employeeId || !requestId) throw new Error("IDs de empleado o solicitud inválidos");

  return await runTransaction(db, async (transaction) => {
    const reqRef = doc(db, "employees", employeeId, "requests", requestId);
    const reqSnap = await transaction.get(reqRef);
    
    if (!reqSnap.exists()) throw new Error("La solicitud no existe.");
    
    const reqData = reqSnap.data();
    if (reqData.status === "cancelled") throw new Error("La solicitud ya está cancelada.");

    if (reqData.status === "approved" && reqData.type === "vacation") {
      const empRef = doc(db, "employees", employeeId);
      const empSnap = await transaction.get(empRef);
      
      if (empSnap.exists()) {
        const empData = empSnap.data();
        const settingsRef = doc(db, "settings", "global");
        const settingsSnap = await transaction.get(settingsRef);
        const settings = settingsSnap.exists() ? settingsSnap.data() : {};

        const startDate = reqData.startDate.toDate ? reqData.startDate.toDate() : new Date(reqData.startDate);
        const endDate = reqData.endDate.toDate ? reqData.endDate.toDate() : new Date(reqData.endDate);

        const days = calculateBusinessDays(
          startDate,
          endDate,
          (settings.holidays || []).map((h: any) => h.toDate ? h.toDate() : new Date(h)),
          (settings.office_closures || []).map((c: any) => c.toDate ? c.toDate() : new Date(c))
        );

        transaction.update(empRef, {
          vacation_balance: (empData.vacation_balance || 0) + days,
          updatedAt: serverTimestamp(),
        });
      }
    }

    transaction.update(reqRef, {
      status: "cancelled",
      updatedAt: serverTimestamp()
    });
    
    return true;
  }).then(async () => {
    await logAction(adminId, "REQUEST_CANCEL", { requestId, employeeId });
  });
};

export const deleteVacationRequest = async (requestId: string, employeeId: string, adminId: string) => {
  if (!employeeId || !requestId) throw new Error("No se puede eliminar: Faltan identificadores.");
  try {
    const reqRef = doc(db, "employees", employeeId, "requests", requestId);
    await deleteDoc(reqRef);
    await logAction(adminId, "REQUEST_PERMANENT_DELETE", { requestId, employeeId });
  } catch (e) {
    console.error("Delete error", e);
    throw e;
  }
};

export const accrueMonthlyVacation = async (adminId: string) => {
  const empsSnap = await getDocs(collection(db, "employees"));
  const batch = writeBatch(db);
  let count = 0;

  empsSnap.forEach((empDoc) => {
    const data = empDoc.data();
    if (data.active) {
      const currentBalance = data.vacation_balance || 0;
      const newBalance = Math.round((currentBalance + 1.25) * 100) / 100;
      const empRef = doc(db, "employees", empDoc.id);
      batch.update(empRef, {
        vacation_balance: newBalance,
        updatedAt: serverTimestamp()
      });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    await logAction(adminId, "MANUAL_MONTHLY_ACCRUAL", { count, increment: 1.25 });
  }

  return count;
};

export const bulkDeleteRequests = async (requests: {id: string, employeeId: string}[], adminId: string) => {
  const batch = writeBatch(db);
  requests.forEach(req => {
    const reqRef = doc(db, "employees", req.employeeId, "requests", req.id);
    batch.delete(reqRef);
  });
  await batch.commit();
  await logAction(adminId, "BULK_DELETE_REQUESTS", { count: requests.length });
};
