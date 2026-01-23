# 📋 Cheatsheet - Referencia Rápida de Código

## 🎯 FETCH API - Hacer Peticiones HTTP

### GET - Obtener datos
```javascript
// Petición GET simple
async function obtenerDatos() {
    const response = await fetch('http://localhost:3000/api/members');
    const data = await response.json();
    console.log(data);
}

// GET con autenticación (token)
async function obtenerDatosAuth() {
    const token = localStorage.getItem('token');
    
    const response = await fetch('http://localhost:3000/api/auth/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const data = await response.json();
    console.log(data);
}
```

### POST - Enviar datos
```javascript
// Login (POST)
async function login(username, password) {
    const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    });
    
    const data = await response.json();
    
    if (response.ok) {
        // Éxito
        localStorage.setItem('token', data.token);
        console.log('Login exitoso');
    } else {
        // Error
        console.error('Login falló:', data.error);
    }
}
```

### PUT - Actualizar datos
```javascript
async function actualizarPerfil(userId, nuevosDatos) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`http://localhost:3000/api/members/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nuevosDatos)
    });
    
    const data = await response.json();
    return data;
}
```

### DELETE - Eliminar datos
```javascript
async function eliminarMiembro(userId) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`http://localhost:3000/api/members/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    return response.ok;
}
```

---

## ⚡ SOCKET.IO - Tiempo Real

### Conexión básica
```javascript
// 1. Incluir la librería en el HTML
// <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

// 2. Conectar
const socket = io('http://localhost:3000', {
    auth: {
        token: localStorage.getItem('token')
    }
});

// 3. Eventos de conexión
socket.on('connect', () => {
    console.log('✅ Conectado');
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado');
});
```

### Escuchar eventos
```javascript
// Escuchar evento del servidor
socket.on('nombre_del_evento', (data) => {
    console.log('Datos recibidos:', data);
    // Actualizar la interfaz
});

// Ejemplos del proyecto DKP
socket.on('dkp_updated', (data) => {
    console.log(`DKP actualizado: ${data.amount}`);
    document.getElementById('currentDKP').textContent = data.newDkp;
});

socket.on('auction_started', (auction) => {
    alert(`¡Nueva subasta! ${auction.item_name}`);
});

socket.on('bid_placed', (bidData) => {
    console.log(`${bidData.characterName} pujó ${bidData.amount}`);
});
```

### Emitir eventos (enviar al servidor)
```javascript
// Enviar evento al servidor
socket.emit('nombre_del_evento', { datos: 'aquí' });

// Ejemplo: Unirse a una sala
socket.emit('join_room', { room: 'auction' });

// Ejemplo: Enviar mensaje
socket.emit('send_message', { 
    message: 'Hola mundo',
    userId: 123
});
```

---

## 🎨 BOOTSTRAP - Clases CSS

### Layout y Grid
```html
<!-- Contenedor centrado -->
<div class="container">
    <!-- Contenido aquí -->
</div>

<!-- Contenedor de ancho completo -->
<div class="container-fluid">
    <!-- Contenido aquí -->
</div>

<!-- Sistema de Grid (12 columnas) -->
<div class="row">
    <div class="col-md-6">50% en pantallas medianas</div>
    <div class="col-md-6">50% en pantallas medianas</div>
</div>

<div class="row">
    <div class="col-md-4">33.33%</div>
    <div class="col-md-4">33.33%</div>
    <div class="col-md-4">33.33%</div>
</div>

<div class="row">
    <div class="col-md-8">66.66%</div>
    <div class="col-md-4">33.33%</div>
</div>
```

### Botones
```html
<!-- Colores -->
<button class="btn btn-primary">Azul</button>
<button class="btn btn-secondary">Gris</button>
<button class="btn btn-success">Verde</button>
<button class="btn btn-danger">Rojo</button>
<button class="btn btn-warning">Amarillo</button>
<button class="btn btn-info">Cyan</button>

<!-- Tamaños -->
<button class="btn btn-primary btn-lg">Grande</button>
<button class="btn btn-primary">Normal</button>
<button class="btn btn-primary btn-sm">Pequeño</button>

<!-- Outline (solo borde) -->
<button class="btn btn-outline-primary">Outline Azul</button>

<!-- Ancho completo -->
<button class="btn btn-primary w-100">Ancho completo</button>
```

