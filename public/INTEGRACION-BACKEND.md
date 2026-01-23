# 🔗 Guía de Integración Frontend-Backend

## 📋 Objetivo

Conectar el frontend (páginas HTML) con el backend Node.js del repositorio https://github.com/ChristianYepesGomez/DKP

---

## 🎯 Pasos de Integración

### Paso 1: Configurar el Backend

1. **Clonar el repositorio del backend:**
```bash
git clone https://github.com/ChristianYepesGomez/DKP.git
cd DKP
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env y cambiar JWT_SECRET
```

4. **Iniciar el servidor:**
```bash
npm start
```

Debe mostrar:
```
✓ Database initialized
✓ Server running on port 3000
```

---

### Paso 2: Habilitar CORS en el Backend

El backend debe permitir peticiones desde el frontend.

**Archivo:** `server.js` (en el repositorio del backend)

**Agregar al inicio:**
```javascript
const cors = require('cors');

// Configurar CORS
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true
}));
```

**Si no está instalado cors:**
```bash
npm install cors
```

---

### Paso 3: Actualizar URLs en el Frontend

En **cada archivo HTML** del frontend, buscar y reemplazar:

```javascript
// ANTES (datos de prueba)
const API_URL = 'http://localhost:3000/api';

// DESPUÉS (conexión real)
const API_URL = 'http://localhost:3000/api';
```

Para Socket.IO:
```javascript
// ANTES
const SOCKET_URL = 'http://localhost:3000';

// DESPUÉS (igual, pero ahora el servidor debe estar corriendo)
const SOCKET_URL = 'http://localhost:3000';
```

---

## 🔧 Modificaciones en el Frontend

### 1. Login (login.html)

**Estado actual:** Usa datos fake
**Cambio necesario:** Ya está preparado para usar fetch real

El código actual YA hace la petición real:
```javascript
const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        username: username,
        password: password
    })
});
```

**✅ No necesita cambios**, solo asegurarse que el backend esté corriendo.

---

### 2. Dashboard (index.html)

**Estado actual:** Usa datos hardcodeados
**Cambio necesario:** Reemplazar datos fake por fetch real

#### 🔄 Cargar DKP del Usuario

**Buscar esta función:**
```javascript
function mostrarTransacciones() {
    const contenedor = document.getElementById('transactionsList');
    let html = '';
    
    // Actualmente usa datosDePrueba.transacciones
    datosDePrueba.transacciones.forEach(transaccion => {
        // ...
    });
}
```

