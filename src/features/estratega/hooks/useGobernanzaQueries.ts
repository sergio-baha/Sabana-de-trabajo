import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createEntregable,
  createItem,
  createProducto,
  deleteEntregable,
  deleteFinanza,
  deleteItem,
  deleteProducto,
  listEntregables,
  listFinanzas,
  listProductoItems,
  listProductos,
  setItemCompletado,
  updateEntregable,
  updateItemTitulo,
  updateProducto,
  upsertFinanza,
} from "@/features/estratega/api/gobernanzaApi"

export const gobernanzaKeys = {
  finanzas: ["estratega_finanzas"] as const,
  entregables: ["estratega_entregables"] as const,
  productos: ["estratega_productos"] as const,
  items: ["estratega_producto_items"] as const,
}

export const useFinanzas = () =>
  useQuery({ queryKey: gobernanzaKeys.finanzas, queryFn: listFinanzas })

export const useEntregables = () =>
  useQuery({ queryKey: gobernanzaKeys.entregables, queryFn: listEntregables })

export const useProductos = () =>
  useQuery({ queryKey: gobernanzaKeys.productos, queryFn: listProductos })

export const useProductoItems = () =>
  useQuery({ queryKey: gobernanzaKeys.items, queryFn: listProductoItems })

// Fábrica de mutaciones del módulo: invalida las claves que le digan y avisa.
// `claves` se pasa explícito porque marcar un ítem del checklist mueve el
// porcentaje del producto, que se calcula desde los ítems — hay que refrescar
// las dos listas o la tabla queda mostrando el avance anterior.
function useGobernanzaMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  claves: readonly (readonly string[])[],
  mensaje: string | null
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const clave of claves) queryClient.invalidateQueries({ queryKey: clave })
      if (mensaje) toast.success(mensaje)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export const useUpsertFinanza = () =>
  useGobernanzaMutation(upsertFinanza, [gobernanzaKeys.finanzas], "Ejecución registrada.")

export const useDeleteFinanza = () =>
  useGobernanzaMutation(deleteFinanza, [gobernanzaKeys.finanzas], "Registro eliminado.")

export const useCreateEntregable = () =>
  useGobernanzaMutation(createEntregable, [gobernanzaKeys.entregables], "Entregable agregado.")

export const useUpdateEntregable = () =>
  useGobernanzaMutation(
    ({ id, ...input }: { id: string } & Parameters<typeof updateEntregable>[1]) =>
      updateEntregable(id, input),
    [gobernanzaKeys.entregables],
    "Entregable actualizado."
  )

export const useDeleteEntregable = () =>
  useGobernanzaMutation(deleteEntregable, [gobernanzaKeys.entregables], "Entregable eliminado.")

export const useCreateProducto = () =>
  useGobernanzaMutation(
    createProducto,
    [gobernanzaKeys.productos, gobernanzaKeys.items],
    "Iniciativa agregada al pipeline."
  )

export const useUpdateProducto = () =>
  useGobernanzaMutation(
    ({ id, ...input }: { id: string } & Parameters<typeof updateProducto>[1]) =>
      updateProducto(id, input),
    [gobernanzaKeys.productos],
    "Iniciativa actualizada."
  )

export const useDeleteProducto = () =>
  useGobernanzaMutation(
    deleteProducto,
    [gobernanzaKeys.productos, gobernanzaKeys.items],
    "Iniciativa removida del pipeline."
  )

// Marcar un entregable del checklist no lleva aviso: es la acción que más se
// repite —se recorre una fase marcando cinco casillas seguidas— y una fila de
// notificaciones apiladas por algo que ya se ve en la casilla es ruido.
export const useSetItemCompletado = () =>
  useGobernanzaMutation(
    ({ id, completado }: { id: string; completado: boolean }) =>
      setItemCompletado(id, completado),
    [gobernanzaKeys.items],
    null
  )

export const useCreateItem = () =>
  useGobernanzaMutation(
    (args: Parameters<typeof createItem>) => createItem(...args),
    [gobernanzaKeys.items],
    "Entregable agregado a la fase."
  )

export const useUpdateItemTitulo = () =>
  useGobernanzaMutation(
    ({ id, titulo }: { id: string; titulo: string }) => updateItemTitulo(id, titulo),
    [gobernanzaKeys.items],
    "Entregable renombrado."
  )

export const useDeleteItem = () =>
  useGobernanzaMutation(deleteItem, [gobernanzaKeys.items], "Entregable eliminado.")
