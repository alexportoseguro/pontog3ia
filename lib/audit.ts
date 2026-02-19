
import { supabaseAdmin } from './auth-server'

export interface AuditLogParams {
    userId: string
    action: string
    details?: any
    tableName?: string
    recordId?: string
    oldData?: any
    newData?: any
    ipAddress?: string
}

/**
 * Logs an audit event to the database.
 * Uses the service role client (supabaseAdmin) to bypass RLS if necessary,
 * ensuring logs are always written.
 */
export async function logAudit(params: AuditLogParams) {
    try {
        const { userId, action, details, tableName, recordId, oldData, newData, ipAddress } = params

        const payload: any = {
            user_id: userId,
            action,
            details: details || {},
            ip_address: ipAddress || null,
            // New columns (optional until migration is run)
            table_name: tableName || null,
            record_id: recordId || null,
            old_data: oldData || null,
            new_data: newData || null
        }

        // Clean undefined values
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key])

        const { error } = await supabaseAdmin
            .from('audit_logs')
            .insert(payload)

        if (error) {
            console.error('⚠️ Failed to write audit log:', error)
            // Do not throw, finding should not block the main action
        }
    } catch (err) {
        console.error('❌ Error in logAudit:', err)
    }
}
