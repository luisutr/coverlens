import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';

export type ValueSource = 'gameplaystores' | 'pricecharting' | 'ebay' | 'manual';

export type GameRecord = {
  id: number;
  title: string;
  barcode: string | null;
  platform: string;
  version: string | null;
  releaseYear: number | null;
  genre: string | null;
  developer: string | null;
  publisher: string | null;
  description: string | null;
  rating: number | null;
  franchise: string | null;
  coverUrl: string | null;
  /** Imagen ancha de cabecera en la ficha (p. ej. IGDB); si es null se usa coverUrl en la cabecera */
  headerImageUrl: string | null;
  /** file:// miniatura para listado; preferir sobre coverUrl en grid si existe */
  coverLocalThumbUri: string | null;
  metadataStatus: 'pending' | 'resolved' | 'partial' | 'error';
  metadataSource: string | null;
  lastError: string | null;
  favorite: number;
  discOnly: number;
  /** Precio en unidades menores (p. ej. céntimos) según valueCurrency */
  valueCents: number | null;
  valueCurrency: string | null;
  valueSource: ValueSource | null;
  valueUpdatedAt: string | null;
  createdAt: string;
};

let dbInstance: SQLiteDatabase | null = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await openDatabaseAsync('gamer_catalog.db');
  }
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      barcode TEXT,
      platform TEXT NOT NULL,
      version TEXT,
      releaseYear INTEGER,
      genre TEXT,
      developer TEXT,
      coverUrl TEXT,
      metadataStatus TEXT NOT NULL DEFAULT 'pending',
      metadataSource TEXT,
      lastError TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      discOnly INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migraciones para columnas nuevas
  const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(games)');
  const cols = new Set(tableInfo.map((c) => c.name));

  if (!cols.has('barcode'))         await db.execAsync('ALTER TABLE games ADD COLUMN barcode TEXT;');
  if (!cols.has('metadataStatus'))  await db.execAsync("ALTER TABLE games ADD COLUMN metadataStatus TEXT NOT NULL DEFAULT 'pending';");
  if (!cols.has('metadataSource'))  await db.execAsync('ALTER TABLE games ADD COLUMN metadataSource TEXT;');
  if (!cols.has('lastError'))       await db.execAsync('ALTER TABLE games ADD COLUMN lastError TEXT;');
  if (!cols.has('publisher'))       await db.execAsync('ALTER TABLE games ADD COLUMN publisher TEXT;');
  if (!cols.has('description'))     await db.execAsync('ALTER TABLE games ADD COLUMN description TEXT;');
  if (!cols.has('rating'))          await db.execAsync('ALTER TABLE games ADD COLUMN rating REAL;');
  if (!cols.has('franchise'))       await db.execAsync('ALTER TABLE games ADD COLUMN franchise TEXT;');
  if (!cols.has('valueCents'))      await db.execAsync('ALTER TABLE games ADD COLUMN valueCents INTEGER;');
  if (!cols.has('valueCurrency'))   await db.execAsync('ALTER TABLE games ADD COLUMN valueCurrency TEXT;');
  if (!cols.has('valueSource'))     await db.execAsync('ALTER TABLE games ADD COLUMN valueSource TEXT;');
  if (!cols.has('valueUpdatedAt'))  await db.execAsync('ALTER TABLE games ADD COLUMN valueUpdatedAt TEXT;');
  if (!cols.has('coverLocalThumbUri')) await db.execAsync('ALTER TABLE games ADD COLUMN coverLocalThumbUri TEXT;');
  if (!cols.has('headerImageUrl')) await db.execAsync('ALTER TABLE games ADD COLUMN headerImageUrl TEXT;');

  // Limpiar duplicados de barcode
  await db.execAsync(`
    DELETE FROM games
    WHERE barcode IS NOT NULL
      AND id NOT IN (
        SELECT MIN(id) FROM games WHERE barcode IS NOT NULL GROUP BY barcode
      );
  `);
  await db.execAsync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_games_barcode_unique ON games(barcode) WHERE barcode IS NOT NULL;'
  );

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_games_metadata_status ON games(metadataStatus);
    CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform);
    CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
    CREATE INDEX IF NOT EXISTS idx_games_release_year ON games(releaseYear);
    CREATE INDEX IF NOT EXISTS idx_games_value_cents ON games(valueCents);
    CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(favorite);
  `);
}

export type NewGameInput = {
  title: string;
  barcode?: string | null;
  platform: string;
  version?: string | null;
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
  rating?: number | null;
  franchise?: string | null;
  coverUrl?: string | null;
  headerImageUrl?: string | null;
  metadataStatus?: 'pending' | 'resolved' | 'partial' | 'error';
  metadataSource?: string | null;
  lastError?: string | null;
  favorite?: 0 | 1;
  discOnly?: 0 | 1;
  valueCents?: number | null;
  valueCurrency?: string | null;
  valueSource?: ValueSource | null;
  valueUpdatedAt?: string | null;
};

export async function addGame(input: NewGameInput): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO games (
      title, barcode, platform, version, releaseYear, genre, developer, publisher,
      description, rating, franchise, coverUrl, headerImageUrl, metadataStatus, metadataSource, lastError, favorite, discOnly,
      valueCents, valueCurrency, valueSource, valueUpdatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.title, input.barcode ?? null, input.platform,
    input.version ?? null, input.releaseYear ?? null,
    input.genre ?? null, input.developer ?? null, input.publisher ?? null,
    input.description ?? null, input.rating ?? null, input.franchise ?? null,
    input.coverUrl ?? null,
    input.headerImageUrl ?? null,
    input.metadataStatus ?? 'pending', input.metadataSource ?? null, input.lastError ?? null,
    input.favorite ?? 0, input.discOnly ?? 0,
    input.valueCents ?? null,
    input.valueCurrency ?? null,
    input.valueSource ?? null,
    input.valueUpdatedAt ?? (input.valueCents != null ? now : null)
  );
  return result.lastInsertRowId;
}

export async function getGameById(gameId: number) {
  const db = await getDb();
  return db.getFirstAsync<GameRecord>('SELECT * FROM games WHERE id = ? LIMIT 1', gameId);
}

export async function getGameByBarcode(barcode: string) {
  const db = await getDb();
  return db.getFirstAsync<GameRecord>('SELECT * FROM games WHERE barcode = ? LIMIT 1', barcode);
}

export async function getGames() {
  const db = await getDb();
  return db.getAllAsync<GameRecord>('SELECT * FROM games ORDER BY id DESC');
}

export async function setFavorite(gameId: number, value: 0 | 1) {
  const db = await getDb();
  await db.runAsync('UPDATE games SET favorite = ? WHERE id = ?', value, gameId);
}

export async function setDiscOnly(gameId: number, value: 0 | 1) {
  const db = await getDb();
  await db.runAsync('UPDATE games SET discOnly = ? WHERE id = ?', value, gameId);
}

export async function updateGameValueEstimate(
  gameId: number,
  input: {
    valueCents: number | null;
    valueCurrency: string | null;
    valueSource: ValueSource | null;
    valueUpdatedAt: string | null;
  }
) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE games SET valueCents=?, valueCurrency=?, valueSource=?, valueUpdatedAt=? WHERE id=?`,
    input.valueCents,
    input.valueCurrency,
    input.valueSource,
    input.valueUpdatedAt,
    gameId
  );
}

