# Microsoft 365 — puesta en marcha

Una sola registración de aplicación en Entra ID habilita **las dos** cosas
que la plataforma necesita de Microsoft:

1. **Enviar correo** (`Mail.Send`) — todos los avisos de la plataforma: los
   recordatorios de registro de tiempos, los de ticket y los de liberación de
   mes. Sin esto, la bandeja de salida se llena y no sale nada.
2. **Leer calendarios** (`Calendars.Read`) — para que el formulario de
   registro llegue con las reuniones del día ya cargadas.

Se eligió Microsoft y no un proveedor de correo transaccional porque la
organización ya tiene M365 y este circuito ya necesitaba la app registration
para el calendario: es un permiso más en la misma solicitud, en vez de una
cuenta nueva con su facturación, sus registros DNS y su dominio que
verificar. El remitente es una dirección corporativa real, que además es la
que mejor entrega dentro de la propia organización.

**Esta parte no se puede hacer desde el repositorio.** Los pasos 1 y 2 los
ejecuta quien administre Microsoft 365 en la consola de Azure/Entra ID; del
paso 3 en adelante ya es la plataforma.

> **El correo es lo urgente.** Mientras esto no exista, la plataforma no
> manda ningún aviso. El calendario, en cambio, solo hace que el formulario
> llegue en blanco — se puede vivir sin él.

---

## 1. Registración de aplicación en Entra ID

En **portal.azure.com → Microsoft Entra ID → Registros de aplicaciones →
Nuevo registro**:

| Campo | Valor |
|---|---|
| Nombre | `Sábana de trabajo` |
| Tipos de cuenta | Solo este directorio organizativo |
| URI de redirección | *(ninguno — no hay inicio de sesión de usuario)* |

Luego, en **Permisos de API → Agregar permiso → Microsoft Graph → Permisos de
aplicación**:

- `Mail.Send`
- `Calendars.Read`

Y **Conceder consentimiento del administrador**. Sin ese botón los permisos
quedan solicitados pero no vigentes, que es el error más común de este paso.

En **Certificados y secretos → Nuevo secreto de cliente**: copiar el
**Valor** (no el Id.) apenas se cree — después ya no se puede volver a ver.

De la pantalla **Información general** se necesitan el **Id. de aplicación
(cliente)** y el **Id. de directorio (inquilino)**.

## 2. Acotar el alcance (Application Access Policy)

**Este paso no es opcional.** Como permisos de aplicación, `Calendars.Read`
da acceso al calendario de **todos los buzones del tenant** y `Mail.Send`
permite enviar **como cualquiera de ellos**, incluida la gerencia. La
política de Exchange lo reduce a un grupo concreto.

1. Crear un grupo de distribución con el equipo del piloto, por ejemplo
   `sabana-tiempos@ceinfes.com`.
2. **Incluir en ese grupo el buzón remitente** (el de `SUPPORT_FROM_EMAIL`).
   Es fácil de olvidar: la política restringe también el envío, así que un
   remitente fuera del grupo hace que Graph rechace todos los correos con un
   403 que parece un problema de permisos y en realidad es de alcance.
3. En Exchange Online PowerShell:

```powershell
Connect-ExchangeOnline

New-ApplicationAccessPolicy `
  -AppId "<Id. de aplicación (cliente)>" `
  -PolicyScopeGroupId "sabana-tiempos@ceinfes.com" `
  -AccessRight RestrictAccess `
  -Description "Sabana de trabajo: solo el equipo del piloto"
```

4. Verificar con una persona de dentro y otra de fuera del grupo:

```powershell
Test-ApplicationAccessPolicy -Identity persona@ceinfes.com -AppId "<client-id>"
```

Debe decir `Granted` para quien está en el grupo y `Denied` para quien no.
La política tarda hasta una hora en propagarse.

Ampliar el piloto después es agregar gente al grupo: no se toca la
aplicación ni el código.

## 3. Secretos en Supabase

Desde Dashboard → Project Settings → Edge Functions → Secrets, o por CLI:

```bash
supabase secrets set GRAPH_TENANT_ID="<Id. de directorio (inquilino)>"
supabase secrets set GRAPH_CLIENT_ID="<Id. de aplicación (cliente)>"
supabase secrets set GRAPH_CLIENT_SECRET="<el Valor del secreto de cliente>"
supabase secrets set SUPPORT_FROM_EMAIL="<el buzón desde el que se manda>"
```

`SUPPORT_FROM_EMAIL` tiene que ser un buzón real del tenant y estar dentro
del grupo de la Application Access Policy (paso 2).

## 4. Probar el correo

Es lo primero que conviene verificar, porque de ello depende todo lo demás.
En el SQL Editor:

```sql
select public.disparar_outbox();
select created, status_code, content from net._http_response order by created desc limit 3;
```

`{"ok":true,"sent":N}` y los correos en las bandejas. Si sale `sent: 0` con
`failures`, el mensaje de Graph dice por qué — ver la tabla del final.

## 5. Encender el calendario

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
| `Graph 403` en todos | Falta el consentimiento del administrador sobre el permiso correspondiente. |
| `Graph 403` en todos los **correos** | El buzón de `SUPPORT_FROM_EMAIL` no está en el grupo de la Application Access Policy. |
| `Graph 404` al enviar correo | `SUPPORT_FROM_EMAIL` no es un buzón del tenant (typo, o un alias sin buzón propio). |
| `Graph 403` en algunos calendarios | Esas personas no están en el grupo de la Application Access Policy. |
| Una persona sin eventos y sin error | Su correo no tiene buzón en el tenant (el 404 se ignora en silencio a propósito). |
| Reuniones con la hora corrida | Revisar `time_request_timezone` en `settings`: es la zona que se le pide a Graph y con la que se arma la ventana del día. |

## 9. Lo que sigue

- **Fase 4 — Teams.** `outbox.channel` y `time_request_teams_enabled` ya
  existen. La tarjeta adaptativa se arma con los mismos datos que hoy alimenta
  el formulario (`time_log_options` + `calendar_events_for`), y el envío entra
  por el mismo RPC, que ya es idempotente.
- **Fase 5 — Tablero.** La vista `planeado_vs_ejecutado` ya tiene datos;
  falta la pantalla en Reportes.
