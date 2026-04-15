/** Invalidación ligera del listado del catálogo sin acoplar pantallas entre sí. */
const listeners = new Set<() => void>();

export function subscribeCatalogRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitCatalogRefresh(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}
