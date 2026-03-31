import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiUrl } from '@/api/client';
import { PageHeader, Button, Card, Input } from '@/components';
import { ThemeSelector } from '@/components/ThemeSelector';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BackupRestoreSection } from '@/components/BackupRestore';
import { Tabs } from '@/components/Tabs';
import { useGetEnvironmentVariables, useCreateEnvironmentVariable, useUpdateEnvironmentVariable, useDeleteEnvironmentVariable, useInitializeEnvironmentVariableDefaults, type EnvironmentVariable, type EnvironmentVariableInput } from '@/api/environmentVariables';
import { useState } from 'react';
import { Plus, Trash2, Edit2, Eye, EyeOff, Save, X, Globe, ExternalLink, AlertCircle, Languages, Settings, Link as LinkIcon, Server, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGetProjects, useUpdateProject } from '@/api/projects';
import { ProjectSelectDropdown } from '@/components';
import { useToast } from '@/contexts/ToastContext';

function ApiStatusBadge() {
  const { t } = useTranslation();
  const { isError, isLoading } = useQuery({
    queryKey: ['api-health'],
    queryFn: () => apiFetch<any>('/api/plans'),
    retry: false,
    refetchInterval: 30000,
  });

  if (isLoading) return <span className="text-xs text-gray-400">{t('pages.settings.apiConnection.statusValues.checking')}</span>;

  if (isError) return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <span className="h-2 w-2 rounded-full bg-red-500" /> {t('pages.settings.apiConnection.statusValues.unreachable')}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <span className="h-2 w-2 rounded-full bg-green-500" /> {t('pages.settings.apiConnection.statusValues.connected')}
    </span>
  );
}

// Hooks para daemon
function useDaemonStatus() {
  return useQuery({
    queryKey: ['daemon', 'status'],
    queryFn: () => apiFetch<{ status: string; pid: number | null; logs: string[] }>('/api/daemon/status'),
    refetchInterval: 5000,
  })
}

function useStartDaemon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/daemon/start', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daemon'] }),
  })
}

function useStopDaemon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/api/daemon/stop', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daemon'] }),
  })
}

