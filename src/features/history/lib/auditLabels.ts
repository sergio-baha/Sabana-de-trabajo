// Traducciones compartidas por Dashboard ("últimos cambios") e Historial,
// para no mostrarle al usuario nombres de tabla/columna en snake_case crudo.
export const TABLE_LABELS: Record<string, string> = {
  months: "Mes",
  people: "Persona",
  projects: "Proyecto",
  project_managers: "Gerente de proyecto",
  tasks: "Tarea",
  allocations: "Asignación de horas",
  // Gobernanza: las cuatro tablas del Estratega también se auditan, así que
  // sin estas entradas el Historial mostraría el nombre crudo de la tabla.
  estratega_finanzas: "Ejecución presupuestal",
  estratega_entregables: "Entregable de gestión",
  estratega_productos: "Iniciativa del pipeline",
  estratega_producto_items: "Entregable del pipeline",
}

export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  status: "Estado",
  hours: "Horas",
  available_hours: "Horas disponibles",
  job_title: "Cargo",
  color: "Color",
  notes: "Observaciones",
  description: "Descripción",
  default_hours: "Horas por defecto",
  working_days: "Días laborales",
  title: "Título",
  due_date: "Fecha límite",
  assigned_person_id: "Persona asignada",
  colaborador: "Gestor",
  presupuestado: "Presupuestado",
  ejecutado: "Ejecutado",
  anio: "Año",
  mes: "Mes",
  celula: "Célula",
  fecha_limite: "Fecha límite",
  completado: "Completado",
  titulo: "Título",
  fase: "Fase",
  orden: "Orden",
}

export const ACTION_LABELS: Record<string, string> = {
  insert: "Creó",
  update: "Modificó",
  delete: "Eliminó",
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table
}

export function fieldLabel(field: string | null): string | null {
  if (!field) return null
  return FIELD_LABELS[field] ?? field
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}
