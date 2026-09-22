# Recordatorio diario de tiempos — puesta en marcha

Guía para dejar funcionando el recordatorio diario: qué desplegar, qué
secretos configurar y cómo se arma el disparador — con Power Automate o, si
no hay licencia Premium, con `pg_cron` dentro de Supabase.

El reparto de responsabilidades es deliberado: **el disparador no sabe nada**.
No sabe la hora, ni los días, ni a quién escribirle, ni si el recordatorio
está encendido. Solo llama a una URL cada 15 minutos. Toda la decisión vive en
la base de datos y se cambia desde **Configuración → Registro de tiempos**.
Por eso los dos disparadores son intercambiables: ninguno carga con nada que
valga la pena mover.

---

## 1. Aplicar las migraciones

```bash
supabase db push
```

Esto crea `daily_time_logs`, `time_requests`, la vista
`planeado_vs_ejecutado` y los parámetros nuevos en `settings`. El
recordatorio queda **apagado** (`time_request_enabled = false`): una
migración no puede empezar a escribirle a la gente sola.

## 2. Desplegar las Edge Functions

```bash
supabase functions deploy daily-time-request --no-verify-jwt
supabase functions deploy time-log --no-verify-jwt
supabase functions deploy graph-calendar-sync --no-verify-jwt
```

`--no-verify-jwt` en las tres, por razones distintas:

- `daily-time-request` la llama Power Automate, que no tiene usuario. Se
  autentica con un secreto compartido en el encabezado (y, cuando la llama el
  botón "Enviar ahora" de Configuración, con el JWT del administrador — la
  función acepta las dos y rechaza todo lo demás).
- `time-log` la abre quien recibió el correo, sin iniciar sesión. Su
  credencial es el token de un día que viaja en el cuerpo de la petición.
- `graph-calendar-sync` la llama `daily-time-request` de servidor a servidor,
  con el mismo secreto compartido.

## 3. Secretos

```bash
supabase secrets set TIME_REQUEST_SECRET="$(openssl rand -hex 32)"
supabase secrets set APP_BASE_URL="https://<dominio-de-la-aplicación>"
```

El recordatorio sale por la misma bandeja (`public.outbox`) y el mismo
`outbox-worker` que los avisos de tickets y de liberación de mes. No hay un
segundo transporte que mantener ni un segundo lugar donde mirar cuando un
correo no llega.

**Ese transporte hay que configurarlo aparte**, en
[`MICROSOFT_365.md`](MICROSOFT_365.md): la plataforma manda por Microsoft
Graph desde un buzón corporativo. Sin eso, el recordatorio se encola
correctamente y no sale nadie a entregarlo — que es exactamente lo que
estuvo pasando, en silencio, durante semanas.

Guarda el valor de `TIME_REQUEST_SECRET` en algún lado antes de seguir: hay
que volver a escribirlo en el paso 4 (en el flujo o en Vault, según la opción)
y `supabase secrets` no lo muestra de nuevo.

## 4. El disparador

Hay dos formas de dar el latido, y el resto del sistema no distingue entre
ellas: las dos hacen el mismo `POST` a la misma URL.

- **Opción A — Power Automate.** Requiere licencia **Premium** para la acción
  HTTP. Es la más visible para quien no entra a la base de datos.
- **Opción B — `pg_cron` dentro de Supabase.** Sin licencias, sin servicios
  extra, sin salir del repositorio. Es la que aplica cuando la acción HTTP
  aparece bloqueada.

Cambiar de una a la otra después es borrar un job o apagar un flujo. Nada más
se toca.

### Opción B — pg_cron (sin licencia Premium)

**1. Habilitar las extensiones.** En el Dashboard de Supabase → **Database →
Extensions**, buscar y activar `pg_cron` y `pg_net`. Un clic cada una.

**2. Guardar los secretos en Vault.** En el **SQL Editor**, una sola vez. No
van en una migración porque las migraciones están en git:

