import type { DatabaseAdapter } from './d1-adapter';

const CHAPTER_COLUMNS = [
  ['latest_chapter_id', 'TEXT'],
  ['latest_chapter_name', 'TEXT'],
  ['latest_chapter_count', 'INTEGER'],
  ['unread_chapter_count', 'INTEGER'],
] as const;

// Share checks for a connection, not a user/request. Failed checks remain retryable.
const schemaChecks = new WeakMap<DatabaseAdapter, Promise<void>>();

async function readColumns(db: DatabaseAdapter): Promise<Set<string>> {
  const result = await db
    .prepare('PRAGMA table_info(manga_shelf)')
    .all<{ name: string }>();

  if (!result.success) {
    throw new Error(result.error || '读取漫画书架表结构失败');
  }
  if (!result.results?.length) {
    throw new Error(
      '数据库缺少 manga_shelf 表，请先运行当前存储对应的数据库初始化/迁移脚本。'
    );
  }

  return new Set(result.results.map((column) => column.name));
}

async function updateMissingColumns(db: DatabaseAdapter): Promise<void> {
  const columns = await readColumns(db);

  for (const [name, type] of CHAPTER_COLUMNS) {
    if (columns.has(name)) continue;

    try {
      // Identifiers come only from the fixed list above, never from user input.
      const result = await db
        .prepare(`ALTER TABLE manga_shelf ADD COLUMN ${name} ${type}`)
        .run();
      if (!result.success) {
        throw new Error(result.error || `添加漫画书架字段 ${name} 失败`);
      }
    } catch (error) {
      // Another connection may have added this column after our PRAGMA check.
      // Suppress only a verified duplicate; real database failures must propagate.
      const message = error instanceof Error ? error.message : String(error);
      if (
        !/duplicate column/i.test(message) ||
        !(await readColumns(db)).has(name)
      ) {
        throw error;
      }
    }
  }
}

/**
 * Upgrade legacy manga shelves only when the manga feature is used.
 * Fresh databases already contain these columns in migration 006.
 * Never run DDL from the storage constructor or unrelated page requests.
 */
export function ensureMangaShelfSchema(db: DatabaseAdapter): Promise<void> {
  const existing = schemaChecks.get(db);
  if (existing) return existing;

  const check = updateMissingColumns(db).catch((error: unknown) => {
    schemaChecks.delete(db);
    throw error;
  });
  schemaChecks.set(db, check);
  return check;
}
