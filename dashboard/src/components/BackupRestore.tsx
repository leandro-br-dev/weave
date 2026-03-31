import { useState, useRef } from 'react'
import { Card } from '@/components'
import { Button } from '@/components'
import { useBackupInfo, useExportBackup, useImportBackup, type BackupData, type ImportResult } from '@/api/backup'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/contexts/ToastContext'
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Archive,
  FolderTree,
  FileText,
  Bot,
  LayoutList,
  MessageSquare,
  Settings2,
} from 'lucide-react'

export function BackupRestoreSection() {
  const { t } = useTranslation()
  const { showSuccess, showError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: info } = useBackupInfo()
  const exportMutation = useExportBackup()
  const importMutation = useImportBackup()

  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [showConfirmImport, setShowConfirmImport] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)

  // ---- Export handler -------------------------------------------------------
  const handleExport = async () => {
    try {
      const backupData = await exportMutation.mutateAsync()
      const json = JSON.stringify(backupData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `weave-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSuccess(t('pages.settings.backup.exportSuccess'))
    } catch (err: any) {
      showError(t('pages.settings.backup.exportError'), err.message || '')
    }
  }

  // ---- Import file selection ------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportResult(null)
    setImportError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData
        if (!data.version || !data.exported_at) {
          setImportError(t('pages.settings.backup.invalidFile'))
          return
        }
        setPendingBackup(data)
        setShowConfirmImport(true)
      } catch {
        setImportError(t('pages.settings.backup.invalidJson'))
      }
    }
    reader.readAsText(file)

    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  // ---- Confirm import -------------------------------------------------------
  const handleConfirmImport = async () => {
    if (!pendingBackup) return
    setShowConfirmImport(false)

    try {
      const result = await importMutation.mutateAsync(pendingBackup)
      setImportResult(result)
      setPendingBackup(null)
      showSuccess(
        t('pages.settings.backup.importSuccess', {
          projects: result.projects_imported,
          agents: result.agents_restored,
        })
      )
    } catch (err: any) {
      setImportError(err.message || t('pages.settings.backup.importError'))
      setPendingBackup(null)
      showError(t('pages.settings.backup.importError'), err.message || '')
    }
  }

  const handleCancelImport = () => {
    setShowConfirmImport(false)
    setPendingBackup(null)
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
        {t('pages.settings.backup.title')}
      </h2>

      {/* Info summary */}
      {info && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <InfoItem icon={<FolderTree className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.projects')} value={info.projects} />
          <InfoItem icon={<FileText className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.environments')} value={info.environments} />
          <InfoItem icon={<Bot className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.agents')} value={info.agent_workspaces} />
          <InfoItem icon={<LayoutList className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.kanbanTasks')} value={info.kanban_tasks} />
          <InfoItem icon={<Archive className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.plans')} value={info.plans} />
          <InfoItem icon={<MessageSquare className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.chatSessions')} value={info.chat_sessions} />
          <InfoItem icon={<MessageSquare className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.chatMessages')} value={info.chat_messages} />
          <InfoItem icon={<Settings2 className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.envVars')} value={info.environment_variables} />
          <InfoItem icon={<LayoutList className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.templates')} value={info.kanban_templates} />
          <InfoItem icon={<FileText className="h-4 w-4" />} label={t('pages.settings.backup.infoItems.approvals')} value={info.approvals} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Export button */}
        <Card className="flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('pages.settings.backup.exportTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('pages.settings.backup.exportDescription')}
              </p>
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                loading={exportMutation.isPending}
                className="mt-3 bg-blue-600 hover:bg-blue-700 border-blue-600 text-xs sm:text-sm"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {t('pages.settings.backup.exportButton')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Import button */}
        <Card className="flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
              <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('pages.settings.backup.importTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('pages.settings.backup.importDescription')}
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                loading={importMutation.isPending}
                className="mt-3 bg-green-600 hover:bg-green-700 border-green-600 text-xs sm:text-sm"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {t('pages.settings.backup.importButton')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Import error */}
      {importError && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {importError}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="mt-3 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              {t('pages.settings.backup.importResultTitle')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-green-600 dark:text-green-400">
            <span>{t('pages.settings.backup.infoItems.projects')}: {importResult.projects_imported}</span>
            <span>{t('pages.settings.backup.infoItems.environments')}: {importResult.environments_imported}</span>
            <span>{t('pages.settings.backup.infoItems.agents')}: {importResult.agents_restored}</span>
            <span>{t('pages.settings.backup.infoItems.plans')}: {importResult.plans_imported}</span>
            <span>{t('pages.settings.backup.infoItems.kanbanTasks')}: {importResult.kanban_tasks_imported}</span>
            <span>{t('pages.settings.backup.infoItems.chatSessions')}: {importResult.chat_sessions_imported}</span>
            <span>{t('pages.settings.backup.infoItems.chatMessages')}: {importResult.chat_messages_imported}</span>
            <span>{t('pages.settings.backup.infoItems.envVars')}: {importResult.env_vars_imported}</span>
            <span>{t('pages.settings.backup.infoItems.templates')}: {importResult.kanban_templates_imported}</span>
          </div>
          <p className="mt-2 text-xs text-green-500 dark:text-green-500">
            {t('pages.settings.backup.backupFrom', { date: new Date(importResult.exported_at).toLocaleString() })}
          </p>
        </div>
      )}

      {/* Confirm import modal */}
      {showConfirmImport && pendingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {t('pages.settings.backup.confirmImportTitle')}
              </h3>
            </div>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>{t('pages.settings.backup.confirmImportMessage')}</p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.version')}:</span>
                  <span className="font-mono">{pendingBackup.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.exportedAt')}:</span>
                  <span>{new Date(pendingBackup.exported_at).toLocaleString()}</span>
                </div>
                <hr className="border-gray-200 dark:border-gray-700" />
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.infoItems.projects')}:</span>
                  <span className="font-semibold">{pendingBackup.metadata.projects_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.infoItems.agents')}:</span>
                  <span className="font-semibold">{pendingBackup.metadata.agents_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.infoItems.plans')}:</span>
                  <span className="font-semibold">{pendingBackup.metadata.plans_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.infoItems.kanbanTasks')}:</span>
                  <span className="font-semibold">{pendingBackup.metadata.kanban_tasks_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('pages.settings.backup.infoItems.chatSessions')}:</span>
                  <span className="font-semibold">{pendingBackup.metadata.chat_sessions_count}</span>
                </div>
              </div>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                {t('pages.settings.backup.confirmWarning')}
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={handleCancelImport}
                className="text-xs sm:text-sm"
              >
                {t('pages.settings.backup.cancel')}
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={importMutation.isPending}
                loading={importMutation.isPending}
                className="bg-green-600 hover:bg-green-700 border-green-600 text-xs sm:text-sm"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {t('pages.settings.backup.importing')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1.5" />
                    {t('pages.settings.backup.confirmImport')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Small info card
// ---------------------------------------------------------------------------

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
      <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight">
          {value}
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {label}
        </div>
      </div>
    </div>
  )
}