```sql
select vault.create_secret(
  '<el mismo valor de TIME_REQUEST_SECRET>',
  'time_request_secret',
  'Secreto compartido con las Edge Functions del recordatorio de tiempos'
);

select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1',
  'functions_base_url',
  'Base de las Edge Functions del proyecto'
);
```

**3. Aplicar la migración**, que programa el job:

```bash
supabase db push
```

**4. Probar sin esperar**, desde el SQL Editor:

```sql
select public.disparar_recordatorio_de_tiempos();
```

Devuelve `null` si el recordatorio está apagado en Configuración —eso es
correcto, no un fallo— y un número (el id de la petición) cuando disparó. La
llamada es asíncrona, así que la respuesta se mira aparte:

```sql
select created, status_code, content
from net._http_response
order by created desc limit 5;
```

`status_code` 200 con un `"skipped"` en el cuerpo es lo normal: el latido
preguntó y todavía no era la hora.

**Por qué el job corre las 24 horas** y no de 6 a 21: `pg_cron` evalúa la
expresión en la zona del servidor, que en Supabase es UTC. Un `6-21` serían
la 1 a. m. y las 4 p. m. de Bogotá — un error que no se nota hasta que el
recordatorio no sale un día. Corriendo siempre y dejando que la base decida,
esa clase de error desaparece. El costo es nulo: con el recordatorio apagado,
cada disparo es un `select` de una fila y ninguna llamada de red.

### Opción A — El flujo de Power Automate

**Nombre sugerido:** `Sábana — latido del recordatorio de tiempos`

#### Disparador de recurrencia

**Recurrencia** (Schedule → Recurrence):

| Campo | Valor |
|---|---|
| Intervalo | 1 |
| Frecuencia | Día |
| Zona horaria *(opciones avanzadas)* | (UTC-05:00) Bogotá, Lima, Quito |
| En estas horas *(opciones avanzadas)* | 6 … 21 |
| En estos minutos *(opciones avanzadas)* | 0, 15, 30, 45 |

Frecuencia **Día** y no **Minuto**: con frecuencia Minuto, Power Automate no
ofrece "En estas horas", así que la única forma de acotar la ventana es esta.

La ventana horaria es **a propósito más ancha** que cualquier hora que se
vaya a configurar. Si el flujo corriera solo de 4 a 5 de la tarde, mover el
recordatorio a las 3:00 desde Configuración no serviría de nada y el problema
costaría un rato de encontrar.

Sin filtro de días de la semana: los días hábiles se eligen en Configuración.
Ponerlos también acá dejaría la misma decisión en dos lugares que tarde o
temprano se contradicen.

#### Acción HTTP

**HTTP** (acción premium) con:

| Campo | Valor |
|---|---|
| Method | `POST` |
| URI | `https://<project-ref>.supabase.co/functions/v1/daily-time-request` |
| Headers | `Content-Type: application/json`<br>`X-Webhook-Secret: <TIME_REQUEST_SECRET>` |
| Body | `{}` |

Nada más. Sin condiciones, sin bucles, sin leer usuarios: si el flujo crece,
es señal de que una decisión se está yendo del repositorio.

> **Si la acción HTTP aparece bloqueada** por licencia, usa la Opción B de
> arriba. Cualquier programador que sepa hacer un POST sirve igual: el
> contrato es el mismo.

### Qué responde el latido (en cualquiera de las dos opciones)

```json
{ "ok": true, "date": "2026-09-22", "sent": 14, "failed": 0, "failures": [] }
```

Cuando no toca —que es lo que pasa en la mayoría de las ejecuciones— responde
`{ "ok": true, "sent": 0, "skipped": "todavía no es la hora" }`. Es una
respuesta exitosa: el flujo no debe tratarla como error ni reintentar.

Otros valores de `skipped`: `recordatorio desactivado`, `no es un día
configurado`, `no hay un mes abierto y liberado`, `ya se envió a todos`.

### Por qué llamarla de más no hace daño

