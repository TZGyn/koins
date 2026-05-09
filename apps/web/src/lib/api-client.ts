import { PUBLIC_API_URL } from '$env/static/public'
import { makeClient } from 'backend'

export const client = makeClient(PUBLIC_API_URL)
