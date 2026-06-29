// ─── Converter Registry ───────────────────────────────────────────────────────
//
// Import this once in docgen/src/index.ts to register all converters.
// To add a new converter: create the file, import it here, call register().

import { pipelineFactory } from '../factory'
import { docxToSchema }    from './docx-to-schema'
import { docxToMarkdown }  from './docx-to-markdown'
import { pdfToTxt }        from './pdf-to-txt'
import { pdfToSchema }     from './pdf-to-schema'
import { visionToSchema }  from './vision-to-schema'

export function registerAllConverters(): void {
  pipelineFactory
    .register('docx',  'placeholder_schema', docxToSchema)
    .register('docx',  'markdown',           docxToMarkdown)
    .register('pdf',   'txt',                pdfToTxt)
    .register('pdf',   'placeholder_schema', pdfToSchema)
    .register('image', 'placeholder_schema', visionToSchema)
    .register('png',   'placeholder_schema', visionToSchema)
    .register('jpg',   'placeholder_schema', visionToSchema)
    .register('canva', 'placeholder_schema', visionToSchema)
}
