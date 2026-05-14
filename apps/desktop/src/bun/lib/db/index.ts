import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sqlite } from '../sqlite'
import { relations } from './relations'

export const db = drizzle({ client: sqlite, relations })
