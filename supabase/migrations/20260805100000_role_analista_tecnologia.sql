-- Cuarto rol: Analista de Tecnología. A diferencia de los tres anteriores
-- (que se distinguen por *cuánto* pueden hacer sobre todo el mes), este se
-- distingue por *sobre qué* puede hacerlo: solo ve y gestiona el trabajo que
-- tiene asignado — sus tareas y su cronograma —, no el del resto del equipo.
--
-- Va en su propia migración porque Postgres no permite usar un valor de enum
-- recién agregado dentro de la misma transacción que lo crea; las
-- migraciones siguientes ya pueden referenciarlo en funciones y políticas.
alter type public.app_role add value if not exists 'analista_tecnologia';
