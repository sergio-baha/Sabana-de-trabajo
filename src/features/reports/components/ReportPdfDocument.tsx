import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { PersonMonthTotal, ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"
import type { ManagerMonthTotal } from "@/features/reports/api/reportsApi"

const BRAND_PURPLE = "#5E4F9C"
const BRAND_GREEN = "#024B4E"
const BORDER = "#E5E4E7"
const MUTED = "#6B6375"

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 18, fontWeight: 700, color: BRAND_PURPLE },
  subtitle: { fontSize: 11, color: MUTED, marginTop: 2, marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: BRAND_GREEN,
    marginTop: 18,
    marginBottom: 8,
  },
  kpiRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 8,
  },
  kpiLabel: { fontSize: 8, color: MUTED },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trLast: { flexDirection: "row" },
  th: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, backgroundColor: "#F5F4F8" },
  td: { flex: 1, padding: 6, fontSize: 9 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: MUTED },
})

interface ReportPdfDocumentProps {
  companyName: string
  monthName: string
  people: PersonMonthTotal[]
  projects: ProjectMonthTotal[]
  managers: ManagerMonthTotal[]
  generatedAt: Date
}

export default function ReportPdfDocument({
  companyName,
  monthName,
  people,
  projects,
  managers,
  generatedAt,
}: ReportPdfDocumentProps) {
  const activeProjects = projects.filter((p) => p.status !== "archivado")
  const totalAllocated = people.reduce((sum, p) => sum + p.allocated_hours, 0)
  const totalAvailable = people.reduce((sum, p) => sum + p.available_hours, 0)
  const overallocated = people.filter((p) => p.status_color === "rojo").length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Distribución de Trabajo</Text>
        <Text style={styles.subtitle}>
          {companyName} · Reporte mensual · {monthName}
        </Text>

        <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PERSONAS</Text>
            <Text style={styles.kpiValue}>{people.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PROYECTOS</Text>
            <Text style={styles.kpiValue}>{activeProjects.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>HORAS ASIGNADAS</Text>
            <Text style={styles.kpiValue}>{totalAllocated}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>HORAS DISPONIBLES</Text>
            <Text style={styles.kpiValue}>{totalAvailable}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>SOBREASIGNADAS</Text>
            <Text style={styles.kpiValue}>{overallocated}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Horas por proyecto</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Proyecto</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={styles.th}>Horas asignadas</Text>
            <Text style={styles.th}>Personas</Text>
          </View>
          {activeProjects.map((p, i) => (
            <View style={i === activeProjects.length - 1 ? styles.trLast : styles.tr} key={p.project_id}>
              <Text style={styles.td}>{p.name}</Text>
              <Text style={styles.td}>{p.status}</Text>
              <Text style={styles.td}>{p.allocated_hours}</Text>
              <Text style={styles.td}>{p.people_count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Horas por gerente</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Gerente</Text>
            <Text style={styles.th}>Horas bajo su gestión</Text>
            <Text style={styles.th}>Proyectos</Text>
          </View>
          {managers.map((m, i) => (
            <View style={i === managers.length - 1 ? styles.trLast : styles.tr} key={m.manager_id}>
              <Text style={styles.td}>{m.manager_name}</Text>
              <Text style={styles.td}>{m.allocated_hours}</Text>
              <Text style={styles.td}>{m.projects_count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Generado el {generatedAt.toLocaleString("es-CO")} · Distribución de Trabajo
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Ranking de carga laboral</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Persona</Text>
            <Text style={styles.th}>Cargo</Text>
            <Text style={styles.th}>Disponibles</Text>
            <Text style={styles.th}>Asignadas</Text>
            <Text style={styles.th}>% Utilización</Text>
            <Text style={styles.th}>Estado</Text>
          </View>
          {[...people]
            .sort((a, b) => b.allocated_hours - a.allocated_hours)
            .map((p, i, arr) => (
              <View style={i === arr.length - 1 ? styles.trLast : styles.tr} key={p.person_id}>
                <Text style={styles.td}>{p.name}</Text>
                <Text style={styles.td}>{p.job_title ?? "—"}</Text>
                <Text style={styles.td}>{p.available_hours}</Text>
                <Text style={styles.td}>{p.allocated_hours}</Text>
                <Text style={styles.td}>
                  {p.available_hours > 0
                    ? `${Math.round((p.allocated_hours / p.available_hours) * 100)}%`
                    : "—"}
                </Text>
                <Text style={styles.td}>{p.status_color}</Text>
              </View>
            ))}
        </View>
        <Text style={styles.footer}>
          Generado el {generatedAt.toLocaleString("es-CO")} · Distribución de Trabajo
        </Text>
      </Page>
    </Document>
  )
}
