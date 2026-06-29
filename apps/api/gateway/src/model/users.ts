export interface GatewayUser {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  createdAt: string
}

export interface AuthPayload {
  sub: string
  email: string
  role: string
}
