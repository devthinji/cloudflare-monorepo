import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Header, Footer,
} from 'docx'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const OUT = join(__dirname, '..', '..', '..', '..', 'public', 'docx', 'templates')

function bold(text: string): TextRun {
  return new TextRun({ text, bold: true })
}

function regular(text: string): TextRun {
  return new TextRun({ text })
}

function heading1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 36 })],
  })
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a56db' } },
    children: [new TextRun({ text, bold: true, color: '1a56db', size: 24 })],
    spacing: { before: 300, after: 120 },
  })
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 80 } })
}

function fieldRow(label: string, placeholder: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [bold(label + ': '), regular(placeholder)],
  })
}

// ─── 1. Professional CV ─────────────────────────────────────────────────

async function generateCv(): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: '{full_name} — CV', color: '666666', size: 16 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Page ', size: 16 }),
                       new TextRun({ text: '1', size: 16, bold: true })],
          })],
        }),
      },
      children: [
        heading1('{full_name}'),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: '{phone}', size: 20 }),
            new TextRun({ text: '  |  ', size: 20, color: '999999' }),
            new TextRun({ text: '{email}', size: 20 }),
            new TextRun({ text: '  |  ', size: 20, color: '999999' }),
            new TextRun({ text: '{location}', size: 20 }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Target: {job_title}', size: 20, color: '333333', italics: true })],
        }),

        heading2('Professional Summary'),
        new Paragraph({
          spacing: { after: 200 },
          children: [regular('{summary}')],
        }),

        heading2('Work Experience'),
        new Paragraph({
          spacing: { after: 200 },
          children: [regular('{experience}')],
        }),

        heading2('Education'),
        new Paragraph({
          spacing: { after: 200 },
          children: [regular('{education}')],
        }),

        heading2('Key Skills'),
        new Paragraph({
          spacing: { after: 200 },
          children: [regular('{skills}')],
        }),

        heading2('Languages'),
        new Paragraph({
          spacing: { after: 200 },
          children: [regular('{languages}')],
        }),
      ],
    }],
  })
  return Packer.toBuffer(doc) as unknown as Uint8Array
}

// ─── 2. Cover Letter ────────────────────────────────────────────────────

async function generateCoverLetter(): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        spacer(),
        new Paragraph({ children: [regular('{full_name}')] }),
        new Paragraph({ children: [regular('{phone}')] }),
        new Paragraph({ children: [regular('{email}')], spacing: { after: 200 } }),

        new Paragraph({ children: [regular('{hiring_manager}')] }),
        new Paragraph({ children: [regular('{company_name}')] }),
        new Paragraph({ children: [regular('Kenya')], spacing: { after: 200 } }),

        new Paragraph({ children: [regular('Dear {hiring_manager},')], spacing: { after: 120 } }),

        heading1('Re: Application for {job_title}'),

        spacer(),
        new Paragraph({ children: [regular('{why_interested}')], spacing: { after: 200 } }),
        new Paragraph({ children: [regular('{key_achievement}')], spacing: { after: 200 } }),

        new Paragraph({
          children: [regular('I am available to start {availability}. Thank you for considering my application.')],
          spacing: { after: 200 },
        }),

        spacer(),
        new Paragraph({ children: [regular('Yours sincerely,')], spacing: { after: 80 } }),
        new Paragraph({ children: [bold('{full_name}')] }),
        new Paragraph({ children: [regular('{phone}')] }),
        new Paragraph({ children: [regular('{email}')] }),
      ],
    }],
  })
  return Packer.toBuffer(doc) as unknown as Uint8Array
}

// ─── 3. Resignation Letter ──────────────────────────────────────────────

async function generateResignation(): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        spacer(),
        new Paragraph({ children: [regular('{full_name}')] }),
        new Paragraph({ children: [regular('{current_job_title}')] }),
        new Paragraph({ children: [regular('{company_name}')] }),
        new Paragraph({ children: [regular('Kenya')], spacing: { after: 200 } }),

        new Paragraph({ children: [regular(new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }))] }),
        spacer(),

        new Paragraph({ children: [regular('Dear {manager_name},')], spacing: { after: 120 } }),

        heading1('Letter of Resignation'),

        spacer(),
        new Paragraph({
          children: [regular('Please accept this letter as formal notification that I am resigning from my position as {current_job_title} at {company_name}.')],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [regular('In accordance with my notice period of {notice_period}, my last working day will be {last_working_day}.')],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [regular('{reason}')],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [regular('I am grateful for the opportunity to have worked at {company_name} and I wish the team continued success.')],
          spacing: { after: 200 },
        }),

        spacer(),
        new Paragraph({ children: [regular('Sincerely,')], spacing: { after: 80 } }),
        new Paragraph({ children: [bold('{full_name}')] }),
        new Paragraph({ children: [regular('{current_job_title}')] }),
      ],
    }],
  })
  return Packer.toBuffer(doc) as unknown as Uint8Array
}

// ─── 4. Basic CV (Free) ─────────────────────────────────────────────────

async function generateBasicCv(): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading1('{full_name}'),
        spacer(),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Phone: ', bold: true }),
            new TextRun({ text: '{phone}', size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Target Job: ', bold: true }),
            new TextRun({ text: '{job_title}', size: 22 }),
          ],
        }),
        new Paragraph({
          spacing: { before: 400 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '— Basic CV —', color: '999999', italics: true })],
        }),
      ],
    }],
  })
  return Packer.toBuffer(doc) as unknown as Uint8Array
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true })

  const templates: [string, () => Promise<Uint8Array>][] = [
    ['cv-professional-v1.docx', generateCv],
    ['cover-letter-v1.docx', generateCoverLetter],
    ['resignation-letter-v1.docx', generateResignation],
    ['basic-cv-free-v1.docx', generateBasicCv],
  ]

  for (const [filename, gen] of templates) {
    const buf = await gen()
    const path = join(OUT, filename)
    writeFileSync(path, buf)
    console.log(`✓ ${filename}  (${(buf.byteLength / 1024).toFixed(1)} KB)`)
  }
  console.log(`\nOutput: ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
