
import { startOfWeek, differenceInCalendarWeeks, isWeekend, isSameDay, addDays, format } from "date-fns";

export const normalizeDate = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getWeekType = (date: Date, baseMonday: Date): "Semana 1" | "Semana 2" => {
  const refMonday = startOfWeek(normalizeDate(baseMonday), { weekStartsOn: 1 });
  const currentMonday = startOfWeek(normalizeDate(date), { weekStartsOn: 1 });
  const weeksDiff = Math.abs(differenceInCalendarWeeks(currentMonday, refMonday, { weekStartsOn: 1 }));
  return weeksDiff % 2 === 0 ? "Semana 1" : "Semana 2";
};

export const calculateBusinessDays = (start: Date, end: Date, holidays: Date[], closures: Date[]) => {
  let count = 0;
  let current = normalizeDate(start);
  const finish = normalizeDate(end);

  while (current <= finish) {
    if (!isWeekend(current)) {
      const isHoliday = holidays.some(h => isSameDay(normalizeDate(h), current));
      const isClosure = closures.some(c => isSameDay(normalizeDate(c), current));
      if (!isHoliday && !isClosure) {
        count++;
      }
    }
    current = addDays(current, 1);
  }
  return count;
};

export const getWorkStatus = (
  date: Date,
  employee: any,
  settings: any,
  allRequests: any[]
): "CERRADO" | "VACACIONES" | "PERMISO" | "ENFERMO" | "OFICINA" | "HOME OFFICE" => {
  const d = normalizeDate(date);
  const dayOfWeek = d.getDay(); // 0 (Dom) a 6 (Sab)

  // 1. Fines de semana (No laborales)
  if (dayOfWeek === 0 || dayOfWeek === 6) return "CERRADO";

  // 2. Feriados / Cierres de oficina
  const isHoliday = (settings.holidays || []).some((h: any) => isSameDay(normalizeDate(h.toDate ? h.toDate() : h), d));
  const isClosure = (settings.office_closures || []).some((c: any) => isSameDay(normalizeDate(c.toDate ? c.toDate() : c), d));
  if (isHoliday || isClosure) return "CERRADO";

  // 3. Solicitudes aprobadas (FILTRADO ESTRICTO POR STATUS 'approved')
  const request = (allRequests || []).find(req => {
    if (req.status !== "approved") return false;
    const start = normalizeDate(req.startDate.toDate ? req.startDate.toDate() : req.startDate);
    const end = normalizeDate(req.endDate.toDate ? req.endDate.toDate() : req.endDate);
    return d >= start && d <= end;
  });

  if (request) {
    if (request.type === "vacation") return "VACACIONES";
    if (request.type === "permission") return "PERMISO";
    if (request.type === "sick") return "ENFERMO";
  }

  // 4. Regla Semanal (A/B)
  const weekType = getWeekType(d, settings.week1_monday_date?.toDate ? settings.week1_monday_date.toDate() : new Date("2025-03-03"));
  const group = employee.group;
  const pattern = settings.week1Pattern || "A_MWF";

  const isMWF = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
  const isTTh = dayOfWeek === 2 || dayOfWeek === 4;

  let mwfGroup: "A" | "B";
  
  if (weekType === "Semana 1") {
    mwfGroup = pattern === "A_MWF" ? "A" : "B";
  } else {
    mwfGroup = pattern === "A_MWF" ? "B" : "A";
  }

  if (group === mwfGroup) {
    return isMWF ? "OFICINA" : "HOME OFFICE";
  } else {
    return isTTh ? "OFICINA" : "HOME OFFICE";
  }
};
