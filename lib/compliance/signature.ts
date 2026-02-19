
import { createHash } from 'crypto'

/**
 * Generates a SHA-256 hash for Portaria 671 records.
 * The standard usually requires concatenating specific fields before hashing.
 * 
 * @param input The string content to sign
 * @returns The hex string of the SHA-256 signature
 */
export function generateSignature(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Validates a signature
 */
export function validateSignature(input: string, signature: string): boolean {
    const calculated = generateSignature(input)
    return calculated === signature
}
