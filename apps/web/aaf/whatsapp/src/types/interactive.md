# WhatsApp Interactive Message Types — Live Sends

All sent to `+254746492818` via `1038436689362682` (Taji) on 2026-06-30.
Every message confirmed delivered by Meta Graph API.

---

## 1. Text

```
POST /v20.0/{{phone-number-id}}/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type":    "individual",
  "to":                "254746492818",
  "type":              "text",
  "text": {
    "body": "📄 *Interactive Message Demo*\n\nSending all message types for visual check."
  }
}
```

**Sent:** `wamid.HBgMMjU0NzQ2NDkyODE4FQIAERgSNzgzQ0UzNzg2MkFGRjExOEI1AA==`

---

## 2. Buttons (reply)

```
POST /v20.0/{{phone-number-id}}/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type":    "individual",
  "to":                "254746492818",
  "type":              "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Would you like to proceed?" },
    "footer": { "text": "Taji Bot — choose an option" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "yes",    "title": "✅ Yes" } },
        { "type": "reply", "reply": { "id": "no",     "title": "❌ No" } },
        { "type": "reply", "reply": { "id": "cancel", "title": "⏹ Cancel" } }
      ]
    }
  }
}
```

**Constraints:** max 3 buttons, title max 20 chars, id max 256 chars.
**Webhook reply:** `{ interactive: { type: "button_reply", button_reply: { id, title } } }`

**Sent:** `wamid.HBgMMjU0NzQ2NDkyODE4FQIAERgSMTFFMjkyOUNGOERENUU2RUM0AA==`

---

## 3. List

```
POST /v20.0/{{phone-number-id}}/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type":    "individual",
  "to":                "254746492818",
  "type":              "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "📋 Select a Document" },
    "body":   { "text": "Choose the type of document you want to create." },
    "footer": { "text": "Taji Bot — document selection" },
    "action": {
      "button": "View Options",
      "sections": [
        {
          "title": "Documents",
          "rows": [
            { "id": "cv",     "title": "📄 Professional CV",     "description": "A clean CV for job applications" },
            { "id": "cover",  "title": "✉️ Cover Letter",        "description": "Tailored cover letter" },
            { "id": "resign", "title": "📝 Resignation Letter",  "description": "Formal resignation notice" }
          ]
        }
      ]
    }
  }
}
```

**Constraints:** button label max 20 chars, title max 24 chars, description max 72 chars, section title max 24 chars.
**Webhook reply:** `{ interactive: { type: "list_reply", list_reply: { id, title, description? } } }`

**Sent:** `wamid.HBgMMjU0NzQ2NDkyODE4FQIAERgSMzIxNThBMkY2MzA0OTREMzA1AA==`

---

## 4. Document (via media upload)

### Step 1 — Upload file to Meta

```
POST /v20.0/{{phone-number-id}}/media
```

```
FormData:
  messaging_product: whatsapp
  file:              @demo-document.docx  (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
  type:              application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

**Response:** `{ "id": "1994623421185904" }`

### Step 2 — Send as document message

```
POST /v20.0/{{phone-number-id}}/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type":    "individual",
  "to":                "254746492818",
  "type":              "document",
  "document": {
    "id":       "1994623421185904",
    "caption": "📎 Demo document",
    "filename": "demo-document.docx"
  }
}
```

**Constraints:** media_id expires in 30 days. Upload must be done per-recipient.
**Webhook:** document receive includes `{ id, mime_type, sha256, caption?, filename? }`

**Sent:** `wamid.HBgMMjU0NzQ2NDkyODE4FQIAERgSMzMxQkY1OEQ4OTIxQjJDOENFAA==`

---

## 5. Location

```
POST /v20.0/{{phone-number-id}}/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type":    "individual",
  "to":                "254746492818",
  "type":              "location",
  "location": {
    "longitude": 36.8219,
    "latitude":  -1.2921,
    "name":      "Nairobi, Kenya",
    "address":   "Nairobi Central Business District"
  }
}
```

**Sent:** `wamid.HBgMMjU0NzQ2NDkyODE4FQIAERgSRUQzQjQ3NjlDOEFCMUU3MTk4AA==`

---

## Builder helpers (TypeScript)

Defined in `interactive.ts`:

| Builder | Returns | Use case |
|---------|---------|----------|
| `buildTextMessage(to, body, previewUrl?)` | `TextMessage` | Plain text |
| `buildButtonMessage(to, body, buttons[], opts?)` | `InteractiveMessage` | Yes/No/Cancel prompts |
| `buildListMessage(to, body, buttonLabel, sections[], opts?)` | `InteractiveMessage` | SKU selection, menu |
| `buildDocumentMessage(to, mediaId, opts?)` | `MediaMessage` | Document delivery |

## Incoming webhook parsing

Interactive replies arrive as `type: "interactive"` with:
- `button_reply`: `{ id: string, title: string }`
- `list_reply`: `{ id: string, title: string, description?: string }`

Current `parseIncomingMessage()` in `lib/whatsapp.ts` only processes `type === 'text'`.
Interactive replies fall through to `return null` and are silently dropped.
