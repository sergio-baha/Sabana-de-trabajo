# Sistema de diseño Experia · CEINFES

> Referencia completa del estilo visual de **Experia** para replicarlo en otra plataforma.
> Extraída del código real: `src/styles.css`, `src/components/ui.jsx`, `src/lib/theme.js`,
> `index.html` y los patrones inline de las páginas.
>
> Todos los valores de este documento son los de producción, no aproximaciones.

---

## 0. Cómo está construido (léelo antes de copiar nada)

| Decisión | Cómo es en Experia | Por qué importa al replicar |
|---|---|---|
| **Sin framework CSS** | No hay Tailwind, Bootstrap ni CSS-in-JS. | Todo se resuelve con *custom properties* + estilos inline. |
| **Un solo archivo CSS global** | `src/styles.css` (~2.500 líneas): tokens, reset, keyframes, utilidades y temas. | Es el único lugar con selectores; no hay CSS modules. |
| **Estilos inline en los componentes** | `style={{ ... }}` con objetos JS que **siempre** referencian variables CSS (`var(--orange)`), nunca hex sueltos. | Es lo que hace que el modo oscuro y los acentos funcionen sin re-render. |
| **El tema vive en el DOM** | Atributos en `<html>`: `data-theme`, `data-accent`, `data-contrast`, `data-course-theme`. | Cambiar tema = cambiar un atributo. Cero JS de repintado. |
| **Clases CSS solo para lo que inline no puede** | Pseudo-elementos, keyframes, `:focus-visible`, `::selection`, media queries, `@media print`. | Lista completa de utilidades en §7. |

**La regla de oro:** *si un color puede cambiar con el tema, va como `var(--token)`.*
La única excepción legítima son los **documentos imprimibles** (§13), que llevan hex
literales a propósito.

---

## 1. Tipografía

### Familia

**Inter Variable**, auto-alojada (no Google Fonts, no CDN): un solo archivo cubre los pesos 100–900.

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;          /* fuente variable: un archivo, todos los pesos */
  font-display: swap;
  src: url('/fonts/InterVariable.ttf') format('truetype');
}