### Formularios
```html
<!-- Input básico -->
<div class="mb-3">
    <label for="username" class="form-label">Usuario</label>
    <input type="text" class="form-control" id="username" placeholder="Tu usuario">
</div>

<!-- Input con icono (usando Font Awesome) -->
<div class="mb-3">
    <label class="form-label">
        <i class="fas fa-user"></i> Usuario
    </label>
    <input type="text" class="form-control">
</div>

<!-- Select (desplegable) -->
<div class="mb-3">
    <label class="form-label">Clase</label>
    <select class="form-select">
        <option value="">-- Selecciona --</option>
        <option value="warrior">Warrior</option>
        <option value="mage">Mage</option>
    </select>
</div>

<!-- Textarea -->
<div class="mb-3">
    <label class="form-label">Comentarios</label>
    <textarea class="form-control" rows="3"></textarea>
</div>

<!-- Checkbox -->
<div class="form-check">
    <input class="form-check-input" type="checkbox" id="acepto">
    <label class="form-check-label" for="acepto">
        Acepto los términos
    </label>
</div>
```

### Tarjetas (Cards)
```html
<div class="card">
    <div class="card-header">
        Título de la tarjeta
    </div>
    <div class="card-body">
        <h5 class="card-title">Título</h5>
        <p class="card-text">Contenido de la tarjeta</p>
        <button class="btn btn-primary">Acción</button>
    </div>
</div>
```

### Alertas
```html
<div class="alert alert-success">¡Operación exitosa!</div>
<div class="alert alert-danger">Error: algo salió mal</div>
<div class="alert alert-warning">Advertencia: ten cuidado</div>
<div class="alert alert-info">Información: esto es útil</div>
```

### Badges (Etiquetas)
```html
<span class="badge bg-primary">Nuevo</span>
<span class="badge bg-success">Activo</span>
<span class="badge bg-danger">Inactivo</span>
<span class="badge bg-warning text-dark">Pendiente</span>
```

### Tablas
```html
<table class="table">
    <thead>
        <tr>
            <th>Nombre</th>
            <th>Clase</th>
            <th>DKP</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Thrall</td>
            <td>Shaman</td>
            <td>450</td>
        </tr>
    </tbody>
</table>

<!-- Variantes -->
<table class="table table-striped">Rayas alternadas</table>
<table class="table table-hover">Hover al pasar mouse</table>
<table class="table table-bordered">Con bordes</table>
```

### Espaciado
```html
<!-- Margin (m) -->
<div class="m-3">Margin en todos lados: 3</div>
<div class="mt-3">Margin top: 3</div>
<div class="mb-3">Margin bottom: 3</div>
<div class="ms-3">Margin start (izquierda): 3</div>
<div class="me-3">Margin end (derecha): 3</div>

<!-- Padding (p) -->
<div class="p-3">Padding en todos lados: 3</div>
<div class="pt-3">Padding top: 3</div>
<div class="pb-3">Padding bottom: 3</div>

<!-- Números: 0, 1, 2, 3, 4, 5 -->
```

### Utilidades
```html
<!-- Texto -->
<p class="text-center">Texto centrado</p>
<p class="text-start">Texto a la izquierda</p>
<p class="text-end">Texto a la derecha</p>

<p class="text-primary">Texto azul</p>
<p class="text-success">Texto verde</p>
<p class="text-danger">Texto rojo</p>
<p class="text-muted">Texto gris claro</p>

<!-- Fondos -->
<div class="bg-primary text-white">Fondo azul</div>
<div class="bg-success text-white">Fondo verde</div>
<div class="bg-danger text-white">Fondo rojo</div>

<!-- Display -->
<div class="d-none">Oculto</div>
<div class="d-block">Visible como bloque</div>
<div class="d-flex">Flexbox</div>
```

---

## 📝 DOM MANIPULATION - Manipular HTML con JavaScript

### Obtener elementos
```javascript
// Por ID (más común)
const elemento = document.getElementById('miElemento');

// Por clase
const elementos = document.getElementsByClassName('miClase');

// Por selector CSS (más flexible)
const elemento = document.querySelector('.clase');
const elementos = document.querySelectorAll('.clase');

// Ejemplos
const username = document.getElementById('username');
const botones = document.querySelectorAll('.btn');
const primerBoton = document.querySelector('.btn');
```