// Component for managing environment variables
function EnvironmentVariablesSection() {
  const { t } = useTranslation();
  const { data: envVars, isLoading, isError, error } = useGetEnvironmentVariables();
  const createMutation = useCreateEnvironmentVariable();
  const updateMutation = useUpdateEnvironmentVariable();
  const deleteMutation = useDeleteEnvironmentVariable();
  const initializeDefaults = useInitializeEnvironmentVariableDefaults();

  const [showForm, setShowForm] = useState(false);
  const [editingVar, setEditingVar] = useState<EnvironmentVariable | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<EnvironmentVariableInput>({
    key: '',
    value: '',
    description: '',
    category: 'general',
    is_secret: false,
  });

  // Common environment variable suggestions
  const commonVariables = [
    { key: 'ANTHROPIC_BASE_URL', description: t('pages.settings.envVars.suggestions.ANTHROPIC_BASE_URL'), category: 'anthropic' },
    { key: 'ANTHROPIC_API_KEY', description: t('pages.settings.envVars.suggestions.ANTHROPIC_API_KEY'), category: 'anthropic', is_secret: true },
    { key: 'ANTHROPIC_MODEL', description: t('pages.settings.envVars.suggestions.ANTHROPIC_MODEL'), category: 'anthropic' },
    { key: 'OPENAI_API_KEY', description: t('pages.settings.envVars.suggestions.OPENAI_API_KEY'), category: 'openai', is_secret: true },
    { key: 'OPENAI_BASE_URL', description: t('pages.settings.envVars.suggestions.OPENAI_BASE_URL'), category: 'openai' },
    { key: 'TAVILY_API_KEY', description: t('pages.settings.envVars.suggestions.TAVILY_API_KEY'), category: 'general', is_secret: true },
    { key: 'SERPER_API_KEY', description: t('pages.settings.envVars.suggestions.SERPER_API_KEY'), category: 'general', is_secret: true },
  ];

  // Filter and group environment variables
  const filteredVars = envVars?.filter(envVar => {
    const matchesSearch = searchTerm === '' ||
      envVar.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      envVar.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || envVar.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const groupedVars = filteredVars.reduce((acc, envVar) => {
    if (!acc[envVar.category]) {
      acc[envVar.category] = [];
    }
    acc[envVar.category].push(envVar);
    return acc;
  }, {} as Record<string, EnvironmentVariable[]>);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    createMutation.mutate(formData, {
      onSuccess: () => {
        setFormData({ key: '', value: '', description: '', category: 'general', is_secret: false });
        setShowForm(false);
      },
      onError: (error: any) => {
        setSubmitError(error.message || t('pages.settings.envVars.form.errors.createFailed'));
      },
    });
  };

  const handleUseSuggestion = (suggestion: typeof commonVariables[0]) => {
    setFormData({
      key: suggestion.key,
      value: '',
      description: suggestion.description,
      category: suggestion.category,
      is_secret: suggestion.is_secret || false,
    });
    setShowForm(true);
    setEditingVar(null);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVar) return;
    setSubmitError(null);
    updateMutation.mutate({ id: editingVar.id, data: formData }, {
      onSuccess: () => {
        setEditingVar(null);
        setFormData({ key: '', value: '', description: '', category: 'general', is_secret: false });
      },
      onError: (error: any) => {
        setSubmitError(error.message || t('pages.settings.envVars.form.errors.updateFailed'));
      },
    });
  };

  const handleEdit = (envVar: EnvironmentVariable) => {
    setEditingVar(envVar);
    setFormData({
      key: envVar.key,
      value: envVar.value,
      description: envVar.description,
      category: envVar.category,
      is_secret: envVar.is_secret,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm(t('pages.settings.envVars.confirmDelete'))) {
      deleteMutation.mutate(id);
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSecretVisible = (id: string) => showSecrets[id] || false;

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('pages.settings.envVars.title')}</h2>
        <Card>
          <p className="text-sm text-gray-600">{t('pages.settings.envVars.loading')}</p>
        </Card>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('pages.settings.envVars.title')}</h2>
        <Card className="bg-red-50 border-red-200">
          <p className="text-sm text-red-600">{t('pages.settings.envVars.error')}: {(error as Error)?.message || t('pages.settings.envVars.error')}</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{t('pages.settings.envVars.title')}</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => initializeDefaults.mutate()}
            disabled={initializeDefaults.isPending}
            variant="secondary"
            className="text-sm"
          >
            {t('pages.settings.envVars.actions.initializeDefaults')}
          </Button>
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingVar(null);
              setFormData({ key: '', value: '', description: '', category: 'general', is_secret: false });
            }}
            className="text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('pages.settings.envVars.actions.newVariable')}
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-4 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.settings.envVars.filters.search')}</label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('pages.settings.envVars.filters.searchPlaceholder')}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.settings.envVars.filters.category')}</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('pages.settings.envVars.filters.categories.all')}</option>
              <option value="general">{t('pages.settings.envVars.filters.categories.general')}</option>
              <option value="anthropic">{t('pages.settings.envVars.filters.categories.anthropic')}</option>
              <option value="openai">{t('pages.settings.envVars.filters.categories.openai')}</option>
              <option value="custom">{t('pages.settings.envVars.filters.categories.custom')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Common Variables Suggestions */}
      {!showForm && !editingVar && (
        <Card className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('pages.settings.envVars.quickAdd.title')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {commonVariables.map((varInfo) => {
              const exists = envVars?.some(v => v.key === varInfo.key);
              return (
                <button
                  key={varInfo.key}
                  onClick={() => !exists && handleUseSuggestion(varInfo)}
                  disabled={exists}
                  className={`text-left p-2 rounded border text-xs transition-colors ${
                    exists
                      ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <code className="font-semibold text-xs break-all">{varInfo.key}</code>
                    {exists ? (
                      <span className="text-green-600 whitespace-nowrap">✓ {t('pages.settings.envVars.quickAdd.added')}</span>
                    ) : (
                      <Plus className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs">{varInfo.description}</div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {(showForm || editingVar) && (
        <Card className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {editingVar ? t('pages.settings.envVars.form.edit') : t('pages.settings.envVars.form.new')}
          </h3>
          {submitError && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
              {submitError}
            </div>
          )}
          <form onSubmit={editingVar ? handleUpdate : handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.settings.envVars.form.fields.key')}</label>
                <Input
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  placeholder={t('pages.settings.envVars.form.fields.keyPlaceholder')}
                  required
                  disabled={editingVar !== null}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.settings.envVars.form.fields.category')}</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="general">{t('pages.settings.envVars.filters.categories.general')}</option>
                  <option value="anthropic">{t('pages.settings.envVars.filters.categories.anthropic')}</option>
                  <option value="openai">{t('pages.settings.envVars.filters.categories.openai')}</option>
                  <option value="custom">{t('pages.settings.envVars.filters.categories.custom')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('pages.settings.envVars.form.fields.value')}</label>
              <div className="relative">
                <Input
                  type={formData.is_secret && !isSecretVisible(editingVar?.id || 'new') ? 'password' : 'text'}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={t('pages.settings.envVars.form.fields.valuePlaceholder')}
                  required
                />
                {formData.is_secret && (
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility(editingVar?.id || 'new')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {isSecretVisible(editingVar?.id || 'new') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.settings.envVars.form.fields.description')}</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('pages.settings.envVars.form.fields.descriptionPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_secret"
                checked={formData.is_secret}
                onChange={(e) => setFormData({ ...formData, is_secret: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_secret" className="text-xs text-gray-700 dark:text-gray-300">{t('pages.settings.envVars.form.fields.markAsSecret')}</label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                loading={createMutation.isPending || updateMutation.isPending}
                className="text-sm"
              >
                <Save className="w-4 h-4 mr-1" />
                {editingVar ? t('pages.settings.envVars.form.actions.update') : t('pages.settings.envVars.form.actions.create')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingVar(null);
                  setFormData({ key: '', value: '', description: '', category: 'general', is_secret: false });
                }}
                className="text-sm"
              >
                <X className="w-4 h-4 mr-1" />
                {t('pages.settings.envVars.form.actions.cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {Object.keys(groupedVars).length === 0 ? (
        <Card className="bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
            {searchTerm || selectedCategory !== 'all'
              ? t('pages.settings.envVars.noResults.filtered')
              : t('pages.settings.envVars.noResults.empty')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedVars).map(([category, vars]) => (
            <Card key={category} className="bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">{category}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">{vars.length} {vars.length !== 1 ? t('pages.settings.envVars.badges.variables') : t('pages.settings.envVars.badges.variable')}</span>
              </div>
              <div className="space-y-2">
                {vars.map((envVar) => (
                  <div key={envVar.id} className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <code className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{envVar.key}</code>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded capitalize">{envVar.category}</span>
                          {envVar.is_secret && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{t('pages.settings.envVars.badges.secret')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded break-all">
                            {envVar.is_secret && !isSecretVisible(envVar.id)
                              ? '••••••••'
                              : envVar.value}
                          </code>
                          {envVar.is_secret && (
                            <button
                              onClick={() => toggleSecretVisibility(envVar.id)}
                              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                            >
                              {isSecretVisible(envVar.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {envVar.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{envVar.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleEdit(envVar)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(envVar.id)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// Language Section
function LanguageSection() {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
        <Languages className="w-5 h-5" />
        {t('pages.settings.language.title')}
      </h2>
      <Card>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('pages.settings.language.description')}
        </p>
        <div>
          <LanguageSelector layout="vertical" />
        </div>
      </Card>
    </section>
  );
}

// Appearance Section
function AppearanceSection() {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.appearance.title')}</h2>
      <Card>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('pages.settings.appearance.description')}</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('pages.settings.appearance.theme')}</label>
          <ThemeSelector layout="vertical" />
        </div>
      </Card>
    </section>
  );
}

// Cloudflare Tunnel Section
function CloudflareTunnelSection() {
  const { t } = useTranslation();
  const { data: tunnelConfig, isLoading, refetch } = useQuery({
    queryKey: ['cloudflare', 'tunnel'],
    queryFn: () =>
      apiFetch<{ enabled: boolean; domain?: string; subdomain?: string; fullDomain?: string }>('/api/cloudflare/tunnel')
        .then(data => data ?? { enabled: false })
        .catch((): { enabled: boolean; fullDomain?: string } => ({ enabled: false })),
    retry: false,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => apiFetch('/api/cloudflare/tunnel', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.cloudflare.title')}</h2>
        <Card>
          <p className="text-sm text-gray-600">{t('pages.settings.cloudflare.loading')}</p>
        </Card>
      </section>
    );
  }

  const isEnabled = tunnelConfig?.enabled || false;
  const fullDomain = tunnelConfig?.fullDomain;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Globe className="w-5 h-5" />
        {t('pages.settings.cloudflare.title')}
      </h2>
      <Card>
        {isEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              <strong>{t('pages.settings.cloudflare.status.enabled')}</strong>
            </div>

            {fullDomain && (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                  <div>
                    <div className="text-xs text-gray-600">{t('pages.settings.cloudflare.urls.public')}</div>
                    <div className="text-sm font-mono font-semibold text-gray-900">{fullDomain}</div>
                  </div>
                  <a
                    href={`https://${fullDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                    <div className="text-xs text-gray-600">{t('pages.settings.cloudflare.urls.api')}</div>
                    <div className="text-sm font-mono font-semibold text-gray-900">api-{fullDomain}</div>
                  </div>
                  <a
                    href={`https://api-${fullDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            <Button
              onClick={() => toggleMutation.mutate(false)}
              disabled={toggleMutation.isPending}
              variant="secondary"
              className="w-full"
            >
              {t('pages.settings.cloudflare.actions.disable')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded border border-yellow-200">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-yellow-900">{t('pages.settings.cloudflare.messages.notConfigured.title')}</div>
                <p className="text-xs text-yellow-800 mt-1">
                  {t('pages.settings.cloudflare.messages.notConfigured.description')}
                </p>
                <code className="block mt-2 text-xs bg-yellow-100 p-2 rounded font-mono">
                  {t('pages.settings.cloudflare.messages.notConfigured.script')}
                </code>
              </div>
            </div>

            <div className="text-xs text-gray-600">
              <p className="font-semibold mb-1">{t('pages.settings.cloudflare.messages.benefits.title')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('pages.settings.cloudflare.messages.benefits.accessAnywhere')}</li>
                <li>{t('pages.settings.cloudflare.messages.benefits.encryption')}</li>
                <li>{t('pages.settings.cloudflare.messages.benefits.noRouterConfig')}</li>
                <li>{t('pages.settings.cloudflare.messages.benefits.anyDomain')}</li>
              </ul>
            </div>

            <Button
              onClick={() => window.open('https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/', '_blank')}
              variant="secondary"
              className="w-full"
            >
              {t('pages.settings.cloudflare.actions.learnMore')}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: daemon } = useDaemonStatus()
  const startDaemon = useStartDaemon()
  const stopDaemon = useStopDaemon()

  // Define tabs configuration
  const tabsConfig = [
    {
      id: 'general',
      label: t('pages.settings.tabs.general.label'),
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <LanguageSection />
          <AppearanceSection />
          <WorkflowLimitsSection />
        </div>
      )
    },
    {
      id: 'connections',
      label: t('pages.settings.tabs.connections.label'),
      icon: <LinkIcon className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <ApiConnectionSection />
          <CloudflareTunnelSection />
          <EnvironmentVariablesSection />
        </div>
      )
    },
    {
      id: 'system',
      label: t('pages.settings.tabs.system.label'),
      icon: <Server className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <DaemonSection daemon={daemon} startDaemon={startDaemon} stopDaemon={stopDaemon} />
          <ClientSection />
          <BackupRestoreSection />
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.settings.title')}
        description={t('pages.settings.description')}
      />

      <Tabs tabs={tabsConfig} defaultTab="general" />
    </div>
  );
}

// Workflow Limits Section
function WorkflowLimitsSection() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useGetProjects();
  const updateProject = useUpdateProject();
  const { showSuccess, showError } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [maxConcurrentWorkflows, setMaxConcurrentWorkflows] = useState<number>(0);
  const [maxPlanningTasks, setMaxPlanningTasks] = useState<number>(0);
  const [maxInProgressTasks, setMaxInProgressTasks] = useState<number>(0);

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  // Sync form state when selected project changes
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects?.find(p => p.id === projectId);
    if (project?.settings) {
      setMaxConcurrentWorkflows(project.settings.max_concurrent_workflows ?? 0);
      setMaxPlanningTasks(project.settings.max_planning_tasks ?? 0);
      setMaxInProgressTasks(project.settings.max_in_progress_tasks ?? 0);
    } else {
      setMaxConcurrentWorkflows(0);
      setMaxPlanningTasks(0);
      setMaxInProgressTasks(0);
    }
  };

  // Auto-select first project when projects load
  if (projects && projects.length > 0 && !selectedProjectId) {
    setSelectedProjectId(projects[0].id);
    const p = projects[0];
    if (p.settings) {
      setMaxConcurrentWorkflows(p.settings.max_concurrent_workflows ?? 0);
      setMaxPlanningTasks(p.settings.max_planning_tasks ?? 0);
      setMaxInProgressTasks(p.settings.max_in_progress_tasks ?? 0);
    }
  }

  const handleSave = () => {
    if (!selectedProjectId) return;
    updateProject.mutate({
      id: selectedProjectId,
      settings: {
        auto_approve_workflows: selectedProject?.settings?.auto_approve_workflows ?? false,
        auto_move_enabled: selectedProject?.settings?.auto_move_enabled ?? false,
        ...selectedProject?.settings,
        max_concurrent_workflows: maxConcurrentWorkflows,
        max_planning_tasks: maxPlanningTasks,
        max_in_progress_tasks: maxInProgressTasks,
      },
    }, {
      onSuccess: () => {
        showSuccess(t('pages.settings.workflowLimits.saved'));
      },
      onError: (error: any) => {
        showError(t('pages.settings.workflowLimits.saved'), error.message);
      },
    });
  };

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.workflowLimits.title')}</h2>
        <Card>
          <p className="text-sm text-gray-600">{t('pages.settings.workflowLimits.title')}...</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
        <GitBranch className="w-5 h-5" />
        {t('pages.settings.workflowLimits.title')}
      </h2>
      <Card className="bg-gray-50 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('pages.settings.workflowLimits.description')}
        </p>

        <div className="mb-4">
          <ProjectSelectDropdown
            value={selectedProjectId}
            onChange={handleProjectChange}
            projects={projects || []}
            label={t('pages.settings.workflowLimits.selectProject')}
            placeholder={t('pages.settings.workflowLimits.selectProject')}
          />
        </div>

        {selectedProject && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pages.settings.workflowLimits.maxConcurrentWorkflows')}
              </label>
              <Input
                type="number"
                min={0}
                value={maxConcurrentWorkflows}
                onChange={(e) => setMaxConcurrentWorkflows(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('pages.settings.workflowLimits.maxConcurrentWorkflowsDescription')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pages.settings.workflowLimits.maxPlanningTasks')}
              </label>
              <Input
                type="number"
                min={0}
                value={maxPlanningTasks}
                onChange={(e) => setMaxPlanningTasks(parseInt(e.target.value) || 0)}
                placeholder="1"
                className="text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('pages.settings.workflowLimits.maxPlanningTasksDescription')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pages.settings.workflowLimits.maxInProgressTasks')}
              </label>
              <Input
                type="number"
                min={0}
                value={maxInProgressTasks}
                onChange={(e) => setMaxInProgressTasks(parseInt(e.target.value) || 0)}
                placeholder="1"
                className="text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('pages.settings.workflowLimits.maxInProgressTasksDescription')}
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSave}
                disabled={updateProject.isPending}
                loading={updateProject.isPending}
                className="text-sm"
              >
                <Save className="w-4 h-4 mr-1" />
                {t('pages.settings.workflowLimits.save')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

// API Connection Section
function ApiConnectionSection() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.apiConnection.title')}</h2>
      <Card className="bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('pages.settings.apiConnection.apiUrl')}</span>
          <code className="text-xs sm:text-sm font-mono text-gray-900 dark:text-white break-all">
            {getApiUrl()}
          </code>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 mt-2 sm:mt-3">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('pages.settings.apiConnection.status')}</span>
          <ApiStatusBadge />
        </div>
      </Card>
    </section>
  );
}

// Daemon Section
function DaemonSection({ daemon, startDaemon, stopDaemon }: { daemon: any, startDaemon: any, stopDaemon: any }) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.daemon.title')}</h2>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${
              daemon?.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`} />
            <span className="text-xs sm:text-sm font-medium">
              {daemon?.status === 'running' ? t('pages.settings.daemon.status.running', { pid: daemon.pid }) : t('pages.settings.daemon.status.stopped')}
            </span>
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            {daemon?.status !== 'running' ? (
              <Button
                onClick={() => startDaemon.mutate()}
                disabled={startDaemon.isPending}
                loading={startDaemon.isPending}
                className="bg-green-600 hover:bg-green-700 border-green-600 text-xs sm:text-sm"
              >
                {t('pages.settings.daemon.actions.start')}
              </Button>
            ) : (
              <Button
                onClick={() => stopDaemon.mutate()}
                disabled={stopDaemon.isPending}
                loading={stopDaemon.isPending}
                variant="danger"
                className="text-xs sm:text-sm"
              >
                {t('pages.settings.daemon.actions.stop')}
              </Button>
            )}
          </div>
        </div>
        {daemon?.logs && daemon.logs.length > 0 && (
          <pre className="bg-gray-900 text-gray-100 rounded p-2 sm:p-3 text-xs max-h-40 overflow-y-auto dark:bg-gray-900 dark:text-gray-100">
            {daemon.logs.slice(-20).join('\n')}
          </pre>
        )}
      </Card>
    </section>
  );
}

// Client Section
function ClientSection() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('pages.settings.client.title')}</h2>
      <Card className="bg-gray-50 dark:bg-gray-900">
        <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
          <strong>{t('pages.settings.client.managed')}</strong> — {t('pages.settings.client.managedDescription')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {t('pages.settings.client.manualStart', { scriptPath: 'client/main.py' })}
        </p>
      </Card>
    </section>
  );
}
