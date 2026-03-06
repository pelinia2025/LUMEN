
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  runTransaction, 
  orderBy 
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

export const getGlobalSettings = async () => {
  const docRef = doc(db, "settings", "global");
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() };
};

/**
 * Aprueba una solicitud de vacaciones y descuenta el saldo del empleado.
 * Sigue la estructura jerárquica /employees/{empId}/requests/{reqId}
 */
export const approveVacationRequest = async (requestId: string, employeeId: string, adminId: string) => {
  return await runTransaction(db, async (transaction) => {
    // Referencia a la solicitud en la subcolección
    const reqRef = doc(db, "employees", employeeId, "requests", requestId);
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Solicitud no encontrada");
    
    const reqData = reqSnap.data();
    if (reqData.status !== "pending") throw new Error("La solicitud ya fue procesada");

    // Referencia al empleado
    const empRef = doc(db, "employees", employeeId);
    const empSnap = await transaction.get(empRef);
    if (!empSnap.exists()) throw new Error("Empleado no encontrado");
    const empData = empSnap.data();

    // Referencia a configuración para días festivos
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

    // Si es vacación, descontar del saldo
    if (reqData.type === "vacation") {
      if (empData.vacation_balance < days) {
        throw new Error(`Saldo insuficiente. Solicitado: ${days}, Disponible: ${empData.vacation_balance}`);
      }
      transaction.update(empRef, {
        vacation_balance: empData.vacation_balance - days,
        updatedAt: serverTimestamp(),
      });
    }

    // Actualizar estado de la solicitud
    transaction.update(reqRef, {
      status: "approved",
      updatedAt: serverTimestamp(),
    });

    return { days };
  });
};
