import { useEffect, useState } from 'react'
import { customersApi, conversationsApi, messagesApi, agentsApi } from '@/api/client'
import type { Customer, Conversation, Message, Agent } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, MessageSquare, RefreshCw, Loader2 } from 'lucide-react'

export default function ConversationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingConv, setLoadingConv] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('users')

  function load() {
    setLoading(true)
    Promise.all([
      customersApi.list().catch(() => []),
      agentsApi.list().catch(() => []),
    ]).then(([c, a]) => {
      setCustomers(c); setAgents(a)
    }).catch(e => setError(e.message))
     .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    setSelectedConvId(null)
    setMessages([])
    setLoadingConv(true)
    conversationsApi.list(userId)
      .then(setConversations)
      .catch(e => setError(e.message))
      .finally(() => setLoadingConv(false))
  }

  function selectConversation(convId: string) {
    setSelectedConvId(convId)
    setMessages([])
    setLoadingConv(true)
    messagesApi.list(convId)
      .then(setMessages)
      .catch(e => setError(e.message))
      .finally(() => setLoadingConv(false))
  }

  function agentName(slug: string) {
    return agents.find(a => a.slug === slug)?.name ?? slug
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
  if (error) return <div className="text-red-600 py-12">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users & Conversations</h1>
          <p className="text-sm text-muted-foreground">Everyone who has messaged your agents</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="conversations" disabled={!selectedUserId}><MessageSquare className="h-4 w-4 mr-1" /> Conversations</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          {customers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No users yet.</CardContent></Card>
          ) : (
            <div className="divide-y rounded-lg border">
              {customers.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    selectedUserId === c.id ? 'bg-accent' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => selectUser(c.id)}
                >
                  <div>
                    <span className="font-medium">{c.name || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.id}</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">{c.channel}</Badge>
                  </div>
                  <Badge className={c.registered ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                    {c.registered ? 'Registered' : 'Unregistered'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          {loadingConv ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-5 w-4 animate-spin" /> Loading...</div>
          ) : conversations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No conversations for this user.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="divide-y rounded-lg border">
                {conversations.map(c => (
                  <div
                    key={c.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedConvId === c.id ? 'bg-accent' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => selectConversation(c.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{agentName(c.agentSlug)}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.lastMessage?.slice(0, 80) ?? '\u2014'}</p>
                    <p className="text-xs text-muted-foreground">{c.messageCount ?? 0} messages &middot; {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border p-4 max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Select a conversation to view messages.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map(m => (
                      <div key={m.id} className={`p-3 rounded-lg text-sm ${
                        m.role === 'assistant' ? 'bg-accent ml-4' : 'bg-muted/50 mr-4'
                      }`}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{m.role}</p>
                        <p className="whitespace-pre-wrap">{m.content.slice(0, 300)}</p>
                        {m.tokensUsed && <p className="text-[10px] text-muted-foreground mt-1">{m.tokensUsed} tokens</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