`time_requests` tiene un índice único por (persona, día, canal) y
`time_request_targets` devuelve solo a quien todavía no tiene pedido. Cuatro
ejecuciones por hora, dos flujos simultáneos o un reintento del servicio
producen el mismo resultado que una sola llamada: un correo por persona y
por día. La defensa está en el índice de la base, no en el código — dos
llamadas a la vez pasarían las dos por cualquier chequeo previo.

## 5. Encender y probar

1. Entrar como administrador a **Configuración → Registro de tiempos**.
2. Revisar **a quién le va a llegar**. El roster lo dictan las cuentas activas
   (`*_roster_desde_las_cuentas.sql`), así que por defecto sería toda la
   organización con cuenta. La pantalla muestra el conteo y la lista, y los
   **roles excluidos** se marcan ahí mismo: arranca con *Administrador* y
   *Estratega* fuera. Para probar con la propia cuenta de administrador, hay
   que desmarcar *Administrador*.
3. Fijar la hora (por defecto 16:30) y los días hábiles.
4. Encender **Enviar el recordatorio diario**, y guardar.
5. **Enviar ahora** manda el correo sin esperar a la hora. Salta el chequeo de
   hora y de día; **no** salta el de duplicados, así que probar no le manda
   dos correos a nadie.
6. Verificar en **Configuración → Correos** que las filas `registro_diario`
   salieron (`enviado`). Si quedan en `pendiente`, el que no está corriendo es
   `outbox-worker`, no esto.

## 6. Qué recibe la persona

Un correo con un enlace `https://<app>/registro/<token>` que abre el
formulario **sin pedir usuario ni contraseña**. Es una decisión, no un
descuido: pedir login a las 4:30 de la tarde para un formulario de 30
segundos es, en la práctica, la diferencia entre que el equipo registre y que
no.

El alcance del token es mínimo: registra las horas de **esa** persona en
**ese** día y nada más. No abre la aplicación, no muestra el trabajo de
nadie, no toca la sábana. Vence a las 18 horas (configurable) y lo que se
guarda en la base es su hash, no el token — un volcado de `time_requests` no
sirve para registrar a nombre de nadie.

El desplegable del formulario trae **solo los proyectos que esa persona tiene
asignados en la sábana del mes**. Ahí es donde se cierra el descuadre de
raíz: no hay forma de escribir un proyecto que no existe ni de elegir uno
ajeno.

Reenviar el formulario **reemplaza** el día, no lo suma. Quien registre 6
horas y después se acuerde de una reunión vuelve a abrir el mismo enlace y
manda 8; el último envío es la verdad. Eso es también lo que hace que un
reintento del webhook de Teams (Fase 4) no duplique nada.

## 7. Operación diaria

| Síntoma | Dónde mirar |
|---|---|
| No llegó ningún correo | Historial de ejecuciones del flujo; si responde `skipped`, el motivo viene en la respuesta. |
| Llegó a unos y a otros no | `time_requests` del día: quien no tiene fila es quien no tiene cuenta activa vinculada a su persona del roster (Personas → Cuenta vinculada). |
| Salió el pedido pero no el correo | **Configuración → Correos**, filtrar por `registro_diario`. Si están `pendiente`, revisar `outbox-worker`. |
| Nadie respondió | `time_requests` con `responded_at` nulo. Es el dato para la conversación, no para insistir: el sistema manda un recordatorio al día y ninguno más. |

## 8. Lo que todavía no está

- **Teams** (Fase 4). La bandera `time_request_teams_enabled` ya existe y
  `outbox.channel` ya distingue `email` de `teams`, para que encenderlo sea un
  flujo más y no otra migración.
- **Calendario de Outlook** (Fase 3). El código está listo, pero depende de
  una registración de aplicación en Entra ID que hace el administrador de
  M365: ver [`MICROSOFT_365.md`](MICROSOFT_365.md). Mientras no esté,
  el formulario llega en blanco y todo lo demás funciona igual.
- **Tablero planeado vs. ejecutado** (Fase 5). La vista
  `planeado_vs_ejecutado` ya existe y ya tiene datos; falta la pantalla en
  Reportes.
