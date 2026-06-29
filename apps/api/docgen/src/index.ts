import { registerAllConverters } from './pipeline/converters'
import app from './routes'

registerAllConverters()

export default app
