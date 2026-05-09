import { drizzle } from 'drizzle-orm/node-postgres'
import { relations } from './relations'
import * as pg from 'pg'

const { Pool } = pg

const pool = new Pool({
	// connectionString: Bun.env.DATABASE_URL,
})

export const db = drizzle({ client: pool, relations: relations })
