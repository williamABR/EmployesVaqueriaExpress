# 🤖 WhatsApp Receipt Bot

Bot de WhatsApp para control de tiquetes de restaurante con:
- 📸 Lectura automática de tiquetes con IA (Claude Vision)
- 👤 Solicitud de nombre del comprador en celulares compartidos
- ✅ Flujo de aprobación/rechazo por el administrador
- 🔁 Detección automática de tiquetes duplicados
- 📊 Reportes mensuales por empleado

---

## 📁 Estructura

```
whatsapp-receipt-bot/
├── src/
│   ├── index.js                  # Servidor Express
│   ├── db.js                     # Conexión MongoDB Atlas
│   ├── models/
│   │   ├── Employee.js           # Empleados registrados
│   │   ├── Receipt.js            # Tiquetes (con estado y hash)
│   │   └── Session.js            # Sesiones temporales (TTL 30 min)
│   ├── routes/
│   │   └── webhook.js            # Lógica completa de mensajes
│   ├── services/
│   │   ├── claude.js             # Análisis de imágenes con IA
│   │   ├── whatsapp.js           # Envío de mensajes
│   │   └── receiptService.js     # Guardado con deduplicación
│   └── utils/
│       └── hash.js               # Hash SHA-256 para deduplicar
├── scripts/
│   ├── seedEmployees.js          # Registrar empleados en la BD
│   └── report.js                 # Reportes mensuales
├── .env.example
└── package.json
```

---

## 🚀 Instalación

```bash
npm install
cp .env.example .env
# Edita .env con tus credenciales
```

---

## ⚙️ Variables de entorno

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic |
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas |
| `WHATSAPP_TOKEN` | Token de acceso de Meta for Developers |
| `WHATSAPP_PHONE_ID` | ID del número de teléfono de WhatsApp Business |
| `WEBHOOK_VERIFY_TOKEN` | Token inventado por ti para verificar el webhook |
| `ADMIN_PHONE` | Número del administrador (sin +, ej: 573001234567) |
| `PORT` | Puerto del servidor (default: 3000) |

---

## 👥 Registrar empleados

Edita `scripts/seedEmployees.js`:

```js
const EMPLEADOS = [
  // Celular personal → el empleado es el comprador
  { nombre: 'Carlos Martínez', telefono: '573001234567', cargo: 'Mesero', requiresBuyerName: false },

  // Celular compartido → el bot pregunta quién compró
  { nombre: 'Caja Principal', telefono: '573005551234', cargo: 'Caja', requiresBuyerName: true },
];
```

```bash
npm run seed
```

---

## 🔄 Flujos del bot

### Celular personal (`requiresBuyerName: false`)
```
Empleado envía foto
  → Claude lee el tiquete
  → Se guarda como PENDIENTE
  → Empleado recibe confirmación
  → Admin recibe notificación con botones APROBAR/RECHAZAR
```

### Celular compartido (`requiresBuyerName: true`)
```
Empleado envía foto
  → Claude lee el tiquete
  → Bot pregunta: "¿Quién hizo la compra?"
  → Empleado responde con el nombre
  → Se guarda como PENDIENTE con el nombre del comprador
  → Admin recibe notificación
```

### Tiquete duplicado
```
Empleado envía tiquete ya registrado
  → Bot responde: "Este tiquete ya fue registrado el [fecha]"
  → No se guarda nada
```

---

## 👨‍💼 Comandos del administrador

El número configurado en `ADMIN_PHONE` puede responder:

```
APROBAR 507f1f77bcf86cd799439011
RECHAZAR 507f1f77bcf86cd799439011 el total no cuadra
```

- Al aprobar/rechazar, el empleado recibe una notificación automática.
- Si escribe cualquier otra cosa, el bot le muestra cuántos tiquetes están pendientes.

---

## 📊 Reportes

```bash
# Mes actual (todos los estados)
npm run report

# Mes específico
node scripts/report.js 2026-03

# Solo aprobados
node scripts/report.js 2026-03 --aprobados

# Solo pendientes
node scripts/report.js 2026-03 --pendientes

# Solo rechazados
node scripts/report.js 2026-03 --rechazados
```

---

## ☁️ MongoDB Atlas (configuración)

1. Crea cuenta en [mongodb.com/atlas](https://cloud.mongodb.com)
2. Crea un cluster gratuito M0
3. **Database Access** → crea usuario con contraseña
4. **Network Access** → agrega `0.0.0.0/0`
5. **Connect > Drivers** → copia la URI y pégala en `MONGODB_URI`

---

## 📱 WhatsApp Business API (Meta)

1. Ve a [developers.facebook.com](https://developers.facebook.com) → Crear app → Business
2. Agrega el producto **WhatsApp**
3. Copia el **Token de acceso** y el **ID del número de teléfono**
4. En **Configuración del Webhook**:
   - URL: `https://TU_DOMINIO/webhook`
   - Token de verificación: el valor de `WEBHOOK_VERIFY_TOKEN`
   - Suscríbete a: `messages`

> Para desarrollo local usa [ngrok](https://ngrok.com): `ngrok http 3000`

---

## 🚢 Despliegue en producción

Opciones con plan gratuito:

| Plataforma | Comando |
|---|---|
| Railway | `railway up` |
| Render | Conecta repositorio en GitHub |
| Fly.io | `fly launch` |

Configura las variables de entorno en la plataforma elegida.
