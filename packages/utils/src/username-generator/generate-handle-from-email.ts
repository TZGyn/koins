import { randomNumber } from './random-number'

export interface EmailOptions {
	randomDigits?: number
	stripLeadingDigits?: boolean // default: true
	leadingFallback?: string // default: "user"
}

export function generateHandleFromEmail(
	email: string,
	second?: number | EmailOptions,
): string {
	// Retrieve name from email address
	const nameParts = email.replace(/@.+/, '')
	// Replace all special characters like "@ . _ ";
	let name = nameParts.replace(/[&/\\#,+()$~%._@'":*?<>{}]/g, '')

	const opts: EmailOptions =
		typeof second === 'object' && second !== null
			? second
			: {
					randomDigits:
						typeof second === 'number' ? second : undefined,
				}

	const stripLeading = opts.stripLeadingDigits !== false // default true
	const fallback = opts.leadingFallback ?? 'user'

	if (stripLeading) {
		name = name.replace(/^[0-9]+/, '')
		if (name.length === 0) {
			name = fallback
		}
	}
	// Create and return unique username
	const digits =
		typeof opts.randomDigits === 'number'
			? opts.randomDigits
			: undefined
	return name + randomNumber(digits)
}