**Reemplazar por:**
```javascript
async function cargarDatosUsuario() {
    const token = localStorage.getItem('token');
    
    // Obtener info del usuario
    const responseUser = await fetch(`${API_URL}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const userData = await responseUser.json();
    
    // Obtener DKP e historial
    const responseDKP = await fetch(`${API_URL}/dkp/history/${userData.id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const dkpData = await responseDKP.json();
    
    // Actualizar la UI
    document.getElementById('currentDKP').textContent = dkpData.currentDkp;
    document.querySelector('.class-shaman').textContent = userData.character_name;
    
    // Mostrar transacciones
    mostrarTransacciones(dkpData.transactions);
}

function mostrarTransacciones(transacciones) {
    const contenedor = document.getElementById('transactionsList');
    let html = '';
    
    transacciones.forEach(transaccion => {
        const esPositivo = transaccion.amount > 0;
        const claseColor = esPositivo ? 'amount-positive' : 'amount-negative';
        const signo = esPositivo ? '+' : '';
        
        const fecha = new Date(transaccion.created_at);
        const fechaTexto = fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="transaction-row">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${transaccion.reason}</strong>
                        <br>
                        <small style="color: #a5b4fc;">${fechaTexto}</small>
                    </div>
                    <div>
                        <span class="${claseColor}">
                            ${signo}${transaccion.amount} DKP
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    
    contenedor.innerHTML = html;
}

// Llamar en window.onload
window.addEventListener('load', function() {
    cargarDatosUsuario();
});
```

---

### 3. Subasta Activa

**Buscar:**
```javascript
function showBidModal() {
    const puja = prompt('¿Cuánto DKP quieres pujar?', '400');
    // ...
}
```

**Reemplazar por:**
```javascript
async function showBidModal() {
    const puja = prompt('¿Cuánto DKP quieres pujar? (Mínimo: 381)', '400');
    
    if (puja && !isNaN(puja)) {
        const cantidad = parseInt(puja);
        
        if (cantidad > 380) {
            const token = localStorage.getItem('token');
            
            try {
                // Obtener ID de la subasta activa
                const responseAuction = await fetch(`${API_URL}/auctions/active`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const auction = await responseAuction.json();
                
                // Enviar puja
                const response = await fetch(`${API_URL}/auctions/${auction.id}/bid`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: cantidad })
                });
                
                if (response.ok) {
                    alert(`✅ ¡Puja realizada! Has pujado ${cantidad} DKP`);
                } else {
                    const error = await response.json();
                    alert(`❌ Error: ${error.error}`);
                }
            } catch (error) {
                console.error('Error al pujar:', error);
                alert('❌ Error de conexión');
            }
        } else {
            alert('❌ La puja debe ser mayor a 380 DKP');
        }
    }
}
```

---

### 4. Socket.IO (Tiempo Real)

**Buscar:**
```javascript
// No hay conexión real actualmente
```

**Agregar:**
```javascript
// Al inicio del script
const socket = io(SOCKET_URL, {
    auth: {
        token: localStorage.getItem('token')
    }
});

// Eventos
socket.on('connect', () => {
    console.log('✅ Conectado a Socket.IO');
});

socket.on('dkp_updated', (data) => {
    console.log('💰 DKP actualizado:', data);
    
    // Recargar datos del usuario
    cargarDatosUsuario();
});

socket.on('bid_placed', (bidData) => {
    console.log('💵 Nueva puja:', bidData);
    
    // Actualizar lista de pujas
    cargarPujasActivas();
});

socket.on('auction_started', (auction) => {
    console.log('🎉 Nueva subasta:', auction);
    alert(`¡Nueva subasta! ${auction.item_name}`);
});

socket.on('auction_ended', (result) => {
    console.log('🏆 Subasta finalizada:', result);
    alert(`Subasta finalizada. Ganador: ${result.winner ? result.winner.characterName : 'Ninguno'}`);
});
```

---

### 5. Miembros (members.html)

**Buscar:**
```javascript
const miembrosDePrueba = [
    { nombre: 'Thrall', clase: 'Shaman', ... }
];
```

**Reemplazar por:**
```javascript
async function cargarMiembros() {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/members`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const miembros = await response.json();
    
    // Transformar formato del backend al formato del frontend
    miembrosFiltrados = miembros.map(m => ({
        nombre: m.character_name,
        clase: m.character_class,
        rol: m.raid_role,
        dkp: m.current_dkp || 0,
        ganado: m.lifetime_gained || 0,
        gastado: m.lifetime_spent || 0,
        activo: m.is_active
    }));
    
    renderizarTabla(miembrosFiltrados);
}

