# Instrucciones para Renombrar Repositorio

**Objetivo**: Cambiar el nombre del repositorio de `dkp-backend` a `pew-pew-dkp`

---

## 📋 Estado Actual

- **Repositorio local**: Actualizado y funcionando
- **Docker**: Contenedor corriendo en puerto 3000 ✅
- **Branch**: master
- **Último commit**: `8fb62d0` - docs: Add frontend update summary

---

## 🔄 Pasos para Renombrar (Manual en GitHub)

### 1. En GitHub.com

1. Ve a: https://github.com/ChristianYepesGomez/dkp-backend
2. Click en **Settings** (⚙️)
3. En la sección superior, encuentra **Repository name**
4. Cambia `dkp-backend` por `pew-pew-dkp`
5. Click en **Rename**
6. GitHub te mostrará una advertencia - confirma el cambio

⚠️ **Nota**: GitHub creará automáticamente un redirect de la URL antigua a la nueva, así que no romperá links existentes.

---

## 💻 Actualización Local (Después del Rename)

Una vez que hayas cambiado el nombre en GitHub, ejecuta estos comandos:

```bash
# 1. Actualizar la URL remota
git remote set-url origin https://github.com/ChristianYepesGomez/pew-pew-dkp.git

# 2. Verificar que se actualizó correctamente
git remote -v

# 3. Hacer un test de conexión
git fetch origin

# 4. (Opcional) Renombrar el directorio local
# cd ..
# mv dkp-backend pew-pew-dkp
# cd pew-pew-dkp
```

---

## 📝 Archivos que Necesitan Actualización

Después del rename, estos archivos/configuraciones necesitan ser actualizados:

### Docker Compose
- `docker-compose.yml` - Nombres de servicios y containers
- Network name: `dkp-backend_dkp-network` → `pew-pew-dkp_dkp-network`
- Container name: `dkp-backend` → `pew-pew-dkp`

### Documentación
- `README.md` - Título y referencias al repositorio
- `FRONTEND_UPDATE_SUMMARY.md` - Referencias a rutas
- `DEPLOY.md` - Instrucciones de deployment
- `DKP_PROJECT_DOCUMENTATION.md` - Nombre del proyecto

### Otros
- Package.json - `name` field (si existe)
- Referencias en comentarios de código
- URLs en archivos de configuración

---

## ✅ Checklist Post-Rename

Después de completar el rename y las actualizaciones:

- [ ] Git remote apunta a la nueva URL
- [ ] Git fetch/pull funciona correctamente
- [ ] Git push funciona correctamente
- [ ] Docker Compose funciona con nuevo nombre
- [ ] README actualizado
- [ ] Documentación actualizada
- [ ] Commit de todos los cambios
- [ ] Push al repositorio renombrado

---

## 🎯 Comando Rápido de Verificación

```bash
# Verificar todo está OK
git remote -v && \
docker-compose ps && \
echo "✅ Todo listo!"
```

---

**Fecha**: 2026-01-23
**Preparado por**: Claude Sonnet 4.5
