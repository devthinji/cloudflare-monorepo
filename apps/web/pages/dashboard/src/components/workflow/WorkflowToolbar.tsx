import { Button } from '@/components/ui/button'
import { Download, Upload, Undo2, Redo2 } from 'lucide-react'

interface WorkflowToolbarProps {
  onExport: () => void
  onImport: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export default function WorkflowToolbar({ onExport, onImport, onUndo, onRedo, canUndo, canRedo }: WorkflowToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-white">
      <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      <Button variant="outline" size="sm" onClick={onImport} title="Import blueprint JSON">
        <Upload className="h-4 w-4 mr-1" />
        Import
      </Button>
      <Button variant="outline" size="sm" onClick={onExport} title="Export blueprint JSON">
        <Download className="h-4 w-4 mr-1" />
        Export
      </Button>
    </div>
  )
}
