# Calendario de Outlook — puesta en marcha (Fase 3)

Con esto el formulario de registro llega con las reuniones del día ya
cargadas: duración desde la agenda y proyecto sugerido cuando se reconoce.

**Esta parte no se puede hacer desde el repositorio.** Los pasos 1 y 2 los
ejecuta quien administre Microsoft 365 en la consola de Azure/Entra ID; del
paso 3 en adelante ya es la plataforma.

---

## 1. Registración de aplicación en Entra ID

En **portal.azure.com → Microsoft Entra ID → Registros de aplicaciones →
Nuevo registro**:

| Campo | Valor |
|---|---|
| Nombre | `Sábana de trabajo — lectura de calendario` |
| Tipos de cuenta | Solo este directorio organizativo |
| URI de redirección | *(ninguno — no hay inicio de sesión de usuario)* |

Luego, en **Permisos de API → Agregar permiso → Microsoft Graph → Permisos de
aplicación**:

- `Calendars.Read`

Y **Conceder consentimiento del administrador**. Sin ese botón el permiso
queda solicitado pero no vigente, que es el error más común de este paso.

En **Certificados y secretos → Nuevo secreto de cliente**: copiar el
**Valor** (no el Id.) apenas se cree — después ya no se puede volver a ver.

De la pantalla **Información general** se necesitan el **Id. de aplicación
(cliente)** y el **Id. de directorio (inquilino)**.

## 2. Acotar el alcance (Application Access Policy)

**Este paso no es opcional.** `Calendars.Read` como permiso de aplicación da
acceso al calendario de **todos los buzones del tenant**, incluida la
gerencia y cualquier área que nada tiene que ver con esto. La política de
Exchange lo reduce a un grupo concreto.

1. Crear un grupo de distribución con el equipo del piloto, por ejemplo
   `sabana-tiempos@ceinfes.com`.
2. En Exchange Online PowerShell:

```powershell
Connect-ExchangeOnline

New-ApplicationAccessPolicy `
  -AppId "<Id. de aplicación (cliente)>" `
  -PolicyScopeGroupId "sabana-tiempos@ceinfes.com" `
  -AccessRight RestrictAccess `
  -Description "Sabana de trabajo: solo el equipo del piloto"
```

3. Verificar con una persona de dentro y otra de fuera del grupo:

```powershell
Test-ApplicationAccessPolicy -Identity persona@ceinfes.com -AppId "<client-id>"
```

Debe decir `Granted` para quien está en el grupo y `Denied` para quien no.
La política tarda hasta una hora en propagarse.

Ampliar el piloto después es agregar gente al grupo: no se toca la
aplicación ni el código.

## 3. Secretos en Supabase

```bash
supabase secrets set GRAPH_TENANT_ID="<Id. de directorio (inquilino)>"
supabase secrets set GRAPH_CLIENT_ID="<Id. de aplicación (cliente)>"
supabase secrets set GRAPH_CLIENT_SECRET="<el Valor del secreto de cliente>"
```

## 4. Desplegar

```bash
supabase db push
supabase functions deploy graph-calendar-sync --no-verify-jwt
supabase functions deploy daily-time-request --no-verify-jwt
supabase functions deploy time-log --no-verify-jwt
```

`daily-time-request` se redespliega porque ahora llama a la sincronización
antes de enviar, y `time-log` porque ahora devuelve las reuniones al
formulario.

## 5. Encender

**Configuración → Registro de tiempos → Sugerir las reuniones de Outlook**, y
guardar. Después, **Enviar ahora** para probar el circuito completo.

La respuesta trae qué pasó con el calendario:

```json
{ "ok": true, "date": "2026-09-22", "sent": 8, "calendario": "23 eventos" }
```

Si en `calendario` aparece `falló: …` o `calendario desactivado`, los correos
igual salieron: el formulario llega en blanco y se registra a mano. **Eso es
a propósito** — un Graph caído no puede convertirse en un día sin registrar.

## 6. Qué se trae y qué no

| Se cuenta | Se ignora | Por qué |
|---|---|---|
| Reuniones aceptadas o sin responder | Canceladas | El tiempo no ocurrió. |
| | De día completo | Casi siempre son marcas (vacaciones, cumpleaños); sugerir 24 horas sería ruido. |
| | Rechazadas | Si dijo que no, no estuvo. |
| | Marcadas como "libre" | Es tiempo bloqueado, no tiempo ocupado. |

**Reuniones privadas:** de una reunión marcada privada o confidencial se
guarda la **duración** y nada más. El asunto no entra a la base de datos —
`cache_calendar_event` lo descarta antes de escribir, no la pantalla al
mostrar. La diferencia importa: filtrarlo al mostrar habría dejado el texto
guardado, a un `select` de distancia de cualquiera con acceso a la base.

En el formulario esas líneas aparecen como "Reunión privada" con su duración.

**Esto hay que decírselo al equipo antes de encenderlo.** Es la diferencia
entre una herramienta de gestión y una de vigilancia, y de esa percepción
depende que la gente registre.

## 7. La sugerencia de proyecto

Se compara el asunto de la reunión contra los nombres de proyecto y de
subproyecto que **esa persona tiene asignados en la sábana del mes**, y gana
el más específico. "Comité Formación Docente" cae en el subproyecto
*Formación Docente* si lo tiene asignado.

Es una **sugerencia**: llena el desplegable y la persona confirma o cambia.
Cuando no se reconoce nada, la fila llega con la duración y el desplegable
vacío — a propósito. Que la persona elija cuesta menos que descubrir después
que el sistema le cargó horas a un proyecto que no era.

Acierta más si las reuniones recurrentes llevan el nombre del proyecto en el
asunto. Vale la pena decirlo en la capacitación: es el único "truco" que el
equipo necesita saber.

## 8. Cuando algo no cuadra

| Síntoma | Causa probable |
|---|---|
| `calendario: "calendario desactivado"` | El interruptor de Configuración está apagado. |
| `Entra ID 401` | El secreto de cliente venció o se copió el Id. en vez del Valor. |
| `Graph 403` en todos | Falta el consentimiento del administrador sobre `Calendars.Read`. |
| `Graph 403` en algunos | Esas personas no están en el grupo de la Application Access Policy. |
| Una persona sin eventos y sin error | Su correo no tiene buzón en el tenant (el 404 se ignora en silencio a propósito). |
| Reuniones con la hora corrida | Revisar `time_request_timezone` en `settings`: es la zona que se le pide a Graph y con la que se arma la ventana del día. |

## 9. Lo que sigue

- **Fase 4 — Teams.** `outbox.channel` y `time_request_teams_enabled` ya
  existen. La tarjeta adaptativa se arma con los mismos datos que hoy alimenta
  el formulario (`time_log_options` + `calendar_events_for`), y el envío entra
  por el mismo RPC, que ya es idempotente.
- **Fase 5 — Tablero.** La vista `planeado_vs_ejecutado` ya tiene datos;
  falta la pantalla en Reportes.
