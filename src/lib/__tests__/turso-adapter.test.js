/** @jest-environment node */
/* eslint-env jest */

import { createClient } from '@libsql/client/http';

import { TursoAdapter } from '../turso-adapter';

// Jest 27 does not resolve this package's exports subpath. Mock it without
// loading the real HTTP client; these tests must never access a real database.
jest.mock('@libsql/client/http', () => ({ createClient: jest.fn() }), {
  virtual: true,
});

describe('Turso error propagation', () => {
  let client;
  let adapter;
  let errorLog;

  beforeEach(() => {
    client = { execute: jest.fn(), batch: jest.fn() };
    createClient.mockReturnValue(client);
    // The client is mocked: these values never connect to a database.
    adapter = new TursoAdapter('libsql://test.invalid', 'test-only');
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorLog.mockRestore();
    jest.clearAllMocks();
  });

  it('returns null only for a successful empty query', async () => {
    client.execute.mockResolvedValue({ rows: [] });
    await expect(
      adapter.prepare('SELECT value FROM test').first()
    ).resolves.toBeNull();
  });

  it('preserves falsy values when reading a column', async () => {
    client.execute.mockResolvedValue({ rows: [{ count: 0 }] });
    await expect(
      adapter.prepare('SELECT 0 AS count').first('count')
    ).resolves.toBe(0);
  });

  it.each(['first', 'run', 'all'])(
    '%s rejects database failures instead of reporting empty/successful data',
    async (method) => {
      const failure = new Error('SQLITE_UNKNOWN: no such table: admin_config');
      client.execute.mockRejectedValue(failure);
      await expect(
        adapter.prepare('SELECT * FROM admin_config')[method]()
      ).rejects.toBe(failure);
      expect(errorLog).toHaveBeenCalledTimes(1);
    }
  );

  it('preserves successful writes and their bound parameters', async () => {
    client.execute.mockResolvedValue({
      rows: [],
      rowsAffected: 1,
      lastInsertRowid: 2n,
    });
    await expect(
      adapter.prepare('INSERT INTO test VALUES (?)').bind('value').run()
    ).resolves.toMatchObject({
      success: true,
      meta: { changes: 1, last_row_id: 2 },
    });
    expect(client.execute).toHaveBeenCalledWith({
      sql: 'INSERT INTO test VALUES (?)',
      args: ['value'],
    });
  });
});
