export const NIVELES = ["sin_acceso", "ver", "editar"] as const;
export type Nivel = (typeof NIVELES)[number];

export type PanelDef = { codigo: string; nombre: string; implementado: boolean };

// Orden = orden del menú. `implementado` pasa a true a medida que se construye cada etapa.
export const PANELES: PanelDef[] = [
  { codigo: "dashboard",    nombre: "Panel principal",        implementado: true },
  { codigo: "pedidos",      nombre: "Pedidos",                implementado: true },
  { codigo: "hoja_de_ruta", nombre: "Hoja de ruta",           implementado: true },
  { codigo: "clientes",     nombre: "Clientes",               implementado: true },
  { codigo: "transportes",  nombre: "Transportes",            implementado: true },
  { codigo: "armado",       nombre: "Armado y productividad", implementado: true },
  { codigo: "stock",        nombre: "Stock",                  implementado: true },
  { codigo: "inventario",   nombre: "Inventario físico",      implementado: true },
  { codigo: "insumos",      nombre: "Insumos",                implementado: true },
  { codigo: "recepcion",    nombre: "Recepción",              implementado: true },
  { codigo: "tareas",       nombre: "Tareas",                 implementado: true },
  { codigo: "postventa",    nombre: "Postventa",              implementado: true },
  { codigo: "reportes",     nombre: "Reportes",               implementado: true },
  { codigo: "historial",    nombre: "Historial",              implementado: true  },
  { codigo: "usuarios",     nombre: "Usuarios y permisos",    implementado: true  },
];

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  sin_acceso: "Sin acceso",
  ver: "Solo ver",
  editar: "Editar",
};

export function panelPorCodigo(codigo: string) {
  return PANELES.find((p) => p.codigo === codigo);
}

const ORDEN: Record<Nivel, number> = { sin_acceso: 0, ver: 1, editar: 2 };
export function alcanza(actual: Nivel, minimo: Nivel) {
  return ORDEN[actual] >= ORDEN[minimo];
}
