# Portal Lumen - Intranet RRHH

Este es el sistema interno para la gestión de vacaciones y permisos de Agencia Lumen, construido con Next.js 15, Firebase y Tailwind CSS.

## 📥 Cómo Descargar el Proyecto
Si estás viendo esto en el editor online:
1. Ve al menú superior izquierdo (tres líneas) > **Terminal** > **New Terminal**.
2. Ejecuta: `zip -r proyecto.zip . -x "node_modules/*" ".next/*" ".git/*"`
3. En el panel izquierdo (Explorador de archivos), busca `proyecto.zip`.
4. Haz **clic derecho** sobre él y selecciona **Download**.

## 🚀 Inicio Rápido (Local)
Una vez descargado y extraído en tu PC:
1. **Instala las dependencias**:
   ```bash
   npm install
   ```
2. **Inicia el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
3. Abre [http://localhost:9002](http://localhost:9002) en tu navegador.

## 🌐 Cómo Publicar Gratis (Firebase App Hosting)
1. **GitHub**: Sube este código a un repositorio en tu cuenta de GitHub.
2. **Firebase Console**:
   - Crea un proyecto en [Firebase](https://console.firebase.google.com/).
   - Ve a **Build** > **App Hosting**.
   - Conecta tu GitHub y selecciona el repositorio.
3. **Despliegue**: Firebase configurará automáticamente el dominio gratuito (ej. `lumen.web.app`).

## 🛠️ Funcionalidades
- **Dashboard**: Vista de días de oficina (L-V) y saldo de vacaciones.
- **Solicitudes**: Gestión de Vacaciones, Permisos y Enfermedades.
- **Panel Admin**: Botón directo en el inicio para aprobar/rechazar solicitudes y editar saldos.
- **Historial**: Seguimiento de respuestas y comentarios de RRHH.
