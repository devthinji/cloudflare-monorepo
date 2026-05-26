import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx'

export interface CvData {
  fullName:    string
  phone:       string
  email?:      string
  location?:   string
  summary?:    string
  experience:  { title: string; company: string; period: string; bullets: string[] }[]
  education:   { degree: string; school: string; year: string }[]
  skills:      string[]
  languages?:  string[]
}

export async function generateCv(data: CvData): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // ── Name ──────────────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: data.fullName, bold: true, size: 36 })],
        }),

        // ── Contact line ──────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: data.phone }),
            ...(data.email    ? [new TextRun({ text: `  ·  ${data.email}` })]    : []),
            ...(data.location ? [new TextRun({ text: `  ·  ${data.location}` })] : []),
          ],
        }),

        // ── Summary ───────────────────────────────────────────────────────────
        ...(data.summary ? [
          sectionHeading('PROFESSIONAL SUMMARY'),
          new Paragraph({ children: [new TextRun({ text: data.summary })] }),
        ] : []),

        // ── Experience ────────────────────────────────────────────────────────
        sectionHeading('WORK EXPERIENCE'),
        ...data.experience.flatMap(exp => [
          new Paragraph({
            children: [
              new TextRun({ text: exp.title, bold: true }),
              new TextRun({ text: `  —  ${exp.company}`, italics: true }),
              new TextRun({ text: `  (${exp.period})`, color: '666666' }),
            ],
          }),
          ...exp.bullets.map(b => new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: b })],
          })),
          new Paragraph({}),
        ]),

        // ── Education ─────────────────────────────────────────────────────────
        sectionHeading('EDUCATION'),
        ...data.education.map(ed => new Paragraph({
          children: [
            new TextRun({ text: ed.degree, bold: true }),
            new TextRun({ text: `  —  ${ed.school}` }),
            new TextRun({ text: `  (${ed.year})`, color: '666666' }),
          ],
        })),

        // ── Skills ────────────────────────────────────────────────────────────
        sectionHeading('SKILLS'),
        new Paragraph({ children: [new TextRun({ text: data.skills.join('  ·  ') })] }),

        // ── Languages ─────────────────────────────────────────────────────────
        ...(data.languages?.length ? [
          sectionHeading('LANGUAGES'),
          new Paragraph({ children: [new TextRun({ text: data.languages.join('  ·  ') })] }),
        ] : []),
      ],
    }],
  })

  return Packer.toBuffer(doc) as unknown as Uint8Array
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1a56db' } },
    children: [new TextRun({ text, bold: true, color: '1a56db', size: 24 })],
    spacing: { before: 240, after: 120 },
  })
}
