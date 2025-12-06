import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Button, Card, Badge } from '../ui'
import type { ImportPath } from '../../types/workspace'

interface ImportPathManagerProps {
  importPaths: ImportPath[]
  onAdd: (path: string, type: 'file' | 'directory') => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onReparse?: () => Promise<void>
}

/**
 * Component for managing proto import paths in a workspace.
 * Allows users to add file/directory paths, enable/disable them, and remove them.
 */
export function ImportPathManager({
  importPaths,
  onAdd,
  onRemove,
  onToggle,
  onReparse,
}: ImportPathManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isReparsing, setIsReparsing] = useState(false)

  const handleAddFile = async () => {
    try {
      setIsAdding(true)
      console.log('Opening file picker...')
      const selected = await open({
        title: 'Select Proto File',
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'Proto Files',
            extensions: ['proto'],
          },
        ],
      })

      console.log('Selected file:', selected)

      if (selected) {
        onAdd(selected as string, 'file')
      }
    } catch (error) {
      console.error('Failed to open file picker:', error)
      alert(`Error opening file picker: ${error}`)
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddDirectory = async () => {
    try {
      setIsAdding(true)
      console.log('Opening directory picker...')
      const selected = await open({
        title: 'Select Directory',
        multiple: false,
        directory: true,
      })

      console.log('Selected directory:', selected)

      if (selected) {
        onAdd(selected as string, 'directory')
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error)
      alert(`Error opening directory picker: ${error}`)
    } finally {
      setIsAdding(false)
    }
  }

  const handleReparse = async () => {
    if (onReparse) {
      try {
        setIsReparsing(true)
        await onReparse()
      } catch (error) {
        console.error('Failed to reparse:', error)
      } finally {
        setIsReparsing(false)
      }
    }
  }

  const formatPath = (path: string) => {
    // Show only the last 2 segments for brevity
    const segments = path.split(/[/\\]/)
    if (segments.length > 2) {
      return `.../${segments.slice(-2).join('/')}`
    }
    return path
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never'
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Import Paths</h3>
          <p className="text-xs text-muted-foreground">
            Proto files and directories to include when parsing services
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddFile}
            disabled={isAdding}
            title="Add proto file"
          >
            📄 Add File
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddDirectory}
            disabled={isAdding}
            title="Add directory"
          >
            📁 Add Directory
          </Button>
        </div>
      </div>

      {/* Import paths list */}
      {importPaths.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No import paths configured. Add proto files or directories to enable service discovery.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {importPaths.map((importPath) => (
            <Card
              key={importPath.id}
              className={`p-3 transition-opacity ${
                !importPath.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Enable/Disable Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importPath.enabled}
                    onChange={() => onToggle(importPath.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  />
                </label>

                {/* Path Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      {importPath.type === 'file' ? '📄' : '📁'}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {formatPath(importPath.path)}
                    </span>
                    <Badge
                      variant={importPath.type === 'file' ? 'blue' : 'green'}
                      className="text-[10px]"
                    >
                      {importPath.type}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono truncate" title={importPath.path}>
                      {importPath.path}
                    </span>
                  </div>
                  {importPath.lastParsed && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Last parsed: {formatDate(importPath.lastParsed)}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(importPath.id)}
                  className="text-destructive hover:bg-destructive/10"
                  title="Remove import path"
                >
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reparse Action */}
      {importPaths.length > 0 && onReparse && (
        <div className="flex items-center justify-between border-t border-border/50 pt-4">
          <p className="text-xs text-muted-foreground">
            Changes to import paths require re-parsing to update services
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReparse}
            disabled={isReparsing}
          >
            {isReparsing ? '⏳ Parsing...' : '🔄 Re-parse Protos'}
          </Button>
        </div>
      )}
    </div>
  )
}
