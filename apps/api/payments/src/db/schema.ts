import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const transactions = sqliteTable('transactions', {
  id:                 text('id').primaryKey(),
  userId:             text('user_id').notNull(),
  agentSlug:          text('agent_slug').notNull(),
  provider:           text('provider').notNull().default('mpesa'),
  amount:             real('amount').notNull(),
  currency:           text('currency').notNull().default('KES'),
  status:             text('status').notNull().default('pending'),
  merchantRequestId:  text('merchant_request_id'),
  checkoutRequestId:  text('checkout_request_id'),
  mpesaReceiptNumber: text('mpesa_receipt_number'),
  phoneNumber:        text('phone_number'),
  description:        text('description'),
  metadata:           text('metadata'),
  createdAt:          text('created_at').notNull(),
  updatedAt:          text('updated_at').notNull(),
})
