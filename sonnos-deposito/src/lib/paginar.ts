// PostgREST devuelve como máximo 1000 filas por consulta: esto pide por tandas hasta traer todo.
export async function todas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maximo = 50000,
): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; desde < maximo; desde += 1000) {
    const { data, error } = await pedir(desde, desde + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