:root {
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

En el `<head>`, precarga para evitar el parpadeo de fuente:

```html
<link rel="preload" href="/fonts/InterVariable.ttf" as="font" type="font/ttf" crossorigin />
```

### Ajustes base

```css
body {
  font-family: var(--font);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
h1, h2, h3 { letter-spacing: -.02em; }   /* títulos ligeramente compactos */
button     { font-family: var(--font); } /* los botones NO heredan la fuente solos */
html       { -webkit-text-size-adjust: 100%; }
```

### Escala tipográfica real (la que usan las páginas)

No hay clases `.text-lg`; son valores en píxeles aplicados inline. Esta es la
convención observada en todo el producto:

| Uso | Tamaño | Peso | Extras |
|---|---|---|---|
| Título de página | 20 px | 800 | color `var(--dark)` |
| Título de sección / h2 de documento | 18–19 px | 800–900 | |
| Título de modal | 18 px | 700 | |
| Título de tarjeta | 15–17 px | 700–800 | |
| Cifra destacada (KPI) | 22–30 px | 900 | `line-height: 1.1` |
| Texto de cuerpo | 13–14 px | 400–600 | |
| Texto secundario | 12–12.5 px | 400 | color `var(--muted)` |
| Etiqueta de campo (label) | 11 px | 700 | `uppercase`, `letter-spacing: .8px`, color `var(--muted)` |
| Encabezado de tabla | 10.5 px | 800 | `uppercase`, `letter-spacing: .7px`, color `var(--muted)` |
| Micro-etiqueta / chip | 9–10 px | 800 | `uppercase`, `letter-spacing: .5–1px` |
| Nota al pie | 8.5–9 px | 400 | color `var(--subtle)` |

**Patrón de etiqueta reutilizado en todo el producto:**

```js
const lbl = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: .8,
  display: 'block', marginBottom: 5,
}
```

---

## 2. Color — modo claro (`:root`)

Los colores salen del **brandbook CEINFES**. Copia este bloque tal cual.

```css
:root {
  /* ── Naranja Evolución + Naranja Conocimiento (color primario de marca) ── */
  --orange: #EC671A;
  --orange-light: #F59E33;
  --orange-pale: #FDDBBC;
  --orange-bg: #FEF0E6;
  --orange-50: #FFF8F2;

  /* ── Acento secundario — Morado Formación (PANTONE 3574 C), por defecto ── */
  --accent-rgb: 94, 79, 156;      /* el acento se expone en RGB para poder hacer alpha */
  --purple: #5E4F9C;
  --purple-deep: #45397A;
  --purple-light: #8A7FBD;
  --purple-bg: rgba(var(--accent-rgb), .10);
  --grad-mid: #C0538A;            /* transición cálida morado → naranja */

  /* ── Texto ── */
  --dark: #1A1A2E;                /* títulos y texto fuerte */
  --text: #2D2D44;                /* cuerpo */
  --text-sec: #4A4A5E;            /* cuerpo secundario */
  --muted: #6B7280;               /* etiquetas, texto de apoyo */
  --subtle: #9CA3AF;              /* placeholders, notas al pie */

  /* ── Superficies ── */
  --border: #E5E7EB;
  --bg-alt: #F3F4F6;              /* fondo de controles secundarios */
  --bg: #F9FAFB;                  /* fondo de la app */
  --white: #FFFFFF;               /* fondo de tarjetas/paneles */

  /* ── Semánticos ── */
  --success: #0D9488;
  --warn: #F59E0B;
  --error: #EF4444;

  /* ── Tintes semánticos (se remapean en modo oscuro) ── */
  --success-bg: #F0FDFA;
  --success-bg-strong: #CCFBF1;
  --success-border: #5EEAD4;
  --error-bg: #FEF2F2;
  --error-bg-strong: #FEE2E2;
  --info-bg: #EFF6FF;
  --warn-bg: #FFFBEB;
  --violet-bg: #EDEAF7;

  /* ── Acentos sólidos ──
     Antes eran degradados; se pasaron a color plano conservando los nombres
     para no romper los usos existentes. Si quieres degradados, cámbialos aquí
     y toda la app los toma. */
  --gradient: var(--purple);
  --gradient-orange: var(--orange);
  --gradient-soft: var(--orange-bg);
  --gradient-text: var(--orange);
}
```

> ⚠️ **`--white` no significa "blanco"**, significa "superficie de tarjeta". En modo
> oscuro vale `#1C1B28`. Nunca lo sustituyas por `#fff` literal salvo en documentos
> imprimibles.

### Acentos alternativos — `<html data-accent="…">`

El usuario elige el acento desde su perfil. Son los otros colores del brandbook:

```css
/* Azul Pensamiento — PANTONE 7455 C */
[data-accent="azul"] {
  --accent-rgb: 58, 91, 167;
  --purple: #3A5BA7; --purple-deep: #2B4485; --purple-light: #7090CC;
  --grad-mid: #9A5CB8;
}
/* Verde Transformación — PANTONE 7722 C */
[data-accent="esmeralda"] {
  --accent-rgb: 2, 75, 78;
  --purple: #024B4E; --purple-deep: #013738; --purple-light: #3D8E8A;
  --grad-mid: #8CCAAE;
}
```

El acento por defecto (`morado`) **no lleva atributo**: se aplica quitándolo.

| id | Nombre de marca | Hex |
|---|---|---|
| `morado` | Morado Formación | `#5E4F9C` |
| `azul` | Azul Pensamiento | `#3A5BA7` |
| `esmeralda` | Verde Transformación | `#024B4E` |

> El naranja **nunca** cambia con el acento: es la constante de marca.

---

## 3. Color — modo oscuro (`<html data-theme="dark">`)

No es un filtro ni una inversión: es un remapeo manual de las mismas variables.

```css
[data-theme="dark"] {
  color-scheme: dark;

  /* Texto: off-white suavizado, NO blanco puro (deslumbra sobre oscuro) */
  --dark: #E7E7EF; --text: #D2D2DD; --text-sec: #ABABBC;
  --muted: #9090A2; --subtle: #61617A;

  /* Superficies: gris-violeta desaturado (tinte de marca), escalonado parejo.
     Un azul-marino frío choca con el naranja: probado y descartado. */
  --border: #2B2A3B; --bg-alt: #211F2D; --bg: #15141D; --white: #1C1B28;

  /* Tintes de acento, más sutiles sobre oscuro */
  --orange-bg: rgba(232,115,44,.12);
  --orange-50: rgba(232,115,44,.07);
  --orange-pale: rgba(232,115,44,.36);
  --purple-bg: rgba(var(--accent-rgb), .20);

  --success: #2DD4BF;
  --success-bg: rgba(13,148,136,.13);
  --success-bg-strong: rgba(13,148,136,.22);
  --success-border: rgba(45,212,191,.34);
  --error-bg: rgba(239,68,68,.11);
  --error-bg-strong: rgba(239,68,68,.19);
  --info-bg: rgba(59,130,246,.13);
  --warn-bg: rgba(245,158,11,.13);
  --violet-bg: rgba(139,92,246,.18);

  /* Sombras: un punto más suaves, para evitar halos duros */
  --sh-sm: 0 1px 2px rgba(0,0,0,.30), 0 1px 3px rgba(0,0,0,.26);
  --sh-md: 0 2px 4px rgba(0,0,0,.30), 0 6px 16px rgba(0,0,0,.34);
  --sh-lg: 0 4px 8px rgba(0,0,0,.34), 0 12px 32px rgba(0,0,0,.44);
  --sh-xl: 0 8px 16px rgba(0,0,0,.40), 0 24px 56px rgba(0,0,0,.54);

  --glass-bg: rgba(21,20,29,.74);
  --glass-border: rgba(255,255,255,.07);
  --shimmer: rgba(255,255,255,.06);
}

/* El logo (wordmark naranja) pasa a silueta blanca */
[data-theme="dark"] .logo-img { filter: brightness(0) invert(1); }

/* Scrollbar y selección acordes */
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: #34334A; background-clip: padding-box; }
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background: #423F5C; background-clip: padding-box; }
[data-theme="dark"] ::selection { background: rgba(232,115,44,.38); color: #fff; }
```

### Islas de tema claro dentro del modo oscuro

Los documentos imprimibles fuerzan tema claro redefiniendo los tokens en su propio
contenedor (las custom properties del ancestro más cercano ganan por herencia):

```css
#certificate {
  --dark: #1A1A2E; --text: #2D2D44; --text-sec: #4A4A5E;
  --muted: #6B7280; --subtle: #9CA3AF;
  --border: #E5E7EB; --bg-alt: #F3F4F6; --bg: #F9FAFB; --white: #FFFFFF;
}
[data-theme="dark"] #certificate .logo-img { filter: none; }
```

---

## 4. Alto contraste (`<html data-contrast="alto">`)

Modo de accesibilidad que sube todo a **WCAG AA 4.5:1** en texto normal.

```css
[data-contrast="alto"] {
  --orange: #B84E00;      /* 4.5:1 sobre blanco */
  --orange-light: #9A5E00;
  --orange-pale: #FFD1A8;
  --muted: #374151;
  --subtle: #4B5563;
  --text-sec: #1F2937;
  --border: #6B7280;      /* bordes claramente visibles */
  --bg-alt: #EBEBEB;
  --success: #0F766E;
}
[data-contrast="alto"][data-theme="dark"] {
  --orange: #FFAA66;      /* más claro sobre oscuro */
  --orange-light: #FFC080;
  --muted: #D1D5DB;
  --subtle: #9CA3AF;
  --border: #9CA3AF;
  --bg-alt: #2D2B40;
  --success: #5EEAD4;
}
[data-contrast="alto"] button,
[data-contrast="alto"] a { text-decoration-skip-ink: auto; }
```

> El naranja de marca (`#EC671A`) **no** pasa AA para texto normal sobre blanco.
> Por eso existe este modo, y por eso el naranja se usa sobre todo en **fondos**
> (botón naranja + texto blanco) y no como color de texto pequeño.

---

## 5. Paleta de gráficas (`--viz-1..8`)

Ocho tonos para series y categorías, en **orden fijo**.

```css
:root {
  --viz-1: #2A78D6;  /* azul     */
  --viz-2: #EB6834;  /* naranja  */
  --viz-3: #1BAF7A;  /* aqua     */
  --viz-4: #EDA100;  /* amarillo */
  --viz-5: #E87BA4;  /* magenta  */
  --viz-6: #008300;  /* verde    */
  --viz-7: #4A3AA7;  /* violeta  */
  --viz-8: #E34948;  /* rojo     */
}
[data-theme="dark"] {
  --viz-1: #3987E5; --viz-2: #D95926; --viz-3: #199E70; --viz-4: #C98500;
  --viz-5: #D55181; --viz-6: #008300; --viz-7: #9085E9; --viz-8: #E66767;
}
```

⚠️ **Reglas que vienen con esta paleta** (si las rompes, deja de ser válida):

1. Está validada **como conjunto** — banda de luminosidad, croma, separación para
   daltonismo y contraste — contra las dos superficies de la app (`#FFFFFF` y `#1C1B28`).
   Los valores oscuros **no son un filtro** de los claros: son su propio paso.
2. La peor pareja adyacente queda en **ΔE 9.1 (protanopía)**. Eso es aceptable
   **solo** porque cada barra lleva **siempre** su nombre y su valor en texto: la
   identidad del dato nunca depende del color. No conviertas esos rótulos en leyenda
   ni en tooltip.
3. Al guardar la elección de color de un usuario, guarda el **slot (1–8), nunca el hex**.
   Si guardas el hex, congelas el color claro en modo oscuro.

---

## 6. Forma, elevación, espaciado y movimiento

```css
:root {
  /* Radios */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px; --r-full: 9999px;

  /* Sombras (con tinte de marca, no gris neutro) */
  --sh-sm: 0 1px 2px rgba(26,26,46,.04), 0 1px 3px rgba(26,26,46,.06);
  --sh-md: 0 2px 4px rgba(26,26,46,.04), 0 6px 16px rgba(26,26,46,.08);
  --sh-lg: 0 4px 8px rgba(26,26,46,.05), 0 12px 32px rgba(26,26,46,.10);
  --sh-xl: 0 8px 16px rgba(26,26,46,.06), 0 24px 56px rgba(26,26,46,.16);
  --sh-orange: 0 8px 24px -8px rgba(236,103,26,.45);
  --sh-purple: 0 8px 24px -8px rgba(var(--accent-rgb), .40);

  /* Glassmorphism */
  --glass-bg: rgba(255,255,255,.72);
  --glass-border: rgba(255,255,255,.55);
  --glass-blur: saturate(1.5) blur(16px);
  --shimmer: rgba(255,255,255,.75);

  /* Curvas de animación */
  --ease: cubic-bezier(.4,0,.2,1);        /* general */
  --ease-out: cubic-bezier(.16,1,.3,1);   /* entradas, hover */
  --ease-spring: cubic-bezier(.34,1.56,.64,1); /* rebote (iconos, toggles) */

  /* Layout */
  --sidebar-w: 260px;
  --header-h: 64px;
}
```

### Radios por tipo de elemento (convención en uso)

| Elemento | Radio |
|---|---|
| Chip / píldora | `20px` o `--r-full` |
| Input, botón pequeño | `8–10px` |
| Botón (`Btn`) | `--r-md` (12px) |
| Tarjeta | `14px` o `--r-lg` (16px) |
| Modal (desktop) | `--r-xl` (24px) |
| Modal (móvil, bottom sheet) | `24px 24px 0 0` |

### Espaciado

No hay escala formal; la convención observada es **múltiplos de 2 entre 4 y 12, y
de 4 de ahí en adelante**: `4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 40, 46`.

- Padding de página: `24px` desktop / `16px` móvil.
- Padding de tarjeta: `18–24px` desktop / `14–20px` móvil.
- `gap` entre tarjetas en fila: `12–16px`.
- Separación entre bloques de una página: `18–26px`.

---

## 7. Keyframes y utilidades

### Todos los keyframes globales

```css
@keyframes fadeIn{from{opacity:.01}to{opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideR{from{transform:translateX(24px)}to{transform:translateX(0)}}
@keyframes slideL{from{transform:translateX(-24px)}to{transform:translateX(0)}}
@keyframes scaleIn{from{transform:scale(.92)}to{transform:scale(1)}}
@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes sheetIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes pageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(232,115,44,.45)}50%{box-shadow:0 0 0 14px rgba(232,115,44,0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes confetti{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
@keyframes xpPop{0%{opacity:0;transform:translateY(8px) scale(.8)}15%{opacity:1;transform:translateY(-8px) scale(1.1)}30%{transform:translateY(-16px) scale(1)}80%{opacity:1;transform:translateY(-32px)}100%{opacity:0;transform:translateY(-48px) scale(.9)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes nodePing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.8);opacity:0}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
@keyframes drawPath{from{stroke-dashoffset:500}to{stroke-dashoffset:0}}
@keyframes badgePop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.15) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes progressFill{from{width:0}to{width:var(--target-w,100%)}}
@keyframes heroFloat{0%,100%{transform:translateY(0) rotate(0deg)}33%{transform:translateY(-12px) rotate(1deg)}66%{transform:translateY(4px) rotate(-1deg)}}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes logoPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.97)}}
```

### Clases utilitarias (las únicas que existen)

```css
/* Glassmorphism — header, cabeceras sticky de modal */
.glass{background:var(--glass-bg);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border:1px solid var(--glass-border)}

/* Skeleton loader con barrido */
.skeleton{position:relative;overflow:hidden;background:var(--bg-alt);border-radius:var(--r-sm)}
.skeleton::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--shimmer),transparent);background-size:200% 100%;animation:shimmer 1.4s ease infinite}

/* Elevación al hover (tarjetas) */
.hover-lift{transition:transform .25s var(--ease-out),box-shadow .25s var(--ease-out),border-color .25s var(--ease-out)}
.hover-lift:hover{transform:translateY(-3px);box-shadow:var(--sh-lg)}

/* Entrada de página */
.page-enter{animation:pageIn .35s var(--ease-out)}

/* Microinteracción de presión en botones */
.btn-press:active:not(:disabled){transform:translateY(0) scale(.97) !important;transition-duration:.08s}

/* Texto acentuado */
.gradient-text{color:var(--gradient-text)}
```

> ⚠️ `.page-enter` **no usa `fill-mode`** a propósito: al terminar, el `transform`
> vuelve a `none`. Si lo dejas fijo, creas un *containing block* que rompe cualquier
> hijo con `position: fixed` (modales que se recortan dentro de la página).

### Reset y base

```css
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;width:100%;overflow:hidden}  /* app shell: el scroll vive en los paneles */
body{font-family:var(--font);color:var(--dark);background:var(--bg);
     -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;line-height:1.55}
a{color:inherit;text-decoration:none}
button{font-family:var(--font)}
img{display:block;max-width:100%}
h1,h2,h3{letter-spacing:-.02em}
::selection{background:var(--orange-pale);color:var(--dark)}

::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:8px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:var(--subtle);background-clip:padding-box}
```

---

## 8. Accesibilidad

```css
/* Focus ring de doble contorno: visible sobre cualquier fondo */
:focus{outline:none}
:focus-visible{
  outline:2px solid var(--orange);
  outline-offset:3px;
  border-radius:4px;
  box-shadow:0 0 0 5px rgba(255,255,255,.85),0 0 0 7px var(--orange);
}
[data-theme="dark"] :focus-visible{
  box-shadow:0 0 0 5px rgba(18,18,32,.9),0 0 0 7px var(--orange);
}

/* Skip link: oculto hasta recibir foco */
.skip-link{position:absolute;top:-100%;left:12px;z-index:10000;padding:10px 20px;
  background:var(--orange);color:#fff;font-size:15px;font-weight:700;
  font-family:var(--font);text-decoration:none;border-radius:0 0 12px 12px;
  box-shadow:var(--sh-lg);transition:top .15s var(--ease);white-space:nowrap}
.skip-link:focus{top:0}

/* Respeta la preferencia del sistema de movimiento reducido */
@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
  html{scroll-behavior:auto}
}

/* Táctil */
* { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
input, textarea, select { touch-action: auto; }
@media (max-width: 767px) {
  button { min-height: 40px; }
  a      { min-height: 40px; }
}
```

En el HTML, primer elemento del `<body>`:

```html
<a href="#main-content" class="skip-link">Ir al contenido principal</a>
```

Otras reglas vigentes:
- Todo botón de solo icono lleva `aria-label`.
- Los modales llevan `role="dialog"` y `aria-modal="true"`.
- Los `Skeleton` llevan `aria-hidden="true"`.
- El color nunca es el único portador de información (ver §5).

---

## 9. Responsive

```css
@media (max-width: 767px) {
  :root { --sidebar-w: 280px; --header-h: 56px; }
  body.modal-open { overflow: hidden; }
}
table { min-width: 560px; }   /* fuerza scroll horizontal en su contenedor */
html  { scroll-behavior: smooth; }
```

**Breakpoint único: 768 px.** No hay tablet/desktop separados. La detección en JS
usa un hook con *debounce* de 80 ms, no media queries en el componente:

```js
const useMobile = (bp = 768) => {
  const [mob, setMob] = React.useState(() => window.innerWidth < bp);
  React.useEffect(() => {
    let t;
    const h = () => { clearTimeout(t); t = setTimeout(() => setMob(window.innerWidth < bp), 80); };
    window.addEventListener('resize', h, { passive: true });
    return () => { window.removeEventListener('resize', h); clearTimeout(t); };
  }, [bp]);
  return mob;
};
```

Patrón de uso: `padding: isMobile ? 16 : 24`, `gridTemplateColumns: isMobile ? '1fr' : '170px 1fr auto'`.

Las tablas anchas van **siempre** dentro de `<div style={{ overflowX: 'auto' }}>` con
`minWidth` en la tabla (p. ej. `720px`).

---

## 10. Layout de la aplicación

```
┌──────────────────────────────────────────────────┐
│ Sidebar (260px)  │ Header (64px, glass)          │
│ fondo --white    ├───────────────────────────────┤
│ borde derecho    │ Contenido                     │
│ 1px --border     │ overflow:auto                 │
│ colapsable a 76px│ padding 24px (16 móvil)       │
└──────────────────────────────────────────────────┘
```

**Sidebar**

```js
{
  width: isCollapsed ? '76px' : 'var(--sidebar-w)',
  height: '100%',
  background: 'var(--white)',
  borderRight: '1px solid var(--border)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  transition: 'width .25s var(--ease-out)',
}
```
En móvil se convierte en panel deslizante: overlay `rgba(0,0,0,.5)` a `zIndex 2999`
y el panel `position: fixed` a `zIndex 3000`.

**Header**

```js
{
  height: 'var(--header-h)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px 0 24px', gap: 12,
  borderBottom: '1px solid var(--border)', flexShrink: 0,
  background: 'var(--glass-bg)',
  backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
  zIndex: 50,
}
```

**Escala de `z-index` (respétala para no romper apilamientos)**

| Capa | z-index |
|---|---|
| Capa ambiental de tema inmersivo | 40 |
| Header | 50 |
| Personaje/tutor flotante | 150 |
| Panel de dropdown (portal) | 1000 / 1001 |
| Overlay del sidebar móvil | 2999 |
| Sidebar móvil | 3000 |
| Modales | 5000 |
| Visor de PDF a pantalla completa | 6000 |
| Barra flotante de la app | 9000 |
| Toasts (XP, insignias) | 9999 |
| Confetti · skip link | 10000 |

---

## 11. Componentes

### 11.1 Botón (`Btn`)

Siete variantes, tres tamaños. Hover = elevación de 1.5 px + brillo del 5 %.

```js
const Btn = ({children, variant='primary', size='md', onClick, disabled, full, style:sx={}}) => {
  const base = {
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
    fontFamily:'var(--font)', fontWeight:600, border:'none', cursor:'pointer',
    borderRadius:'var(--r-md)',
    transition:'transform .2s var(--ease-out), box-shadow .2s var(--ease-out), background .2s var(--ease-out), filter .2s var(--ease-out)',
    ...(disabled?{opacity:.5,pointerEvents:'none'}:{}),
    ...(full?{width:'100%'}:{}),
  };
  const sizes = {
    sm:{padding:'8px 16px',fontSize:13},
    md:{padding:'11px 22px',fontSize:14},
    lg:{padding:'14px 32px',fontSize:16},
  };
  const vars = {
    primary:  {background:'var(--gradient-orange)', color:'#fff',     boxShadow:'var(--sh-orange)'},
    secondary:{background:'var(--bg-alt)',          color:'var(--text)'},
    outline:  {background:'transparent',            color:'var(--orange)', boxShadow:'inset 0 0 0 2px var(--orange)'},
    ghost:    {background:'transparent',            color:'var(--muted)'},
    gradient: {background:'var(--gradient)',        color:'#fff',     boxShadow:'var(--sh-purple)'},
    white:    {background:'#fff',                   color:'#1A1A2E',  boxShadow:'var(--sh-sm)'},
    danger:   {background:'var(--error)',           color:'#fff'},
  };
  const hovShadow = {
    primary: '0 10px 28px -8px rgba(232,115,44,.55)',
    gradient:'0 10px 28px -8px rgba(123,63,160,.5)',
  };
  const [hov,setH] = React.useState(false);
  return <button onClick={onClick} disabled={disabled} className="btn-press"
    onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{...base,...sizes[size],...vars[variant],
      transform: hov&&!disabled ? 'translateY(-1.5px)' : 'none',
      filter:    hov&&!disabled ? 'brightness(1.05)'   : 'none',
      boxShadow: hov&&!disabled ? (hovShadow[variant]||'var(--sh-md)') : (vars[variant].boxShadow||'none'),
      ...sx}}>{children}</button>;
};
```

Cuándo usar cada variante:
- `primary` (naranja): la acción principal de la pantalla. **Una sola por vista.**
- `gradient` (acento): acción destacada secundaria — imprimir, generar, publicar.
- `secondary`: acciones neutras (guardar borrador, cancelar con peso).
- `outline`: alternativa marcada sin llenar de naranja.
- `ghost`: acciones terciarias y de fila.
- `white`: sobre fondos de color o hero.
- `danger`: destructivas.

### 11.2 Modal

```js
// Overlay
{ position:'fixed', inset:0, zIndex:5000,
  background:'rgba(15,15,30,.45)',
  backdropFilter:'blur(10px) saturate(1.2)', WebkitBackdropFilter:'blur(10px) saturate(1.2)',
  display:'flex', alignItems: isMobile?'flex-end':'center', justifyContent:'center',
  animation:'fadeIn .2s ease' }

// Panel
{ background:'var(--white)',
  borderRadius: isMobile ? '24px 24px 0 0' : 'var(--r-xl)',
  maxWidth: isMobile ? '100%' : width,   // width por defecto 560
  width:    isMobile ? '100%' : '92%',
  maxHeight:isMobile ? '92vh'  : '85vh',
  overflow:'auto',
  animation: isMobile ? 'sheetIn .35s var(--ease-out)' : 'modalIn .3s var(--ease-out)',
  boxShadow:'var(--sh-xl)' }

// Cabecera sticky (glass)
{ display:'flex', justifyContent:'space-between', alignItems:'center',
  padding:'18px 24px', borderBottom:'1px solid var(--border)',
  position:'sticky', top:0, zIndex:1,
  background:'var(--glass-bg)', backdropFilter:'blur(12px)' }

// Cuerpo
{ padding: isMobile ? '20px 20px 32px' : 24 }
```

Detalles: en móvil es **bottom sheet**; el botón de cerrar gira 90° al hover
(`transform: rotate(90deg)`); bloquea el scroll del body mientras está abierto;
cierra al hacer clic en el overlay (con `stopPropagation` en el panel).

### 11.3 Progreso

```js
// Anillo
const ProgressRing = ({pct=0, size=56, sw=4, color='var(--orange)'}) => {
  const r=(size-sw)/2, c=2*Math.PI*r, off=c-(pct/100)*c;
  return <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
      strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
      style={{transition:'stroke-dashoffset .8s ease'}}/>
  </svg>;
};

// Barra
const ProgressBar = ({pct=0, h=8, color='var(--orange)', bg='var(--border)'}) =>
  <div style={{width:'100%',height:h,borderRadius:h,background:bg,overflow:'hidden'}}>
    <div style={{height:'100%',borderRadius:h,width:pct+'%',
      transition:'width .8s var(--ease-out)',
      background: color==='var(--orange)' ? 'var(--gradient-orange)' : color}}/>
  </div>;
```

### 11.4 Skeletons

```js
const Skeleton = ({w='100%', h=14, r, circle=false, style:sx={}}) =>
  <div className="skeleton" aria-hidden="true"
    style={{width:circle?h:w, height:h,
      borderRadius: circle?'50%':(r??'var(--r-sm)'), flexShrink:0, ...sx}}/>;
```

`SkeletonCard` compone: avatar circular de 40 px + dos líneas (55 % / 35 %) + N líneas
decrecientes (`92 - i*14` %). El estado de carga estándar de una página es
`[1,2,3,4].map(i => <Skeleton key={i} h={48} />)` dentro de un flex column con `gap: 12`.

### 11.5 Toasts y celebración

```js
// XP: naranja sólido, arriba a la derecha, 2.2 s
{ position:'fixed', top:80, right:24, zIndex:9999,
  background:'var(--orange)', color:'#fff', padding:'12px 24px', borderRadius:14,
  fontWeight:700, fontSize:18, animation:'xpPop 2.2s ease-out forwards',
  boxShadow:'0 4px 20px rgba(232,115,44,.4)', display:'flex', alignItems:'center', gap:8 }

// Insignia: tarjeta clara debajo del anterior, 3 s
{ position:'fixed', top:140, right:24, zIndex:9999,
  background:'var(--white)', padding:'16px 24px', borderRadius:16,
  animation:'xpPop 3s ease-out forwards', boxShadow:'var(--sh-xl)',
  border:'2px solid var(--orange-bg)' }
```

**Confetti:** 40 piezas, `left` aleatorio, retardo 0–0.6 s, duración 1.5–3.5 s,
tamaño 5–12 px, mitad círculos / mitad cuadrados de 2 px de radio, y esta paleta fija:

```js
['#E8732C', '#7B3FA0', '#10B981', '#F59E0B', '#3B82F6', '#EC4899']
```

### 11.6 Insignia (`BadgeCard`)

Círculo de 48 / 64 / 80 px (`sm`/`md`/`lg`), emoji al 42 % del tamaño.
Ganada: fondo `--orange-bg`, borde `2px solid var(--orange-light)`, animación `badgePop .5s`.
No ganada: `opacity: .35` + `grayscale(1)`, fondo `--bg-alt`, borde `--border`.

### 11.7 Formularios

No hay componente `Input`: se usan objetos de estilo compartidos.

```js
const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
  border: '1.5px solid var(--border)', fontFamily: 'var(--font)', fontSize: 14,
  outline: 'none', background: 'var(--white)', color: 'var(--dark)',
}

const lbl = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: .8, display: 'block', marginBottom: 5,
}

const card = {
  background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14,
}
```

Convenciones:
- Borde de input: **1.5 px** (no 1 px). En error: `borderColor: 'var(--error)'`.
- Celda de tabla editable: `{...inp, padding:'5px 6px', fontSize:13, textAlign:'center', width:52}`.
- Checkboxes y radios: `accentColor: 'var(--orange)'`, `width/height: 15px`, `cursor: pointer`.
- Botón de subida: borde **punteado** `1.5px dashed var(--purple)` sobre `var(--purple-bg)`.

### 11.8 Dropdown con checkboxes (`ChecklistDropdown`)

Se renderiza con `createPortal` al `body` y se **posiciona a mano** con
`getBoundingClientRect()`; se cierra al hacer scroll fuera del panel o al redimensionar.

```js
// Botón
{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:10,
  border:'1.5px solid var(--border)', background:'var(--white)', color:'var(--text-sec)',
  fontSize:13, fontWeight:600, whiteSpace:'nowrap', transition:'border-color .15s' }
// abierto → borderColor = accent; el chevron rota 90°

// Panel
{ position:'fixed', zIndex:1001, width:260, maxHeight:320, overflowY:'auto',
  background:'var(--white)', border:'1px solid var(--border)', borderRadius:12,
  boxShadow:'var(--sh-lg)', padding:6 }
```
Si no cabe abajo (`< 260px` libres) abre hacia arriba; se mantiene siempre dentro de la
ventana con margen de 8 px. Soporta estado **indeterminado** (`all` / `some` / `none`).

### 11.9 Chips y píldoras

```js
// Chip de filtro / opción seleccionable
{ padding:'7px 12px', borderRadius:20, fontSize:12.5, fontWeight:700, cursor:'pointer',
  transition:'all .15s',
  background: active ? 'var(--orange)' : 'var(--white)',
  color:      active ? '#fff'          : 'var(--text-sec)',
  border: `1.5px solid ${active ? 'var(--orange)' : 'var(--border)'}` }

// Píldora de registro / historial
{ padding:'5px 11px', borderRadius:8, fontSize:12, fontWeight:700, whiteSpace:'nowrap',
  border: activo ? '1.5px solid var(--orange)' : '1.5px solid var(--border)',
  background: activo ? 'var(--orange-bg)' : 'var(--white)',
  color: activo ? 'var(--orange)' : 'var(--text-sec)' }
```

### 11.10 Cajas de estado

```css
.ls-task-box {                                  /* tarea pendiente */
  display:flex; align-items:flex-start; gap:14px;
  padding:16px 20px; border-radius:14px;
  background:#FFF7ED; border:1.5px solid #FDBA74;
}
.ls-task-box .ls-task-label { color:#C2410C; }
.ls-task-box .ls-task-text  { color:#7C2D12; }

.ls-done-box {                                  /* completado */
  display:flex; align-items:center; gap:12px;
  padding:12px 18px; border-radius:12px;
  background:#F0FDFA; border:1.5px solid #5EEAD4;
}
```

Mensajes inline (bajo la cabecera de una página):

```js
{ fontSize:13, fontWeight:600, marginBottom:14,
  color: msg.startsWith('⚠️') ? 'var(--error)' : 'var(--success)' }
```

Banners: aviso `background:'#FEF3C7'` + texto `#8a6100`; éxito/bloqueo
`background:'#CCFBF1'` + texto `#0D9488`; ambos con `padding:'12px 16px'` y `borderRadius:12`.

---

## 12. Iconografía

**SVG propios, sin librería.** 39 iconos definidos en ~30 líneas.

```js
const IP = { fill:'none', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };
const Sv = ({children, s=20, c='currentColor', ...r}) =>
  React.createElement('svg', {width:s, height:s, viewBox:'0 0 24 24', stroke:c, ...IP, ...r}, children);

const CheckIc = ({s,c}) => <Sv s={s} c={c}><path d="M20 6L9 17l-5-5"/></Sv>;
const XIc     = ({s,c}) => <Sv s={s} c={c}><path d="M18 6L6 18M6 6l12 12"/></Sv>;
const PlusIc  = ({s,c}) => <Sv s={s} c={c}><path d="M12 5v14M5 12h14"/></Sv>;
// …
```

Reglas del set:
- Rejilla **24×24**, trazo **2**, extremos y uniones **redondeados** (estilo Feather).
- Tamaño por prop `s`; color por prop `c` (por defecto `currentColor`).
- Los iconos "sólidos" (Play, Star, Zap, Grip) usan `fill={c} stroke="none"`.
- Tamaños en uso: **13–14 px** en botones pequeños y filas, **15–18 px** en botones y
  menú, **20–26 px** en cabeceras y estados vacíos.
- Los **emoji** se usan deliberadamente como iconografía secundaria (📕 📋 🔒 ⬇ 🖨️ 📤 🗑️ ⚠️ ✅ 💾)
  en botones y títulos de bloque. Es una decisión de estilo del producto, no un descuido.

---

## 13. Documentos imprimibles

Patrón para actas, certificados e informes. **Es la única zona donde se usan hex literales.**

```js
// Paleta de marca fija para papel
export const BRAND = {
  orange: '#EC671A', orangeSoft: '#FEF0E6',
  purple: '#5E4F9C', purpleSoft: '#F0EDF7',
  blue:   '#3A5BA7', blueSoft:   '#EEF2FA',
  green:  '#024B4E', greenSoft:  '#E8F1F0',
  dark:   '#1A1A2E', gray: '#5A5A6E', line: '#E5E7EB',
}
```

⚠️ Por qué literales: `--purple` cambia con `data-accent` y **toda** la paleta cambia en
modo oscuro. Un documento impreso no puede depender de la preferencia de pantalla del
usuario.

```css
@media print {
  body * { visibility: hidden !important; }
  #clone-print, #clone-print * { visibility: visible !important; }
  #clone-print {
    position: absolute; left: 0; top: 0; width: 100%; padding: 0 24px;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  #clone-print * {
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .no-print { display: none !important; }
  #clone-print table  { page-break-inside: auto; }
  #clone-print tr     { page-break-inside: avoid; page-break-after: auto; }
  #clone-print thead  { display: table-header-group; }
}
```

Puntos que cuestan un rediseño si se olvidan:

1. **`print-color-adjust: exact` es obligatorio.** Sin él, los navegadores descartan
   fondos y filetes y el documento sale en gris.
2. **`visibility: hidden` en todo y `visible` en el documento**, en lugar de
   `display:none`: conserva el layout y evita reflows raros al imprimir.
3. **`thead { display: table-header-group }`** repite el encabezado en cada página.
4. Las fichas o tarjetas que no deben partirse llevan `pageBreakInside: 'avoid'`;
   los títulos de bloque, `pageBreakAfter: 'avoid'`.
5. **No hay librería de PDF.** Todo sale por `window.print()`. Es suficiente y evita
   ~300 KB de dependencia.
6. Estructura del documento: cabecera de marca (logo + filete tricolor + título +
   fichas de contexto) → bloques numerados con color → firmas → pie con logo.

**Filete tricolor de marca** (proporción 6 : 2 : 1):

```jsx
<div style={{ display:'flex', height:4, borderRadius:2, overflow:'hidden' }}>
  <div style={{ flex:6, background:'#EC671A' }} />
  <div style={{ flex:2, background:'#5E4F9C' }} />
  <div style={{ flex:1, background:'#024B4E' }} />
</div>
```

**Trampa del logo:** `logo-ceinfes.png` es un lienzo **cuadrado** (4500×4500) donde el
wordmark ocupa ~15 % del alto, centrado, y el resto es transparente. Dimensionarlo por
`height` lo deja diminuto. Hay que dimensionar por **ancho** y recortar el vacío:

```jsx
const LOGO_CROP = 0.22   // alto útil ≈ 22 % del ancho

const BrandLogo = ({ w = 190 }) => (
  <div style={{ width:w, height:Math.round(w*LOGO_CROP), position:'relative',
    overflow:'hidden', flexShrink:0 }}>
    <img src="/logo-ceinfes.png" alt="CEINFES"
      style={{ width:w, height:'auto', position:'absolute', left:0, top:'50%',
        transform:'translateY(-50%)' }} />
  </div>
)
```

En pantalla, el componente general del logo usa `width: h * 5` con `height: 'auto'` por
la misma razón, y aplica `filter: brightness(0) invert(1)` sobre fondos oscuros.

---

## 14. Temas inmersivos (capa opcional)

Experia puede vestir un curso completo con `<html data-course-theme="…">`. Son cuatro
temas que **redefinen los tokens globales** y añaden una capa ambiental animada
(`position: fixed; inset: 0; pointer-events: none; z-index: 40`).

| Tema | Ambiente | Color guía |
|---|---|---|
| `detective` | Noir: lluvia, linterna, polvo, viñeta parpadeante | Ámbar `#D4A017` sobre negro `#0A0A0F` |
| `escape-room` | Mazmorra: antorchas, engranajes, puertas | Ámbar cálido |
| `lab` | Laboratorio: burbujas, electrones, chispas, escáner | Cian `#00D4FF` |
| `time-travel` | Cosmos: relojes, portales, grietas temporales | Azul `#5B8DD9` |

Ejemplo del mecanismo (tema detective, abreviado):

```css
[data-course-theme="detective"] {
  color-scheme: dark;

  /* 1) Paleta propia del tema */
  --det-bg:#0A0A0F; --det-panel:#13120F; --det-card:#1C1A16;
  --det-amber:#D4A017; --det-amber-dk:#A07810; --det-amber-bg:rgba(212,160,23,.12);
  --det-red:#8B1A1A; --det-cream:#EDE8DC; --det-muted:#7A7060;
  --det-border:rgba(212,160,23,.22);

  /* 2) Remapeo de los tokens globales → la app entera se re-viste sola */
  --bg:var(--det-bg); --bg-alt:var(--det-panel); --white:var(--det-card);
  --border:var(--det-border); --dark:var(--det-cream); --text:var(--det-cream);
  --text-sec:#C4BCA8; --muted:var(--det-muted); --subtle:#5A5040;
  --orange:var(--det-amber); --orange-light:#E8B830; --orange-bg:var(--det-amber-bg);
  --purple:#8B5E3C; --purple-deep:#6B4030;
  --gradient:linear-gradient(125deg,#1C1208 0%,#3A2A10 35%,#6B4A20 65%,var(--det-amber) 100%);

  /* 3) Sombras propias del tema */
  --sh-md:0 4px 16px rgba(0,0,0,.7), 0 0 0 1px var(--det-border);
  --sh-xl:0 16px 56px rgba(0,0,0,.9), 0 0 20px rgba(212,160,23,.08);
}
```

**La lección transferible:** como todos los componentes consumen tokens y ninguno tiene
color propio, un tema completo son ~40 líneas de remapeo. Si en tu plataforma nueva
piensas tener modos o marcas distintas, esta es la razón para no poner hex en los
componentes.

Cada tema pesa 300–500 líneas de CSS ambiental (`@keyframes` + clases `.det-*`,
`.esc-*`, `.lab-*`, `.tt-*`) y su overlay React se carga con `React.lazy`, así que solo
lo descarga quien entra a ese curso.

---

## 15. Arranque del tema (sin parpadeo)

El tema se aplica **antes del primer paint**, con un script bloqueante inline en el
`<head>` — si esperas a React, se ve un flash blanco.

```html
<meta name="theme-color" content="#E8732C" />
<script>
  (function () {
    try {
      var theme = localStorage.getItem('mi-app-theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      var accent = localStorage.getItem('mi-app-accent');
      if (accent && accent !== 'morado') document.documentElement.setAttribute('data-accent', accent);
      if (localStorage.getItem('mi-app-contrast') === 'alto') {
        document.documentElement.setAttribute('data-contrast', 'alto');
      }
    } catch (e) { /* localStorage bloqueado: tema claro por defecto */ }
  })();
</script>
```

> En Experia hay una condición extra: el modo oscuro solo se aplica si existe una sesión
> activa, porque la landing y el login son **siempre** claros.

API de tema (`src/lib/theme.js`) — el estado vive en el DOM y en `localStorage`, no en React:

```js
getTheme() / setTheme('dark'|'light') / toggleTheme()
getSavedTheme()        // preferencia guardada, o la del sistema si no hay
applySavedTheme()      // aplica al DOM (páginas autenticadas)
applyLightOnly()       // fuerza claro SIN borrar la preferencia (landing/login)
getAccent() / setAccent(id)
getContrast() / setContrast('alto'|'normal') / toggleContrast()
useTheme() / useContrast()   // hooks de solo lectura reactiva
```

El truco del hook: no guarda estado propio, escucha un evento `window` y fuerza
re-render con `useReducer(x => x + 1, 0)`. Así todos los componentes que muestran el
estado del tema (header, perfil) se actualizan juntos.

Claves de `localStorage`: `experia-theme`, `experia-accent`, `experia-contrast`.

---

## 16. Checklist para arrancar la plataforma nueva

**Copia tal cual (es lo que da el "se ve igual"):**

1. El `@font-face` de Inter + `--font` + el reset y la base del `<body>`.
2. El bloque completo de tokens de `:root` (§2), el de `[data-theme="dark"]` (§3),
   el de `[data-contrast="alto"]` (§4) y `--viz-1..8` (§5).
3. Radios, sombras, glass y curvas de animación (§6).
4. Los keyframes y las seis utilidades (§7).
5. El focus ring, el skip link y el bloque de `prefers-reduced-motion` (§8).
6. El script anti-parpadeo del `<head>` (§15).
7. `Btn`, `Modal`, `Skeleton`, `ProgressRing`/`ProgressBar` y los objetos `inp` / `lbl` / `card` (§11).
8. El wrapper `Sv` de iconos (§12) — copia solo los iconos que uses.

**Adapta:**

- El breakpoint (768) y `--sidebar-w` / `--header-h` si tu shell es distinto.
- La escala `z-index` (§10) — mantenla como tabla explícita desde el día uno.
- El bloque `BRAND` y el CSS de impresión, si vas a generar documentos (§13).

**No copies** (es específico de Experia): los cuatro temas inmersivos, la celebración
temática, el tutor de cuerpo entero y el avatar por rangos — salvo que tu producto
también sea gamificado.

**Los tres errores que este sistema ya pagó, no los repitas:**

1. Poner un hex en un componente. Rompe el modo oscuro, el acento y los temas de una,
   y no se nota hasta que alguien cambia de tema.
2. Imprimir sin `print-color-adjust: exact`. El documento sale en gris.
3. Dejar un `animation-fill-mode` con `transform` en un contenedor de página: crea un
   *containing block* y los modales `position: fixed` de adentro se recortan.