// Llamar al cargar la página
window.addEventListener('load', function() {
    cargarMiembros();
});
```

---

### 6. Subastas (auctions.html)

**Buscar:**
```javascript
const subastasDePrueba = [
    { objeto: 'Thunderfury', ... }
];
```

**Reemplazar por:**
```javascript
async function cargarSubastas() {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/auctions/history`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const subastas = await response.json();
    
    // Transformar formato
    subastasFiltradas = subastas.map(s => ({
        id: s.id,
        objeto: s.item_name,
        rareza: s.item_rarity || 'epic',
        estado: s.status,
        pujaMinima: s.min_bid,
        pujaGanadora: s.winning_bid,
        ganador: s.winner ? s.winner.character_name : null,
        ganadorClase: s.winner ? s.winner.character_class : null,
        fecha: s.created_at,
        totalPujas: s.bid_count || 0
    }));
    
    renderizarSubastas(subastasFiltradas);
}

window.addEventListener('load', function() {
    cargarSubastas();
});
```

---

## 📝 Formato de Respuestas del Backend

### GET /api/auth/me
```json
{
    "id": 1,
    "username": "thrall",
    "character_name": "Thrall",
    "character_class": "Shaman",
    "raid_role": "Healer",
    "role": "raider",
    "is_active": true
}
```

### GET /api/dkp/history/:userId
```json
{
    "currentDkp": 450,
    "lifetimeGained": 1250,
    "lifetimeSpent": 800,
    "lastDecay": "2025-01-15T00:00:00.000Z",
    "transactions": [
        {
            "amount": 50,
            "reason": "Raid: Molten Core",
            "created_at": "2025-01-20T20:00:00.000Z"
        }
    ]
}
```

### GET /api/members
```json
[
    {
        "id": 1,
        "character_name": "Thrall",
        "character_class": "Shaman",
        "raid_role": "Healer",
        "role": "raider",
        "is_active": true,
        "current_dkp": 450,
        "lifetime_gained": 1250,
        "lifetime_spent": 800
    }
]
```

### GET /api/auctions/active
```json
{
    "id": 1,
    "item_name": "Thunderfury, Blessed Blade of the Windseeker",
    "item_rarity": "legendary",
    "min_bid": 100,
    "status": "active",
    "current_highest_bid": 380,
    "bids": [
        {
            "user_id": 2,
            "character_name": "Arthas",
            "amount": 380,
            "created_at": "2025-01-23T12:00:00.000Z"
        }
    ]
}
```

---

## 🧪 Testing

### 1. Verificar Backend
```bash
# En el directorio del backend
npm start

# Debe mostrar:
# ✓ Server running on port 3000
```

### 2. Probar Login
```bash
# Abrir frontend
python -m http.server 8080

# Ir a http://localhost:8080/login.html
# Intentar login con:
# Username: admin
# Password: admin123
```

### 3. Verificar Socket.IO
Abrir consola del navegador (F12):
```
✅ Conectado a Socket.IO
```

### 4. Probar Transacciones
- Ver el historial de DKP
- Verificar que los datos vienen del backend
- Hacer una puja en una subasta

---

## ⚠️ Problemas Comunes

### CORS Error
```
Access to fetch blocked by CORS policy
```
**Solución:** Agregar `cors` en el backend (ver Paso 2)

### 401 Unauthorized
```
Status 401: Unauthorized
```
**Solución:** El token expiró o es inválido. Hacer logout y login de nuevo.

### Socket.IO no conecta
```
❌ Desconectado de Socket.IO
```
**Solución:** 
1. Verificar que el backend esté corriendo
2. Verificar SOCKET_URL en el frontend
3. Ver logs del servidor

### No aparecen datos
**Solución:**
1. Abrir consola del navegador (F12)
2. Ver errores en rojo
3. Verificar que las URLs sean correctas
4. Comprobar que el backend responda: `curl http://localhost:3000/api/members`

---

## 📦 Archivos a Modificar (Resumen)

| Archivo | Cambios |
|---------|---------|
| `login.html` | ✅ Ya funciona con backend |
| `register.html` | ✅ Ya funciona con backend |
| `index.html` | 🔄 Reemplazar datos fake por fetch |
| `members.html` | 🔄 Reemplazar datos fake por fetch |
| `auctions.html` | 🔄 Reemplazar datos fake por fetch |

---

## ✅ Checklist de Integración

- [ ] Backend instalado y corriendo (puerto 3000)
- [ ] CORS configurado en el backend
- [ ] Frontend corriendo (puerto 8080)
- [ ] Login funciona (guarda token en localStorage)
- [ ] Dashboard muestra datos reales del usuario
- [ ] Socket.IO conectado (ver consola)
- [ ] Pujas funcionan
- [ ] Lista de miembros carga desde backend
- [ ] Historial de subastas carga desde backend

---

**¡Buena suerte con la integración! 🚀**