### Cambiar contenido
```javascript
// Cambiar texto
elemento.textContent = 'Nuevo texto';

// Cambiar HTML interno
elemento.innerHTML = '<strong>Texto en negrita</strong>';

// Cambiar valor de input
document.getElementById('username').value = 'nuevoValor';

// Obtener valor de input
const valor = document.getElementById('username').value;
```

### Cambiar estilos y clases
```javascript
// Cambiar estilo directo
elemento.style.color = 'red';
elemento.style.backgroundColor = 'blue';
elemento.style.display = 'none'; // Ocultar
elemento.style.display = 'block'; // Mostrar

// Agregar clase
elemento.classList.add('clase-nueva');

// Quitar clase
elemento.classList.remove('clase-vieja');

// Toggle (agregar si no existe, quitar si existe)
elemento.classList.toggle('activo');

// Verificar si tiene clase
if (elemento.classList.contains('activo')) {
    console.log('Está activo');
}
```

### Eventos
```javascript
// Click
document.getElementById('miBoton').addEventListener('click', function() {
    alert('¡Hiciste click!');
});

// Submit de formulario
document.getElementById('miForm').addEventListener('submit', function(event) {
    event.preventDefault(); // ¡IMPORTANTE! Evita recargar la página
    console.log('Formulario enviado');
});

// Cambio en input
document.getElementById('username').addEventListener('input', function(event) {
    console.log('Nuevo valor:', event.target.value);
});

// Tecla presionada
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        console.log('Enter presionado');
    }
});
```

### Crear y eliminar elementos
```javascript
// Crear nuevo elemento
const nuevoDiv = document.createElement('div');
nuevoDiv.textContent = 'Soy nuevo';
nuevoDiv.classList.add('mi-clase');

// Agregar al DOM
document.body.appendChild(nuevoDiv);

// Insertar antes de otro elemento
const padre = document.getElementById('contenedor');
padre.insertBefore(nuevoDiv, padre.firstChild);

// Eliminar elemento
elemento.remove();
```

---

## 💾 LOCALSTORAGE - Guardar Datos en el Navegador

```javascript
// Guardar
localStorage.setItem('clave', 'valor');
localStorage.setItem('token', 'abc123xyz');

// Obtener
const token = localStorage.getItem('token');
console.log(token); // 'abc123xyz'

// Verificar si existe
if (localStorage.getItem('token')) {
    console.log('Hay token guardado');
}

// Eliminar
localStorage.removeItem('token');

// Eliminar todo
localStorage.clear();

// Guardar objetos (hay que convertir a JSON)
const usuario = { nombre: 'Juan', edad: 25 };
localStorage.setItem('usuario', JSON.stringify(usuario));

// Obtener objetos (hay que parsear de JSON)
const usuarioGuardado = JSON.parse(localStorage.getItem('usuario'));
console.log(usuarioGuardado.nombre); // 'Juan'
```

---

## 🔄 ASYNC/AWAIT vs PROMISES

```javascript
// Con Promises (.then)
function obtenerDatos() {
    fetch('http://localhost:3000/api/members')
        .then(response => response.json())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Con async/await (más fácil de leer)
async function obtenerDatos() {
    try {
        const response = await fetch('http://localhost:3000/api/members');
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Regla: Si usas await, la función debe ser async
```

---

## 🛡️ TRY-CATCH - Manejo de Errores

```javascript
try {
    // Código que puede fallar
    const data = JSON.parse('texto inválido');
} catch (error) {
    // Si falla, viene aquí
    console.error('Error:', error.message);
} finally {
    // Esto SIEMPRE se ejecuta (opcional)
    console.log('Terminó el try-catch');
}

// Con async/await
async function login() {
    try {
        const response = await fetch('...');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error en login:', error);
        return null;
    }
}
```

---

## 🎯 TEMPLATE LITERALS - Strings con Variables

```javascript
// Vieja forma
const nombre = 'Juan';
const mensaje = 'Hola ' + nombre + ', ¿cómo estás?';

// Nueva forma (template literals)
const nombre = 'Juan';
const mensaje = `Hola ${nombre}, ¿cómo estás?`;

// Con expresiones
const a = 5;
const b = 10;
console.log(`${a} + ${b} = ${a + b}`); // "5 + 10 = 15"

// Multi-línea
const html = `
    <div>
        <h1>${titulo}</h1>
        <p>${contenido}</p>
    </div>
`;
```

---

**¡Guarda esta hoja de referencia para consultarla cuando codifiques! 📚**
