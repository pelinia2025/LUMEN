
import { initializeFirebase } from "@/firebase";

// Obtenemos las instancias inicializadas correctamente por el sistema de Studio
const { firestore: db, auth } = initializeFirebase();

export { db, auth };
