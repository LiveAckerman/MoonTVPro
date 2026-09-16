/** @jest-environment node */
/* eslint-env jest */

import { D1Storage } from '../d1.db';
import { ensureMangaShelfSchema } from '../manga-shelf-schema';

jest.mock('../notification-dispatch', () => ({
  dispatchNotificationChannels: jest.fn(),
}));
jest.mock('../user-cache', () => ({ userInfoCache: {} }));

const chapterColumns = [
  'latest_chapter_id',
  'latest_chapter_name',
  'latest_chapter_count',
  'unread_chapter_count',
];

function makeDatabase(initialColumns = ['username', ...chapterColumns]) {
  const columns = new Set(initialColumns);
  const all = jest.fn(async () => ({
    success: true,
    results: [...columns].map((name) => ({ name })),
  }));
  const run = jest.fn(async (sql) => {
    const name = sql.match(/ADD COLUMN (\w+)/)?.[1];
    if (name) columns.add(name);
    return { success: true };
  });
  const first = jest.fn(async () => null);
  const db = {
    prepare: jest.fn((sql) => {
      const statement = {
        all,
        first,
        run: () => run(sql),
        bind: () => statement,
      };
      return statement;
    }),
  };
  return { db, columns, all, run, first };
}

describe('manga shelf schema checks', () => {
  it('does no database IO when constructing storage or reading admin configuration', async () => {
    const { db } = makeDatabase();
    const storage = new D1Storage(db);
    expect(db.prepare).not.toHaveBeenCalled();
    await storage.getAdminConfig();
    expect(db.prepare).not.toHaveBeenCalledWith(
      'PRAGMA table_info(manga_shelf)'
    );
    expect(db.prepare.mock.calls.some(([sql]) => sql.startsWith('ALTER'))).toBe(
      false
    );
  });

  it('does not ALTER a freshly migrated table and caches successful checks', async () => {
    const { db, all, run } = makeDatabase();
    await ensureMangaShelfSchema(db);
    await ensureMangaShelfSchema(db);
    expect(all).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  it('adds only missing legacy columns', async () => {
    const { db, columns, run } = makeDatabase(['username', chapterColumns[0]]);
    await ensureMangaShelfSchema(db);
    expect(run).toHaveBeenCalledTimes(3);
    expect([...columns]).toEqual(['username', ...chapterColumns]);
    expect(
      run.mock.calls.some(([sql]) => sql.includes('latest_chapter_id'))
    ).toBe(false);
  });

  it('shares concurrent checks on one connection', async () => {
    const { db, all, run } = makeDatabase(['username']);
    await Promise.all(
      Array.from({ length: 10 }, () => ensureMangaShelfSchema(db))
    );
    expect(all).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('reports a missing base table without attempting DDL and permits retry', async () => {
    const { db, columns, run } = makeDatabase([]);
    await expect(ensureMangaShelfSchema(db)).rejects.toThrow(
      '数据库缺少 manga_shelf 表'
    );
    expect(run).not.toHaveBeenCalled();
    columns.add('username');
    chapterColumns.forEach((name) => columns.add(name));
    await expect(ensureMangaShelfSchema(db)).resolves.toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });

  it('does not treat a failed PRAGMA as an empty or successfully checked table', async () => {
    const { db, all, run } = makeDatabase();
    all.mockResolvedValueOnce({
      success: false,
      error: 'database unavailable',
    });
    await expect(ensureMangaShelfSchema(db)).rejects.toThrow(
      'database unavailable'
    );
    expect(run).not.toHaveBeenCalled();
    await expect(ensureMangaShelfSchema(db)).resolves.toBeUndefined();
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('propagates network failures and retries after recovery', async () => {
    const { db, all } = makeDatabase();
    all.mockRejectedValueOnce(new Error('connection reset'));
    await expect(ensureMangaShelfSchema(db)).rejects.toThrow(
      'connection reset'
    );
    await expect(ensureMangaShelfSchema(db)).resolves.toBeUndefined();
  });

  it('does not cache an unsuccessful ALTER as ready', async () => {
    const { db, run } = makeDatabase(['username']);
    run.mockResolvedValueOnce({
      success: false,
      error: 'database is read-only',
    });
    await expect(ensureMangaShelfSchema(db)).rejects.toThrow(
      'database is read-only'
    );
    await expect(ensureMangaShelfSchema(db)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(5);
  });

  it('accepts a concurrent duplicate only after verifying that the column exists', async () => {
    const { db, columns, all, run } = makeDatabase([
      'username',
      ...chapterColumns.slice(1),
    ]);
    run.mockImplementationOnce(async () => {
      columns.add(chapterColumns[0]);
      throw new Error('duplicate column name: latest_chapter_id');
    });
    await expect(ensureMangaShelfSchema(db)).resolves.toBeUndefined();
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('does not suppress an unverified duplicate error', async () => {
    const { db, run } = makeDatabase(['username']);
    run.mockRejectedValueOnce(
      new Error('duplicate column name: unrelated_column')
    );
    await expect(ensureMangaShelfSchema(db)).rejects.toThrow(
      'duplicate column name'
    );
  });

  it('keeps schema readiness isolated between database connections', async () => {
    const first = makeDatabase();
    const second = makeDatabase(['username']);
    await ensureMangaShelfSchema(first.db);
    await ensureMangaShelfSchema(second.db);
    expect(first.run).not.toHaveBeenCalled();
    expect(second.run).toHaveBeenCalledTimes(4);
  });
});
