// ── Safaricom M-Pesa Daraja API helpers ───────────────────────────────────────

export type DarajaEnv = 'sandbox' | 'production'

const BASE = {
  sandbox:    'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
}

// ── 1. Get OAuth access token ─────────────────────────────────────────────────

export async function getDarajaToken(
  consumerKey:    string,
  consumerSecret: string,
  environment:    DarajaEnv = 'production'
): Promise<string> {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`)
  const res = await fetch(`${BASE[environment]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// ── 2. STK Push (Lipa Na M-Pesa Online) ──────────────────────────────────────

export interface StkPushPayload {
  businessShortCode: string
  passkey:           string
  amount:            number
  phoneNumber:       string   // 2547XXXXXXXX format
  callbackUrl:       string
  accountReference:  string   // e.g. order ID or user ID
  transactionDesc:   string
  environment?:      DarajaEnv
}

export interface StkPushResponse {
  MerchantRequestID:  string
  CheckoutRequestID:  string
  ResponseCode:       string
  ResponseDescription: string
  CustomerMessage:    string
}

export async function stkPush(
  token:   string,
  payload: StkPushPayload
): Promise<StkPushResponse> {
  const env       = payload.environment ?? 'production'
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)

  const password = btoa(`${payload.businessShortCode}${payload.passkey}${timestamp}`)

  const body = {
    BusinessShortCode: payload.businessShortCode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            payload.amount,
    PartyA:            payload.phoneNumber,
    PartyB:            payload.businessShortCode,
    PhoneNumber:       payload.phoneNumber,
    CallBackURL:       payload.callbackUrl,
    AccountReference:  payload.accountReference,
    TransactionDesc:   payload.transactionDesc,
  }

  const res = await fetch(`${BASE[env]}/mpesa/stkpush/v1/processrequest`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`STK Push failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<StkPushResponse>
}

// ── 3. Query STK push status ──────────────────────────────────────────────────

export async function stkQuery(
  token:              string,
  businessShortCode:  string,
  passkey:            string,
  checkoutRequestId:  string,
  environment:        DarajaEnv = 'production'
): Promise<Record<string, unknown>> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)

  const password = btoa(`${businessShortCode}${passkey}${timestamp}`)

  const res = await fetch(`${BASE[environment]}/mpesa/stkpushquery/v1/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password:          password,
      Timestamp:         timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  })

  return res.json() as Promise<Record<string, unknown>>
}

// ── 4. Parse STK callback ─────────────────────────────────────────────────────

export interface StkCallbackResult {
  merchantRequestId:  string
  checkoutRequestId:  string
  resultCode:         number
  resultDesc:         string
  amount?:            number
  mpesaReceiptNumber?: string
  transactionDate?:   string
  phoneNumber?:       string
}

export function parseStkCallback(raw: Record<string, unknown>): StkCallbackResult {
  const body      = (raw.Body as Record<string, unknown>)
  const stk       = body.stkCallback as Record<string, unknown>
  const resultCode = Number(stk.ResultCode)
  const items     = (stk.CallbackMetadata as { Item?: { Name: string; Value: unknown }[] })?.Item ?? []

  const get = (name: string) => items.find(i => i.Name === name)?.Value

  return {
    merchantRequestId:   String(stk.MerchantRequestID),
    checkoutRequestId:   String(stk.CheckoutRequestID),
    resultCode,
    resultDesc:          String(stk.ResultDesc),
    amount:              resultCode === 0 ? Number(get('Amount'))            : undefined,
    mpesaReceiptNumber:  resultCode === 0 ? String(get('MpesaReceiptNumber')): undefined,
    transactionDate:     resultCode === 0 ? String(get('TransactionDate'))   : undefined,
    phoneNumber:         resultCode === 0 ? String(get('PhoneNumber'))       : undefined,
  }
}
