import { Button } from '@/components/ui/button'
import { Download, Upload, Undo2, Redo2, PanelLeftClose, PanelLeftOpen, Check, AlertCircle, Loader2 } from 'lucide-react'

interface WorkflowToolbarProps {
  onExport: () => void
  onImport: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  canUndo: boolean
  canRedo: boolean
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  saveError?: string | null
}

export default function WorkflowToolbar({ 
  onExport, 
  onImport, 
  onUndo, 
  onRedo, 
  onToggleSidebar, 
  isSidebarOpen, 
  canUndo, 
  canRedo,
  saveStatus = 'idle',
  saveError = null,
}: WorkflowToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-background">
      <Button variant="ghost" size="sm" onClick={onToggleSidebar} title={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}>
        {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      {saveStatus !== 'idle' && (
        <div className="flex items-center gap-2 px-2 text-sm">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-gray-600">Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">{saveError || 'Save failed'}</span>
            </>
          )}
        </div>
      )}

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
