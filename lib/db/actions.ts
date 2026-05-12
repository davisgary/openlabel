'use server';

import { createClient } from './client';

export async function deleteUser(userId: number) {
  const client = createClient();
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM accounts WHERE "userId" = $1`, [userId]);
    await client.query(`DELETE FROM sessions WHERE "userId" = $1`, [userId]);
    const result = await client.query(`DELETE FROM users WHERE id = $1 RETURNING *`, [userId]);
    await client.query('COMMIT');

    if (result.rowCount === 0) {
      throw new Error(`No user found with id ${userId}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}