export async function updateGameLocalThumbUri(gameId: number, uri: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE games SET coverLocalThumbUri=? WHERE id=?', uri, gameId);
}

export async function deleteGame(gameId: number) {
  const row = await getGameById(gameId);
  if (row?.coverLocalThumbUri) {
    try {
      await FileSystem.deleteAsync(row.coverLocalThumbUri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM games WHERE id = ?', gameId);
}

/** Elimina todos los juegos, borra miniaturas locales y reinicia el contador de ids. */
export async function deleteAllGames(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ coverLocalThumbUri: string | null }>(
    'SELECT coverLocalThumbUri FROM games'
  );
  for (const r of rows) {
    if (r.coverLocalThumbUri) {
      try {
        await FileSystem.deleteAsync(r.coverLocalThumbUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
  }
  await db.runAsync('DELETE FROM games');
  try {
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name='games'");
  } catch {
    /* sqlite_sequence puede no existir en esquemas sin AUTOINCREMENT */
  }
  return rows.length;
}

type MetadataUpdateInput = {
  title: string;
  platform: string;
  version?: string | null;
  releaseYear?: number | null;
  genre?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description?: string | null;
  rating?: number | null;
  franchise?: string | null;
  coverUrl?: string | null;
  headerImageUrl?: string | null;
  metadataStatus: 'pending' | 'resolved' | 'partial' | 'error';
  metadataSource?: string | null;
  lastError?: string | null;
};

export async function updateGameMetadata(gameId: number, input: MetadataUpdateInput) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE games
     SET title=?, platform=?, version=?, releaseYear=?, genre=?, developer=?, publisher=?,
         description=?, rating=?, franchise=?, coverUrl=?, headerImageUrl=?,
         metadataStatus=?, metadataSource=?, lastError=?
     WHERE id=?`,
    input.title, input.platform,
    input.version ?? null, input.releaseYear ?? null,
    input.genre ?? null, input.developer ?? null, input.publisher ?? null,
    input.description ?? null, input.rating ?? null, input.franchise ?? null,
    input.coverUrl ?? null,
    input.headerImageUrl ?? null,
    input.metadataStatus, input.metadataSource ?? null, input.lastError ?? null,
    gameId
  );
}

/** Solo URL de portada (p. ej. lote de descargas sin tocar el resto de metadatos). */
export async function updateGameCoverUrl(gameId: number, coverUrl: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE games SET coverUrl = ? WHERE id = ?', coverUrl ?? null, gameId);
}

export async function updateGameFull(
  gameId: number,
  input: {
    title: string; barcode?: string | null; platform: string;
    version?: string | null; releaseYear?: number | null;
    genre?: string | null; developer?: string | null; publisher?: string | null;
    description?: string | null; rating?: number | null; franchise?: string | null;
    coverUrl?: string | null;
    headerImageUrl?: string | null;
    metadataStatus: 'pending' | 'resolved' | 'partial' | 'error';
    metadataSource?: string | null; lastError?: string | null;
    valueCents?: number | null;
    valueCurrency?: string | null;
    valueSource?: ValueSource | null;
    valueUpdatedAt?: string | null;
  }
) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE games
     SET title=?, barcode=?, platform=?, version=?, releaseYear=?, genre=?, developer=?, publisher=?,
         description=?, rating=?, franchise=?, coverUrl=?, headerImageUrl=?,
         metadataStatus=?, metadataSource=?, lastError=?,
         valueCents=?, valueCurrency=?, valueSource=?, valueUpdatedAt=?
     WHERE id=?`,
    input.title, input.barcode ?? null, input.platform,
    input.version ?? null, input.releaseYear ?? null,
    input.genre ?? null, input.developer ?? null, input.publisher ?? null,
    input.description ?? null, input.rating ?? null, input.franchise ?? null,
    input.coverUrl ?? null,
    input.headerImageUrl ?? null,
    input.metadataStatus, input.metadataSource ?? null, input.lastError ?? null,
    input.valueCents ?? null,
    input.valueCurrency ?? null,
    input.valueSource ?? null,
    input.valueUpdatedAt ?? null,
    gameId
  );
}

export async function removeDuplicatedBarcodes() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM games WHERE barcode IS NOT NULL
      AND id NOT IN (SELECT MIN(id) FROM games WHERE barcode IS NOT NULL GROUP BY barcode);
  `);
}

export type CatalogImportResult = {
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  newThumbnails: Array<{ id: number; coverUrl: string | null }>;
};

/**
 * Inserta filas en una transacción. Comprueba duplicados por barcode o por título+plataforma (normalizado).
 */
export async function importCatalogRows(
  rows: NewGameInput[],
  options: {
    skipDuplicates: boolean;
    /** Llamado con el número de filas ya procesadas (válidas o no) y el total, para UI de progreso. */
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<CatalogImportResult> {
  const db = await getDb();
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  const newThumbnails: Array<{ id: number; coverUrl: string | null }> = [];
  const total = rows.length;
  let processed = 0;
  const report = () => options.onProgress?.(processed, total);

  await db.withTransactionAsync(async () => {
    for (const input of rows) {
      processed++;
      if (processed === 1 || processed % 40 === 0 || processed === total) {
        report();
      }

      const title = input.title?.trim() ?? '';
      const platform = input.platform?.trim() ?? '';
      if (!title || !platform) {
        skippedInvalid++;
        continue;
      }

      if (options.skipDuplicates) {
        const bc = input.barcode?.trim();
        if (bc) {
          const dupB = await db.getFirstAsync<{ id: number }>(
            'SELECT id FROM games WHERE barcode = ? LIMIT 1',
            bc
          );
          if (dupB) {
            skippedDuplicates++;
            continue;
          }
        }
        const dupT = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM games
           WHERE lower(trim(title)) = lower(trim(?)) AND lower(trim(platform)) = lower(trim(?))
           LIMIT 1`,
          title,
          platform
        );
        if (dupT) {
          skippedDuplicates++;
          continue;
        }
      }

      const result = await db.runAsync(
        `INSERT INTO games (
          title, barcode, platform, version, releaseYear, genre, developer, publisher,
          description, rating, franchise, coverUrl, headerImageUrl, metadataStatus, metadataSource, lastError, favorite, discOnly
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        title,
        input.barcode ?? null,
        platform,
        input.version ?? null,
        input.releaseYear ?? null,
        input.genre ?? null,
        input.developer ?? null,
        input.publisher ?? null,
        input.description ?? null,
        input.rating ?? null,
        input.franchise ?? null,
        input.coverUrl ?? null,
        input.headerImageUrl ?? null,
        input.metadataStatus ?? 'pending',
        input.metadataSource ?? null,
        input.lastError ?? null,
        input.favorite ?? 0,
        input.discOnly ?? 0
      );
      newThumbnails.push({ id: result.lastInsertRowId, coverUrl: input.coverUrl ?? null });
    }
  });

  return {
    imported: newThumbnails.length,
    skippedDuplicates,
    skippedInvalid,
    newThumbnails,
  };
}

export async function exportCatalogAsJson() {
  const games = await getGames();
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    app: 'CoverLens',
    formatVersion: 4,
    items: games,
  };
  const fileUri = `${FileSystem.cacheDirectory}coverlens-catalog.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportPayload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { shared: false, fileUri };
  await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Exportar catalogo', UTI: 'public.json' });
  return { shared: true, fileUri };
}
