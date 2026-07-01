/**
 * Dev seed — populates local D1 with enough data to run the full
 * WhatsApp flow end-to-end without needing a real upload.
 *
 * Run with:
 *   cd apps/api/gateway
 *   npx wrangler d1 execute platform-db --local --file=drizzle/seed/dev.sql
 *
 * Or generate the SQL first:
 *   npx tsx drizzle/seed/dev.ts > drizzle/seed/dev.sql
 */

// ─── Types (inline so no import needed) ──────────────────────────────────────

interface FieldSchema {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  options?: string[]
  hint?: string
}

interface ConversationStep {
  id: string
  prompt: string
  fieldKey: string
  validation?: 'required' | 'phone' | 'email'
  skipIf?: string   // fieldKey that, if already set, skips this step
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = new Date().toISOString()

function esc(val: string): string {
  return val.replace(/'/g, "''")
}

function sql(strings: TemplateStringsArray, ...vals: unknown[]): string {
  return strings.reduce((acc, s, i) => {
    const v = vals[i - 1]
    if (v === undefined || v === null) return acc + 'NULL' + s
    if (typeof v === 'number') return acc + v + s
    if (typeof v === 'boolean') return acc + (v ? 1 : 0) + s
    return acc + `'${esc(String(v))}'` + s
  })
}

// ─── Seed data ────────────────────────────────────────────────────────────────

// 1. Agents

const agentsData = [
  {
    id: 'agent-taji-001',
    name: 'Taji',
    slug: 'taji',
    description: 'Career document agent — CVs, cover letters, resignation letters',
    systemPrompt: `You are Taji, a professional career document assistant.
You help users create CVs, application letters, and resignation letters.
Be warm, professional, and encouraging.
Always collect all required fields before generating a document.`,
    toolsEnabled: JSON.stringify(['listSKUs', 'collectField', 'initiatePayment', 'generateDocument']),
    modelProvider: 'openrouter',
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    channel: 'whatsapp',
    channelConfig: JSON.stringify({ whatsappPhoneNumberId: '1038436689362682' }),
    isActive: 1,
  },
  {
    id: 'agent-elim-001',
    name: 'Elim',
    slug: 'elim',
    description: 'CBC education agent — exam prep, tutoring for Kenyan students',
    systemPrompt: `You are Elim, a friendly CBC education assistant for Kenyan students.
You help with exam preparation, concept explanations, and practice questions.
Always encourage students and explain things clearly in simple language.`,
    toolsEnabled: JSON.stringify(['askQuestion', 'explainConcept', 'givePractice']),
    modelProvider: 'openrouter',
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    channel: 'whatsapp',
    channelConfig: JSON.stringify({ whatsappPhoneNumberId: '729899760214979' }),
    isActive: 1,
  },
  {
    id: 'agent-test-001',
    name: 'Test',
    slug: 'test',
    description: 'General-purpose test agent for WhatsApp flow testing',
    systemPrompt: `You are a test agent for WhatsApp flow testing.
Respond concisely and confirm that messages are being routed correctly.
Identify yourself as the test agent when asked.`,
    toolsEnabled: JSON.stringify(['listSKUs', 'collectField']),
    modelProvider: 'openrouter',
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    channel: 'whatsapp',
    channelConfig: JSON.stringify({ whatsappPhoneNumberId: '122108114672001278' }),
    isActive: 1,
  },
]

// 2. SKUs

const cvFields: FieldSchema[] = [
  { key: 'full_name',       label: 'Full Name',             type: 'text',   required: true,  hint: 'Your full legal name as it appears on your ID' },
  { key: 'phone',           label: 'Phone Number',          type: 'text',   required: true,  hint: 'e.g. 0712345678' },
  { key: 'email',           label: 'Email Address',         type: 'text',   required: true,  hint: 'e.g. jane@gmail.com' },
  { key: 'location',        label: 'Location / City',       type: 'text',   required: true,  hint: 'e.g. Nairobi, Karen' },
  { key: 'job_title',       label: 'Target Job Title',      type: 'text',   required: true,  hint: 'The position you are applying for' },
  { key: 'summary',         label: 'Professional Summary',  type: 'text',   required: true,  hint: '2-3 sentences about your background and goals' },
  { key: 'experience',      label: 'Work Experience',       type: 'text',   required: true,  hint: 'List jobs: title at company (years). e.g. Cashier at Naivas (2020-2022)' },
  { key: 'education',       label: 'Education',             type: 'text',   required: true,  hint: 'e.g. KCSE 2019, Starehe Boys Centre' },
  { key: 'skills',          label: 'Key Skills',            type: 'text',   required: true,  hint: 'e.g. Customer service, MS Office, teamwork' },
  { key: 'languages',       label: 'Languages',             type: 'text',   required: false, hint: 'e.g. English, Swahili, Kikuyu' },
]

const cvSteps: ConversationStep[] = cvFields.map((f, i) => ({
  id: `step-${i + 1}`,
  prompt: `${i + 1}/${cvFields.length} — *${f.label}*\n${f.hint ?? ''}`,
  fieldKey: f.key,
  validation: f.key === 'email' ? 'email' : f.key === 'phone' ? 'phone' : 'required',
}))

const coverLetterFields: FieldSchema[] = [
  { key: 'full_name',       label: 'Full Name',             type: 'text',   required: true },
  { key: 'phone',           label: 'Phone Number',          type: 'text',   required: true },
  { key: 'email',           label: 'Email Address',         type: 'text',   required: true },
  { key: 'job_title',       label: 'Job You Are Applying For', type: 'text', required: true },
  { key: 'company_name',    label: 'Company Name',          type: 'text',   required: true },
  { key: 'hiring_manager',  label: 'Hiring Manager Name',   type: 'text',   required: false, hint: 'Leave blank if unknown' },
  { key: 'why_interested',  label: 'Why do you want this job?', type: 'text', required: true, hint: '1-2 sentences' },
  { key: 'key_achievement', label: 'Your Biggest Achievement', type: 'text', required: true, hint: 'A result you are proud of' },
  { key: 'availability',    label: 'When can you start?',   type: 'text',   required: true,  hint: 'e.g. Immediately, 2 weeks notice' },
]

const coverLetterSteps: ConversationStep[] = coverLetterFields.map((f, i) => ({
  id: `step-${i + 1}`,
  prompt: `${i + 1}/${coverLetterFields.length} — *${f.label}*${f.hint ? '\n' + f.hint : ''}`,
  fieldKey: f.key,
  validation: f.key === 'email' ? 'email' : 'required',
}))

const resignationFields: FieldSchema[] = [
  { key: 'full_name',         label: 'Your Full Name',          type: 'text', required: true },
  { key: 'current_job_title', label: 'Your Current Job Title',  type: 'text', required: true },
  { key: 'company_name',      label: 'Company Name',            type: 'text', required: true },
  { key: 'manager_name',      label: 'Manager\'s Name',         type: 'text', required: true },
  { key: 'last_working_day',  label: 'Last Working Day',        type: 'date', required: true, hint: 'e.g. 15 July 2025' },
  { key: 'reason',            label: 'Reason for Leaving',      type: 'text', required: false, hint: 'Optional — brief and professional' },
  { key: 'notice_period',     label: 'Notice Period',           type: 'text', required: true, hint: 'e.g. 1 month, 2 weeks' },
]

const resignationSteps: ConversationStep[] = resignationFields.map((f, i) => ({
  id: `step-${i + 1}`,
  prompt: `${i + 1}/${resignationFields.length} — *${f.label}*${f.hint ? '\n' + f.hint : ''}`,
  fieldKey: f.key,
  validation: 'required',
}))

const basicCvFields: FieldSchema[] = [
  { key: 'full_name', label: 'Full Name',     type: 'text', required: true,  hint: 'Your full name' },
  { key: 'phone',     label: 'Phone Number',  type: 'text', required: true,  hint: 'e.g. 0712345678' },
  { key: 'job_title', label: 'Target Job',    type: 'text', required: false, hint: 'e.g. Software Developer' },
]

const basicCvSteps: ConversationStep[] = basicCvFields.map((f, i) => ({
  id: `step-${i + 1}`,
  prompt: `${i + 1}/${basicCvFields.length} — *${f.label}*${f.hint ? '\n' + f.hint : ''}`,
  fieldKey: f.key,
  validation: f.key === 'phone' ? 'phone' : f.required ? 'required' : undefined,
}))

const skus = [
  {
    id:                 'sku-cv-professional-001',
    name:               'Professional CV',
    slug:               'professional-cv',
    description:        'A clean, professional CV template suitable for all industries in Kenya.',
    templateType:       'docx',
    fileKey:            'templates/cv-professional-v1.docx',
    previewKey:         null,
    markdownPreview:    '## Professional CV\nName, contact, summary, experience, education, skills.',
    price:              1,
    currency:           'KES',
    fieldSchema:        JSON.stringify(cvFields),
    conversationSteps:  JSON.stringify(cvSteps),
    isActive:           1,
    requiresReview:     0,
    version:            1,
  },
  {
    id:                 'sku-cover-letter-001',
    name:               'Application / Cover Letter',
    slug:               'cover-letter',
    description:        'A persuasive cover letter tailored to the specific job and company.',
    templateType:       'docx',
    fileKey:            'templates/cover-letter-v1.docx',
    previewKey:         null,
    markdownPreview:    '## Cover Letter\nIntroduction, body, closing, signature.',
    price:              2,
    currency:           'KES',
    fieldSchema:        JSON.stringify(coverLetterFields),
    conversationSteps:  JSON.stringify(coverLetterSteps),
    isActive:           1,
    requiresReview:     0,
    version:            1,
  },
  {
    id:                 'sku-resignation-001',
    name:               'Resignation Letter',
    slug:               'resignation-letter',
    description:        'A professional resignation letter with proper notice period.',
    templateType:       'docx',
    fileKey:            'templates/resignation-letter-v1.docx',
    previewKey:         null,
    markdownPreview:    '## Resignation Letter\nFormal notice of resignation with last working day.',
    price:              3,
    currency:           'KES',
    fieldSchema:        JSON.stringify(resignationFields),
    conversationSteps:  JSON.stringify(resignationSteps),
    isActive:           1,
    requiresReview:     0,
    version:            1,
  },
  {
    id:                 'sku-basic-cv-free-001',
    name:               'Basic CV (Free)',
    slug:               'basic-cv-free',
    description:        'A simple CV with just your name, phone and target job — free, no payment needed.',
    templateType:       'docx',
    fileKey:            'templates/basic-cv-free-v1.docx',
    previewKey:         null,
    markdownPreview:    '## Basic CV\nName, phone, target job.',
    price:              0,
    currency:           'KES',
    fieldSchema:        JSON.stringify(basicCvFields),
    conversationSteps:  JSON.stringify(basicCvSteps),
    isActive:           1,
    requiresReview:     0,
    version:            1,
  },
]

// 3. SKU-agent access (junction table)

const skuAgentAccessData = [
  { id: 'access-saa-cv-taji-001',  skuId: 'sku-cv-professional-001', agentSlug: 'taji', enabled: 1 },
  { id: 'access-saa-cv-elim-001',  skuId: 'sku-cv-professional-001', agentSlug: 'elim', enabled: 0 },
  { id: 'access-saa-cover-taji-001',  skuId: 'sku-cover-letter-001', agentSlug: 'taji', enabled: 1 },
  { id: 'access-saa-cover-elim-001',  skuId: 'sku-cover-letter-001', agentSlug: 'elim', enabled: 0 },
  { id: 'access-saa-resign-taji-001', skuId: 'sku-resignation-001', agentSlug: 'taji', enabled: 1 },
  { id: 'access-saa-resign-elim-001', skuId: 'sku-resignation-001', agentSlug: 'elim', enabled: 0 },
  { id: 'access-saa-basic-taji-001',  skuId: 'sku-basic-cv-free-001', agentSlug: 'taji', enabled: 1 },
  { id: 'access-saa-basic-elim-001',  skuId: 'sku-basic-cv-free-001', agentSlug: 'elim', enabled: 1 },
]

// ─── Generate SQL ─────────────────────────────────────────────────────────────

const lines: string[] = [
  '-- Dev seed — generated by drizzle/seed/dev.ts',
  `-- Generated at: ${now}`,
  '',
  '-- ─── Agents ──────────────────────────────────────────────────────────────',
  '',
]

for (const a of agentsData) {
  lines.push(
    `INSERT OR REPLACE INTO agents (id, name, slug, description, system_prompt, tools_enabled, model_provider, model_id, channel, channel_config, is_active, created_at, updated_at) VALUES (`,
    `  '${esc(a.id)}', '${esc(a.name)}', '${esc(a.slug)}', '${esc(a.description ?? '')}',`,
    `  '${esc(a.systemPrompt)}',`,
    `  '${esc(a.toolsEnabled)}', '${esc(a.modelProvider)}', '${esc(a.modelId)}',`,
    `  '${esc(a.channel)}', '${esc(a.channelConfig)}', ${a.isActive}, '${now}', '${now}'`,
    `);`,
    '',
  )
}

lines.push(
  '',
  '-- ─── SKUs ────────────────────────────────────────────────────────────────',
  '',
)

for (const s of skus) {
  lines.push(
    `INSERT OR REPLACE INTO skus (id, name, slug, description, template_type, file_key, preview_key, markdown_preview, price, currency, field_schema, conversation_steps, is_active, requires_review, version, created_at, updated_at) VALUES (`,
    `  '${esc(s.id)}', '${esc(s.name)}', '${esc(s.slug)}', '${esc(s.description ?? '')}',`,
    `  '${esc(s.templateType)}', '${esc(s.fileKey)}',`,
    `  ${s.previewKey ? `'${esc(s.previewKey)}'` : 'NULL'}, '${esc(s.markdownPreview ?? '')}',`,
    `  ${s.price}, '${esc(s.currency)}',`,
    `  '${esc(s.fieldSchema)}',`,
    `  '${esc(s.conversationSteps)}',`,
    `  ${s.isActive}, ${s.requiresReview}, ${s.version}, '${now}', '${now}'`,
    `);`,
    '',
  )
}

lines.push(
  '',
  '-- ─── SKU-Agent Access ────────────────────────────────────────────────────────',
  '',
)

for (const a of skuAgentAccessData) {
  lines.push(
    `INSERT OR REPLACE INTO sku_agent_access (id, sku_id, agent_slug, enabled, created_at, updated_at) VALUES (`,
    `  '${esc(a.id)}', '${esc(a.skuId)}', '${esc(a.agentSlug)}', ${a.enabled}, '${now}', '${now}'`,
    `);`,
    '',
  )
}

// Print to stdout so caller can pipe to .sql file
process.stdout.write(lines.join('\n') + '\n')
