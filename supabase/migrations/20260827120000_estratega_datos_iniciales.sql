-- Gobernanza · carga inicial (corte de junio de 2026).
--
-- FUENTE: SEGUIMIENTO_A_GESTORES_2026.xlsx, tal como quedó incrustado en
-- dashboard_ceinfes_2026.html (arreglos DB_FINANZAS, DB_TAREAS y
-- PIPELINE_PRODUCTS). Esa es la última sincronización de Power Automate:
-- 24/07/2026 16:54.
--
-- TRES ARREGLOS SOBRE EL DATO DE ORIGEN, TODOS DELIBERADOS:
--
-- 1. `Julian Bedoya` → `Julián Bedoya`. El Excel escribe el nombre sin tilde
--    de febrero a mayo y con tilde en junio. Es la misma persona; dejarlo
--    como viene la parte en dos gestores en todos los agregados. Se unifica a
--    la forma correcta.
--
-- 2. El entregable de mayo de Katherine Bustos "Aplicación de la encuesta
--    Light..." trae `JUNIO` en la columna de estado: no es un estado, es el
--    mes al que se aplazó. Entra como `aplazado`. (En el script del
--    dashboard ese valor ni siquiera tiene color: el mapa que lo define se
--    redeclara enseguida sin él, y el estado termina pintado de gris.)
--
-- 3. Las tres filas de abril de Claudia Gacharná vienen con estado en blanco
--    —su acompañamiento arrancó ese mes— y entran como NULL.
--
-- El checklist de cada producto se genera al final a partir de los
-- contadores de la hoja PIPELINE y de los nombres de entregable por fase del
-- mini-dashboard E-PROD, marcando como completados los primeros N de cada
-- fase. Es exactamente lo que hacía `initData()` en el original, pero
-- persistido: aquí el checklist es la única fuente del avance.

-- ---------------------------------------------------------------------------
-- 1. Ejecución financiera · 21 filas, febrero a junio de 2026
-- ---------------------------------------------------------------------------
insert into public.estratega_finanzas (anio, mes, colaborador, presupuestado, ejecutado) values
  (2026, 2, 'Adriana Vargas',    13128419, 12603419),
  (2026, 2, 'Katherine Bustos',   5584284,  2777760),
  (2026, 2, 'Andrea Buitrago',   26217555, 10921746),
  (2026, 2, 'Julián Bedoya',     12199140,        0),
  (2026, 3, 'Adriana Vargas',    14664802, 13198124),
  (2026, 3, 'Katherine Bustos',  18451230,  4073176),
  (2026, 3, 'Andrea Buitrago',   28455875, 13975069),
  (2026, 3, 'Julián Bedoya',     24247810,        0),
  (2026, 4, 'Adriana Vargas',    13128419, 12948124),
  (2026, 4, 'Katherine Bustos',  38173133,  3680116),
  (2026, 4, 'Andrea Buitrago',   21096075, 16373163),
  (2026, 4, 'Julián Bedoya',     17536800,        0),
  (2026, 4, 'Claudia Gacharná',         0,        0),
  (2026, 5, 'Adriana Vargas',    13334979, 13739802),
  (2026, 5, 'Katherine Bustos',  38173133,  8470930),
  (2026, 5, 'Andrea Buitrago',   30386195,  7040109),
  (2026, 5, 'Julián Bedoya',     39792007,        0),
  (2026, 6, 'Adriana Vargas',    10060464, 10811729),
  (2026, 6, 'Katherine Bustos',  38173133,  8854501),
  (2026, 6, 'Andrea Buitrago',    8164715,  5731909),
  (2026, 6, 'Julián Bedoya',      6364871,        0);

-- ---------------------------------------------------------------------------
-- 2. Entregables pipeline · 128 filas
-- ---------------------------------------------------------------------------
-- Los textos van tal cual vienen del Excel, con sus erratas ("recusros",
-- "abordage", "radigrafía", "educcación", "nadkind"). Corregirlas rompería
-- la comparación contra la hoja de origen, que es el control de calidad de
-- esta carga.
insert into public.estratega_entregables (anio, mes, colaborador, descripcion, estado) values
  (2026, 2, 'Adriana Vargas', 'Gestión de centrales de cobro dentro de los tiempos establecidos (20 a 25 de cada mes) + Consolidado para financiera', 'no_entregado'),
  (2026, 2, 'Adriana Vargas', 'Seguimiento de la ejecución presupuestal por proyecto y actualización del excel de seguimiento', 'entregado'),
  (2026, 2, 'Adriana Vargas', 'Seguimiento de actividades deadline proyectos/gestores y actualización del excel de seguimiento', 'no_entregado'),
  (2026, 2, 'Katherine Bustos', 'Tener una amplio porcentaje de los tres hitos del producto NOVA, así mismo tener claridad acerca del modelo de negocio y GTM.', 'en_proceso'),
  (2026, 2, 'Katherine Bustos', 'Establecer la diferenciación de Nova básico y Nova premium', 'en_proceso'),
  (2026, 2, 'Katherine Bustos', 'Desarrollar en un alto porcentaje el PMV de pruebas a medida, con fines de testeo y articular sus lienzos para generar diferenciales con productos de la línea estandarizada de seguimiento y de entrenamiento.', 'en_proceso'),
  (2026, 2, 'Katherine Bustos', 'Entregar todo el mapa de acción y de implementación (empezando por la prediseñadas), generar cuales son los recusros , tiempos y espacios para realizar el experimento de enseñanza aprendizaje desde la IA', 'en_proceso'),
  (2026, 2, 'Katherine Bustos', 'Entregar la encuesta Light, mínimo con una versión de validez.', 'en_proceso'),
  (2026, 2, 'Andrea Buitrago', 'Implementación del PMV2 en Ceinfes y cronograma o mapa de abordage para formalizar casos de éxito (kpdata y OGR)', 'en_proceso'),
  (2026, 2, 'Andrea Buitrago', 'Realizar Benchmark acerca de competidores que generan formación y capacitación de UPPIE EMPRESARIAL. Entregar presupuesto.', 'en_proceso'),
  (2026, 2, 'Andrea Buitrago', 'Generar lienzos de propuesta de valor, ficha y ecosistema de producto de UPPIE EMPRESARIAL (modelo ecosistema)', 'en_proceso'),
  (2026, 2, 'Andrea Buitrago', 'Desarrollar un prototipo funcional del IME y validar concepto y producto con ASCOL', 'entregado'),
  (2026, 2, 'Andrea Buitrago', 'Proponer el ecosistema y los módulos de PADRES 4.0 como un producto emergente y comercializable.', 'en_proceso'),
  (2026, 2, 'Andrea Buitrago', 'Realizar un benchmarking para medir el mercado, incluyendo una medición financiera para PADRES 4.0.', 'no_entregado'),
  (2026, 2, 'Julián Bedoya', 'Proponer un portafolio de formación y capacitación para Xpertpro', 'en_proceso'),
  (2026, 2, 'Julián Bedoya', 'Propuesta en un NAPKIND de la iniciativa de EDUTEKA y ruta de trabajo (sugiero trabajar paradigma vincular).', 'no_entregado'),
  (2026, 2, 'Julián Bedoya', 'Proponer una primera versión del ecosistema de pensamiento ciudadano. El componente evaluativo ira por IA para que el rubro se pueda invertir en aspectos relevantes del ecosistema.', 'entregado'),
  (2026, 2, 'Julián Bedoya', 'Actualización Docente: Entrega del benchmarking (mínimo 15 variables), eliminando los commodities.', 'entregado'),
  (2026, 3, 'Adriana Vargas', 'Gestión de centrales de cobro dentro de los tiempos establecidos (20 a 25 de cada mes) + Consolidado para financiera', 'entregado'),
  (2026, 3, 'Adriana Vargas', 'Seguimiento de la ejecución presupuestal por proyecto y actualización del excel de seguimiento', 'entregado'),
  (2026, 3, 'Adriana Vargas', 'Seguimiento de actividades deadline proyectos/gestores y registro en excel de seguimiento', 'entregado'),
  (2026, 3, 'Adriana Vargas', 'Caracterización del proceso y de la iniciativa V1', 'en_proceso'),
  (2026, 3, 'Adriana Vargas', 'Presentación resultados encuesta analistas "termómetro del proceso"', 'entregado'),
  (2026, 3, 'Adriana Vargas', 'Instrumento de validación trabajo analistas para evaluación por parte de los gestores', 'en_proceso'),
  (2026, 3, 'Katherine Bustos', 'Ecosistema digital: Generar usuarios al equipo dos docentes y dos estudiantes para: conocimiento, manejo y recomendaciones, asi como articulación con otras iniciativas.', 'entregado'),
  (2026, 3, 'Katherine Bustos', 'Pruebas a medida: Afinar con marketing el modelo de negocio y el desarrollo del producto.', 'en_proceso'),
  (2026, 3, 'Katherine Bustos', 'Pruebas a medida: pilas con los commoditys, y salir con B2B y llegar al B2C.', 'entregado'),
  (2026, 3, 'Katherine Bustos', 'Pruebas a medida: Ficha técnica para poder llevar a candidatos de testeo.', 'en_proceso'),
  (2026, 3, 'Katherine Bustos', 'Tener una amplio porcentaje de los tres hitos del producto NOVA, así mismo tener claridad acerca del modelo de negocio y GTM.', 'entregado'),
  (2026, 3, 'Katherine Bustos', 'Establecer la diferenciación de Nova básico y Nova premium', 'entregado'),
  (2026, 3, 'Katherine Bustos', 'Desarrollar en un alto porcentaje el PMV de pruebas a medida, con fines de testeo y articular sus lienzos para generar diferenciales con productos de la línea estandarizada de seguimiento y de entrenamiento.', 'en_proceso'),
  (2026, 3, 'Katherine Bustos', 'Entregar todo el mapa de acción y de implementación (empezando por la prediseñadas), generar cuales son los recusros , tiempos y espacios para realizar el experimento de enseñanza aprendizaje desde la IA', 'entregado'),
  (2026, 3, 'Katherine Bustos', 'Entregar la encuesta Light, mínimo con una versión de validez.', 'en_proceso'),
  (2026, 3, 'Andrea Buitrago', 'Implementación del PMV2 en Ceinfes y cronograma o mapa de abordage para formalizar casos de éxito (kpdata y OGR)', 'en_proceso'),
  (2026, 3, 'Andrea Buitrago', 'Realizar Benchmark acerca de competidores que generan formación y capacitación de UPPIE EMPRESARIAL. Entregar presupuesto.', 'en_proceso'),
  (2026, 3, 'Andrea Buitrago', 'Generar lienzos de propuesta de valor, ficha y ecosistema de producto de UPPIE EMPRESARIAL (modelo ecosistema)', 'en_proceso'),
  (2026, 3, 'Andrea Buitrago', 'Proponer el ecosistema y los módulos de PADRES 4.0 como un producto emergente y comercializable.', 'en_proceso'),
  (2026, 3, 'Andrea Buitrago', 'Realizar un benchmarking para medir el mercado, incluyendo una medición financiera para PADRES 4.0.', 'no_entregado'),
  (2026, 3, 'Julián Bedoya', 'Generar algunas sesiones para trabajar una evaluación de la situación para que se centre la necesidad, el problema a solucionar y un mapa de modulos.', 'en_proceso'),
  (2026, 3, 'Julián Bedoya', 'Generar un nadkind, y un flujo inicial de que se podria ofrecer', 'en_proceso'),
  (2026, 3, 'Julián Bedoya', 'Proponer un portafolio de formación y capacitación para Xpertpro', 'en_proceso'),
  (2026, 3, 'Julián Bedoya', 'Propuesta en un NAPKIND de la iniciativa de EDUTEKA y ruta de trabajo (sugiero trabajar paradigma vincular).', 'no_entregado'),
  (2026, 4, 'Adriana Vargas', 'Gestión de centrales de cobro dentro de los tiempos establecidos (20 a 25 de cada mes) + Consolidado para financiera', 'entregado'),
  (2026, 4, 'Adriana Vargas', 'Seguimiento de la ejecución presupuestal por proyecto y actualización del excel de seguimiento', 'entregado'),
  (2026, 4, 'Adriana Vargas', 'Seguimiento de actividades deadline proyectos/gestores y actualización del excel de seguimiento', 'entregado'),
  (2026, 4, 'Adriana Vargas', 'Presentación estado presupuestal del primer corte (general y por proyectos). Notificación de rubros castigados', 'entregado'),
  (2026, 4, 'Adriana Vargas', 'Caracterización del proceso V1 + Flujo de proceso', 'en_proceso'),
  (2026, 4, 'Adriana Vargas', 'Instrumento de validación trabajo analistas para evaluación por parte de los gestores.', 'en_proceso'),
  (2026, 4, 'Katherine Bustos', 'Entrega de la V1 de Ecosistema Digital IA Ceinfes', 'entregado'),
  (2026, 4, 'Katherine Bustos', 'Validación de pertinencia para incluir Simulacros GO en el ecosistema digital', 'entregado'),
  (2026, 4, 'Katherine Bustos', 'Incluir en el demo de pruebas a medida banco de ítems de todas las áreas, con rejilla (aunque no tenga measure)', 'en_proceso'),
  (2026, 4, 'Katherine Bustos', 'Levantamiento de requerimientos funcionales, modulo 2 y 3 pruebas Pensar 2027', 'en_proceso'),
  (2026, 4, 'Katherine Bustos', 'Definir qué problema se va a solucionar y qué necesidad del mercado se va a atender con Pruebas a la medida', 'en_proceso'),
  (2026, 4, 'Katherine Bustos', 'Desarrollar en un alto porcentaje el PMV de pruebas a medida, con fines de testeo y articular sus lienzos para generar diferenciales con productos de la línea estandarizada de seguimiento y de entrenamiento.', 'en_proceso'),
  (2026, 4, 'Katherine Bustos', 'Entregar la encuesta Light, mínimo con una versión de validez.', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Entrega de la V1 de los ecosistemas Uppie, XpertPro, grupo de investigación', 'entregado'),
  (2026, 4, 'Andrea Buitrago', 'Radiografía de la educación - Cundinamarca', 'entregado'),
  (2026, 4, 'Andrea Buitrago', 'Actualización de los artículos en la página Web', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Implementación del PMV2 en Ceinfes y cronograma o mapa de abordage para formalizar casos de éxito (kpdata y OGR)', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Realizar Benchmark acerca de competidores que generan formación y capacitación de UPPIE EMPRESARIAL. Entregar presupuesto.', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Generar lienzos de propuesta de valor, ficha y ecosistema de producto de UPPIE EMPRESARIAL (modelo ecosistema)', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Proponer el ecosistema y los módulos de PADRES 4.0 como un producto emergente y comercializable.', 'en_proceso'),
  (2026, 4, 'Andrea Buitrago', 'Realizar un benchmarking para medir el mercado, incluyendo una medición financiera para PADRES 4.0.', 'en_proceso'),
  (2026, 4, 'Julián Bedoya', 'Entrega de la V1 de los ecosistemas Pensamiento Ciudadano, Actualización docente', 'entregado'),
  (2026, 4, 'Julián Bedoya', 'Generar algunas sesiones para trabajar una evaluación de la situación para que se centre la necesidad, el problema a solucionar y un mapa de modulos.', 'en_proceso'),
  (2026, 4, 'Julián Bedoya', 'Generar un nadkind, y un flujo inicial de que se podria ofrecer', 'entregado'),
  (2026, 4, 'Julián Bedoya', 'Proponer un portafolio de formación y capacitación para Xpertpro', 'entregado'),
  (2026, 4, 'Julián Bedoya', 'Propuesta en un NAPKIND de la iniciativa de EDUTEKA y ruta de trabajo (sugiero trabajar paradigma vincular).', 'no_entregado'),
  (2026, 4, 'Claudia Gacharná', 'Cronograma de apoyo al proceso de consultoria (marzo y abril)', null),
  (2026, 4, 'Claudia Gacharná', 'Deadline con despliegue de mayo', null),
  (2026, 4, 'Claudia Gacharná', 'Entrega de la V1 del ecosistema del modelo de consultoría', null),
  (2026, 5, 'Adriana Vargas', 'Gestión de centrales de cobro dentro de los tiempos establecidos (20 a 25 de cada mes) + Consolidado para financiera', 'entregado'),
  (2026, 5, 'Adriana Vargas', 'Seguimiento de la ejecución presupuestal por proyecto y actualización del excel de seguimiento', 'entregado'),
  (2026, 5, 'Adriana Vargas', 'Seguimiento de actividades deadline proyectos/gestores y actualización del excel de seguimiento', 'entregado'),
  (2026, 5, 'Adriana Vargas', 'Estructura de ritual para seguimiento y acompañamiento de analistas + Formatos', 'en_proceso'),
  (2026, 5, 'Adriana Vargas', 'Entrega de informe de las membresias Platzi (usabilidad, impacto y costo vs uso)', 'no_entregado'),
  (2026, 5, 'Adriana Vargas', 'Caracterización del proceso V1 + Flujo de proceso', 'entregado'),
  (2026, 5, 'Adriana Vargas', 'Instrumento de validación trabajo analistas para evaluación por parte de los gestores.', 'entregado'),
  (2026, 5, 'Katherine Bustos', 'Incluir en el demo de pruebas a medida banco de ítems de todas las áreas, con rejilla (aunque no tenga measure)', 'entregado'),
  (2026, 5, 'Katherine Bustos', 'Levantamiento de requerimientos funcionales V1, modulo 2 y 3 pruebas Pensar 2027', 'entregado'),
  (2026, 5, 'Katherine Bustos', 'Definir qué problema se va a solucionar y qué necesidad del mercado se va a atender con Pruebas a la medida', 'en_proceso'),
  (2026, 5, 'Katherine Bustos', 'Desarrollar en un alto porcentaje el PMV de pruebas a medida, con fines de testeo y articular sus lienzos para generar diferenciales con productos de la línea estandarizada de seguimiento y de entrenamiento.', 'en_proceso'),
  (2026, 5, 'Katherine Bustos', 'Entregar la encuesta Light, mínimo con una versión de validez (Ecosistema digital).', 'entregado'),
  (2026, 5, 'Katherine Bustos', 'Aplicación de la encuesta Light + análisis de resultados (Ecosistema digital)', 'aplazado'),
  (2026, 5, 'Andrea Buitrago', 'Radiografía de la educación - Valle', 'entregado'),
  (2026, 5, 'Andrea Buitrago', 'Estructura de radigrafía de salud mental', 'entregado'),
  (2026, 5, 'Andrea Buitrago', 'Caracterización de competencias Docentes', 'no_entregado'),
  (2026, 5, 'Andrea Buitrago', 'Jornada de ideación - Ecosistemas en términos de investigación', 'entregado'),
  (2026, 5, 'Andrea Buitrago', 'Estructura de validación de apropiaciación de los EBC de los últimos 10 años', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Validar costo/oportunidad como variable en la dimensión de calidad del IME en función de apropiación de aprendizajes', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Validación de las dos variables del IME que sean actualizables año a año', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Radiografía de la educcación a partir de los dos trienios de MP', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Estudio Uppie 2025', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Actualización de los artículos en la página Web', 'entregado'),
  (2026, 5, 'Andrea Buitrago', 'Implementación del PMV2 en Ceinfes y cronograma o mapa de abordage para formalizar casos de éxito (kpdata y OGR)', 'detenido'),
  (2026, 5, 'Andrea Buitrago', 'Realizar Benchmark acerca de competidores que generan formación y capacitación de UPPIE EMPRESARIAL. Entregar presupuesto.', 'detenido'),
  (2026, 5, 'Andrea Buitrago', 'Generar lienzos de propuesta de valor, ficha y ecosistema de producto de UPPIE EMPRESARIAL (modelo ecosistema)', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Proponer el ecosistema y los módulos de PADRES 4.0 como un producto emergente y comercializable.', 'en_proceso'),
  (2026, 5, 'Andrea Buitrago', 'Realizar un benchmarking para medir el mercado, incluyendo una medición financiera para PADRES 4.0.', 'en_proceso'),
  (2026, 5, 'Julián Bedoya', 'Generar algunas sesiones para trabajar una evaluación de la situación para que se centre la necesidad, el problema a solucionar y un mapa de modulos (EduteKa).', 'detenido'),
  (2026, 5, 'Julián Bedoya', 'Propuesta en un NAPKIND de la iniciativa de EDUTEKA y ruta de trabajo (sugiero trabajar paradigma vincular).', 'detenido'),
  (2026, 6, 'Adriana Vargas', 'Gestión de centrales de cobro dentro de los tiempos establecidos (20 a 25 de cada mes) + Consolidado para financiera', 'entregado'),
  (2026, 6, 'Adriana Vargas', 'Seguimiento de la ejecución presupuestal por proyecto y actualización del excel de seguimiento', 'entregado'),
  (2026, 6, 'Adriana Vargas', 'Seguimiento de actividades deadline proyectos/gestores y actualización del excel de seguimiento', 'entregado'),
  (2026, 6, 'Adriana Vargas', 'Informe de gestión presupuestal Q2 (abril - junio 2026)', 'entregado'),
  (2026, 6, 'Adriana Vargas', 'Consolidación de instrumentos aplicados al equipo', 'en_proceso'),
  (2026, 6, 'Adriana Vargas', 'Acompañamiento a las novedades presentados con el producto Uppie en ausencia de la gestora por periodo de vacaciones', 'entregado'),
  (2026, 6, 'Adriana Vargas', 'Estructura de ritual para seguimiento y acompañamiento de analistas + Formatos', 'en_proceso'),
  (2026, 6, 'Adriana Vargas', 'Entrega de informe de las membresias Platzi (usabilidad, impacto y costo vs uso)', 'no_entregado'),
  (2026, 6, 'Katherine Bustos', 'Instalación del flujo de proceso de Ecosistema Digital con las áreas de Desarrollo de Cliente y Operaciones', 'entregado'),
  (2026, 6, 'Katherine Bustos', 'Documentación del flujo de proceso de los productos (Ecosistema digital, Pruebas a medida), para la adecuada aprehención de los mismos - Creación de repositorios en SharePoint', 'en_proceso'),
  (2026, 6, 'Katherine Bustos', 'Elaboración de herramientas de autoformación para cliente externo (MOOC) - Ecosistema Digital', 'en_proceso'),
  (2026, 6, 'Katherine Bustos', 'Gestión al desarrollo de la versión B2C de Ecosistema Digital', 'en_proceso'),
  (2026, 6, 'Katherine Bustos', 'Elaboración del mockup de las funcionalidades del rol directivo de Pruebas a la Medida como insumo para la creación de la HU', 'entregado'),
  (2026, 6, 'Katherine Bustos', 'Definir qué problema se va a solucionar y qué necesidad del mercado se va a atender con Pruebas a la medida', 'en_proceso'),
  (2026, 6, 'Katherine Bustos', 'Desarrollar en un alto porcentaje el PMV de pruebas a medida, con fines de testeo', 'entregado'),
  (2026, 6, 'Katherine Bustos', 'Articular los lienzos de Pruebas a la Medida para generar diferenciales con productos de la línea estandarizada de seguimiento y de entrenamiento.', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Diseño de plan operativo de Uppie para los equipo de: Desarrollo de cliente y Operaciones', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Caracterización de competencias Docentes', 'no_entregado'),
  (2026, 6, 'Andrea Buitrago', 'Estructura de validación de apropiaciación de los EBC de los últimos 10 años', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Validar costo/oportunidad como variable en la dimensión de calidad del IME en función de apropiación de aprendizajes', 'no_entregado'),
  (2026, 6, 'Andrea Buitrago', 'Validación de las dos variables del IME que sean actualizables año a año', 'entregado'),
  (2026, 6, 'Andrea Buitrago', 'Radiografía de la educcación a partir de los dos trienios de MP', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Estudio Uppie 2025', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Generar lienzos de propuesta de valor, ficha y ecosistema de producto de UPPIE EMPRESARIAL (modelo ecosistema)', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Proponer el ecosistema y los módulos de PADRES 4.0 como un producto emergente y comercializable.', 'en_proceso'),
  (2026, 6, 'Andrea Buitrago', 'Realizar un benchmarking para medir el mercado, incluyendo una medición financiera para PADRES 4.0.', 'entregado'),
  (2026, 6, 'Julián Bedoya', 'Restructuración y desarrollo del contenido que se anidara en la plataforma de apoyo de los talleres asociados a Actualización Docente (Construcción de preguntas bajo el diseño centrado en evidencias)', 'en_proceso');

-- ---------------------------------------------------------------------------
-- 3. Vínculo con las cuentas de la plataforma
-- ---------------------------------------------------------------------------
-- Los gestores SÍ tienen cuenta. Se emparejan por nombre completo exacto
-- (sin distinguir mayúsculas ni espacios sobrantes). Lo que no case queda en
-- NULL y se puede corregir después desde la pantalla, sin bloquear la carga:
-- es un vínculo de conveniencia, no una llave.
update public.estratega_finanzas f
   set profile_id = p.id
  from public.profiles p
 where f.profile_id is null
   and lower(btrim(p.full_name)) = lower(btrim(f.colaborador));

update public.estratega_entregables e
   set profile_id = p.id
  from public.profiles p
 where e.profile_id is null
   and lower(btrim(p.full_name)) = lower(btrim(e.colaborador));

-- ---------------------------------------------------------------------------
-- 4. Pipeline comercial · 7 iniciativas
-- ---------------------------------------------------------------------------
-- Nombres y células vienen de la hoja PIPELINE del Excel. Ojo: el
-- mini-dashboard E-PROD embebido en el HTML trae OTRO juego de datos (ocho
-- productos, con "Xpert-pro" en Sostenibilidad y otros contadores). Ese es
-- demo viejo; manda la hoja.
--
-- "Ecosistema  digital" viene con doble espacio en el origen. Aquí va con
-- uno: es el nombre de un producto en una pantalla, no una llave de cruce.
insert into public.estratega_productos (nombre, celula, fecha_limite) values
  ('Ecosistema digital',     'evaluacion',        '2026-03-16'),
  ('Pruebas a la medida',    'evaluacion',        '2026-08-18'),
  ('Actualización docente',  'evaluacion',        '2026-09-30'),
  ('Pensamiento ciudadano',  'gestion_academica', '2026-11-30'),
  ('Uppie',                  'gestion_academica', '2026-07-30'),
  ('IME',                    'evaluacion',        '2026-02-02'),
  ('Xpert-pro',              'evaluacion',        '2026-02-20');

-- El checklist, generado desde los contadores de la hoja. `plan` son los
-- pares total/hecho por producto y fase; `titulos` son los nombres de
-- entregable del E-PROD. Cuando una fase tiene más ítems que nombres
-- disponibles (IME lleva 5 en Descubrir y hay 3 nombres; Pruebas a la medida
-- lleva 4 en Entregar y hay 2), los sobrantes salen numerados — igual que en
-- el original.
with titulos(fase, nombres) as (
  values
    ('descubrir'::public.estratega_fase, array[
      'Fuentes Primarias',
      'Benchmark Sectorial',
      'Mapa de Hipótesis'
    ]),
    ('definir'::public.estratega_fase, array[
      'Lienzo de Modelo de Negocio',
      'Lienzo de Propuesta de Valor',
      'Customer Journey',
      'Triángulo de Hierro',
      'Caso de Negocio Operativo'
    ]),
    ('desarrollar'::public.estratega_fase, array[
      'Prototipo Funcional (MVP)',
      'Pruebas de Usuario Real',
      'Benchmark V2 Refinado',
      'Validación Psicométrica / Estructura'
    ]),
    ('entregar'::public.estratega_fase, array[
      'Informe de Seguimiento Técnico',
      'Estrategia de Divulgación y Go-to-Market'
    ])
),
etiquetas(fase, etiqueta) as (
  values
    ('descubrir'::public.estratega_fase, 'Descubrir'),
    ('definir'::public.estratega_fase,   'Definir'),
    ('desarrollar'::public.estratega_fase, 'Desarrollar'),
    ('entregar'::public.estratega_fase,  'Entregar')
),
plan(nombre, fase, total, hecho) as (
  values
    ('Ecosistema digital',    'descubrir'::public.estratega_fase, 2, 2),
    ('Ecosistema digital',    'definir'::public.estratega_fase,     3, 3),
    ('Ecosistema digital',    'desarrollar'::public.estratega_fase, 4, 4),
    ('Ecosistema digital',    'entregar'::public.estratega_fase,    2, 1),
    ('Pruebas a la medida',   'descubrir'::public.estratega_fase,   2, 2),
    ('Pruebas a la medida',   'definir'::public.estratega_fase,     5, 2),
    ('Pruebas a la medida',   'desarrollar'::public.estratega_fase, 4, 1),
    ('Pruebas a la medida',   'entregar'::public.estratega_fase,    4, 1),
    ('Actualización docente', 'descubrir'::public.estratega_fase,   3, 3),
    ('Actualización docente', 'definir'::public.estratega_fase,     5, 0),
    ('Actualización docente', 'desarrollar'::public.estratega_fase, 4, 0),
    ('Actualización docente', 'entregar'::public.estratega_fase,    2, 0),
    ('Pensamiento ciudadano', 'descubrir'::public.estratega_fase,   3, 3),
    ('Pensamiento ciudadano', 'definir'::public.estratega_fase,     5, 0),
    ('Pensamiento ciudadano', 'desarrollar'::public.estratega_fase, 4, 0),
    ('Pensamiento ciudadano', 'entregar'::public.estratega_fase,    2, 0),
    ('Uppie',                 'descubrir'::public.estratega_fase,   3, 3),
    ('Uppie',                 'definir'::public.estratega_fase,     5, 4),
    ('Uppie',                 'desarrollar'::public.estratega_fase, 4, 3),
    ('Uppie',                 'entregar'::public.estratega_fase,    2, 0),
    ('IME',                   'descubrir'::public.estratega_fase,   5, 4),
    ('IME',                   'definir'::public.estratega_fase,     5, 0),
    ('IME',                   'desarrollar'::public.estratega_fase, 4, 1),
    ('IME',                   'entregar'::public.estratega_fase,    2, 0),
    ('Xpert-pro',             'descubrir'::public.estratega_fase,   3, 3),
    ('Xpert-pro',             'definir'::public.estratega_fase,     5, 0),
    ('Xpert-pro',             'desarrollar'::public.estratega_fase, 4, 2),
    ('Xpert-pro',             'entregar'::public.estratega_fase,    2, 0)
)
insert into public.estratega_producto_items (producto_id, fase, titulo, orden, completado)
select
  pr.id,
  pl.fase,
  coalesce(t.nombres[i], 'Entregable ' || et.etiqueta || ' ' || i),
  i,
  i <= pl.hecho
from plan pl
join public.estratega_productos pr on pr.nombre = pl.nombre
join titulos t on t.fase = pl.fase
join etiquetas et on et.fase = pl.fase
cross join lateral generate_series(1, pl.total) as i;
