import { useState } from 'react';
import { Search, Download, Star, ExternalLink, Package, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, PageHeader, EmptyState } from '@/components';
import { useMarketplaceSearch, useRepoContents, useSkillPreview, useInstallSkill } from '@/api/marketplace';
import { useGetWorkspaces } from '@/api/workspaces';
import {
  textColors, darkModeTextColors, bgColors, darkModeBgColors,
  borderColors, darkModeBorderColors, accentColors,
  successColors, darkModeCodeBlockColors,
  interactiveStates, darkModeInteractiveStates, withDarkMode
} from '@/lib/colors';

export default function MarketplacePage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'skill' | 'agent'>('skill');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);        // repo selecionado
  const [selectedSkillPath, setSelectedSkillPath] = useState(''); // path do SKILL.md
  const [selectedWorkspace, setSelectedWorkspace] = useState('');

  const { data: results = [], isLoading } = useMarketplaceSearch(query, type, page);
  const { data: workspaces = [] } = useGetWorkspaces();
  const installSkill = useInstallSkill();
  const [installSuccess, setInstallSuccess] = useState(false);

  // Quando um repo é selecionado, lista o conteúdo
  const { data: repoContents = [] } = useRepoContents(
    selected?.source === 'github' ? selected.url.replace('https://github.com/', '') : '',
    '' // raiz do repo
  );

  // Preview do SKILL.md
  const previewRepo = selected?.source === 'github' ? selected.url.replace('https://github.com/', '') : '';
  const { data: preview } = useSkillPreview(previewRepo, selectedSkillPath);

  // Filtra: mostra pastas (que podem ter SKILL.md) e arquivos SKILL.md diretos
  const skillFolders = repoContents.filter((item: any) =>
    item.type === 'dir' || item.is_skill
  );

  const handleInstall = async () => {
    if (!selected || !selectedWorkspace) return;

    // Conteúdo: prioriza raw_content (SkillsMP) ou preview (GitHub)
    const content = selected.raw_content || preview?.content;
    if (!content) return;

    // Extrai o nome da skill do path
    let skillName = selected.name;
    if (selectedSkillPath) {
      const parts = selectedSkillPath.split('/').filter(p => p !== 'SKILL.md');
      skillName = parts.pop() || selected.name;
    }

    await installSkill.mutateAsync({
      workspace_path: selectedWorkspace,
      skill_name: skillName.toLowerCase().replace(/\s+/g, '-'),
      skill_content: content,
      type,
    });
    setInstallSuccess(true);
    setTimeout(() => setInstallSuccess(false), 3000);
  };

  const handleSelectRepo = (item: any) => {
    setSelected(item);
    setSelectedSkillPath('');
    setInstallSuccess(false);
  };

  const handleSelectSkill = (item: any) => {
    if (item.is_skill) {
      setSelectedSkillPath(item.path);
    } else {
      setSelectedSkillPath(`${item.path}/SKILL.md`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t('pages.marketplace.title')}
        description={t('pages.marketplace.description')}
      />

      {/* Tabs + Search */}
      <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${borderColors.default} ${darkModeBorderColors.default} flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`}>
        <div className={`flex gap-1 ${bgColors.tertiary} ${darkModeBgColors.tertiary} rounded-lg p-1 self-start sm:self-auto`}>
          {(['skill', 'agent'] as const).map(tabType => (
            <button
              key={tabType}
              onClick={() => {
                setType(tabType);
                setPage(1);
                setSelected(null);
                setSelectedSkillPath('');
              }}
              className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                type === tabType
                  ? `${bgColors.secondary} ${darkModeBgColors.tertiary} ${textColors.primary} ${darkModeTextColors.primary} shadow-sm`
                  : `${textColors.tertiary} ${darkModeTextColors.tertiary} ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')}`
              }`}
            >
              {tabType === 'skill' ? t('pages.marketplace.skills') : t('pages.marketplace.agents')}
            </button>
          ))}
        </div>
        <div className="flex-1 relative max-w-md w-full">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textColors.muted}`} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('pages.marketplace.searchPlaceholder', { type })}
            className={`w-full pl-9 pr-3 py-1.5 text-sm border ${borderColors.thick} ${darkModeBorderColors.thick} ${bgColors.secondary} ${darkModeBgColors.tertiary} ${textColors.primary} ${darkModeTextColors.primary} rounded-lg focus:outline-none focus:ring-2 ${interactiveStates.focusRing}`}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Results grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {isLoading ? (
            <div className={`text-sm ${textColors.muted} text-center py-12`}>{t('pages.marketplace.searching')}</div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 sm:h-10 sm:w-10" />}
              title={t('pages.marketplace.noResults')}
              description={t('pages.marketplace.noResultsDesc', { type })}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {results.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectRepo(item)}
                    className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${withDarkMode('hover:border-gray-400', 'dark:hover:border-gray-400')} hover:shadow-sm ${
                      selected?.id === item.id
                        ? `${borderColors.thick} ${darkModeBorderColors.thick} ${bgColors.primary} ${darkModeBgColors.tertiary}`
                        : `${borderColors.default} ${darkModeBorderColors.default} ${bgColors.secondary} ${darkModeBgColors.secondary}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {item.source === 'official' && (
                            <span className={`text-xs px-1.5 py-0.5 ${withDarkMode('bg-blue-50 text-blue-700 border border-blue-200', 'dark:bg-blue-950 dark:text-blue-300 dark:border dark:border-blue-900')} rounded font-medium`}>{t('pages.marketplace.official')}</span>
                          )}
                          {item.source === 'skillsmp' && (
                            <span className={`text-xs px-1.5 py-0.5 ${withDarkMode('bg-purple-50 text-purple-700 border border-purple-200', 'dark:bg-purple-950 dark:text-purple-300 dark:border dark:border-purple-900')} rounded font-medium`}>{t('pages.marketplace.skillsmp')}</span>
                          )}
                          <h3 className={`text-xs sm:text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} truncate`}>{item.name}</h3>
                        </div>
                        <p className={`text-xs ${textColors.tertiary} mt-0.5`}>{t('pages.marketplace.by')} {item.author}</p>
                        <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mt-1 line-clamp-2`}>{item.description}</p>
                      </div>
                      {item.stars && (
                        <div className={`flex items-center gap-0.5 text-xs ${textColors.muted} shrink-0`}>
                          <Star className="h-3 w-3" />
                          <span className="hidden sm:inline">{item.stars.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-6 py-3 border-t ${borderColors.default} ${darkModeBorderColors.default} mt-4`}>
                <span className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>{t('pages.marketplace.resultsCount', { count: results.length })}</span>
                <div className="flex gap-2 self-end sm:self-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ←
                  </Button>
                  <span className={`text-xs ${textColors.tertiary} self-center`}>{t('pages.marketplace.page')} {page}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={results.length < 20}
                  >
                    →
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preview panel com 3 estados */}
        {selected && (
          <div className={`w-full sm:w-96 border-t sm:border-t-0 sm:border-l ${borderColors.default} ${darkModeBorderColors.default} flex flex-col ${bgColors.secondary} ${darkModeBgColors.secondary} absolute sm:static inset-0 sm:inset-auto z-10`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b ${borderColors.default} ${darkModeBorderColors.default}`}>
              <h3 className={`text-xs sm:text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} truncate`}>{selected.name}</h3>
              <button
                onClick={() => {
                  setSelected(null);
                  setSelectedSkillPath('');
                }}
                className={`${textColors.muted} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!selectedSkillPath ? (
              // Estado 1: Lista subdiretórios/skills do repo
              <div className="flex-1 overflow-y-auto p-3">
                {selected.source !== 'github' ? (
                  // SkillsMP ou oficial - instala direto
                  <div className="space-y-3">
                    <div className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} space-y-1`}>
                      <p>{t('pages.marketplace.author')}: <span className={`font-medium ${withDarkMode('text-gray-700', 'dark:text-gray-300')}`}>{selected.author}</span></p>
                      {selected.stars && <p>{t('pages.marketplace.stars')}: {selected.stars.toLocaleString()}</p>}
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 ${accentColors.text} hover:underline`}
                      >
                        <ExternalLink className="h-3 w-3" /> {t('pages.marketplace.viewSource')}
                      </a>
                    </div>

                    {selected.raw_content ? (
                      <>
                        <p className={`text-xs font-semibold ${withDarkMode('text-gray-700', 'dark:text-gray-300')} mt-3`}>{t('pages.marketplace.skillMdPreview')}</p>
                        <pre className={`text-xs ${bgColors.primary} ${darkModeCodeBlockColors.bg} ${borderColors.default} ${darkModeBorderColors.default} rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-64`}>
                          {selected.raw_content.slice(0, 1500)}
                          {selected.raw_content.length > 1500 ? '\n...' : ''}
                        </pre>
                      </>
                    ) : (
                      <p className={`text-xs ${textColors.muted}`}>{t('pages.marketplace.noPreview')}</p>
                    )}

                    <div className="space-y-2">
                      <p className={`text-xs font-semibold ${withDarkMode('text-gray-700', 'dark:text-gray-300')}`}>{t('pages.marketplace.installToWorkspace')}</p>
                      <select
                        value={selectedWorkspace}
                        onChange={e => setSelectedWorkspace(e.target.value)}
                        className={`w-full border ${borderColors.thick} ${darkModeBorderColors.thick} ${bgColors.secondary} ${darkModeBgColors.tertiary} ${textColors.primary} ${darkModeTextColors.primary} rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 ${interactiveStates.focusRing}`}
                      >
                        <option value="">{t('pages.marketplace.selectWorkspace')}</option>
                        {workspaces.map((ws: any) => (
                          <option key={ws.id} value={ws.path || ws.workspace_path}>
                            {ws.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : skillFolders.length === 0 ? (
                  // Repo vazio ou sem subdiretórios
                  <div className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>
                    <p>{t('pages.marketplace.noSkillsFound')}</p>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-600 hover:underline"
                    >
                      {t('pages.marketplace.viewOnGithub')}
                    </a>
                  </div>
                ) : (
                  // Lista de subdiretórios com SKILL.md
                  <>
                    <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} mb-2`}>{t('pages.marketplace.selectSkillToPreview')}</p>
                    {skillFolders.map((item: any) => (
                      <button
                        key={item.path}
                        onClick={() => handleSelectSkill(item)}
                        className={`w-full text-left px-3 py-2 text-sm ${bgColors.primary} ${darkModeInteractiveStates.hoverBg} rounded flex items-center gap-2 transition-colors`}
                      >
                        {item.type === 'dir' ? '📁' : '📄'} {item.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : (
              // Estado 2: Preview do SKILL.md selecionado
              <>
                <button
                  onClick={() => setSelectedSkillPath('')}
                  className={`px-4 py-2 text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')} ${withDarkMode('hover:bg-gray-50', 'dark:hover:bg-gray-700')} text-left border-b ${borderColors.default} ${darkModeBorderColors.default} transition-colors`}
                >
                  ← {t('pages.marketplace.backToSkillList')}
                </button>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Metadata */}
                  <div className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} space-y-1`}>
                    <p>{t('pages.marketplace.author')}: <span className={`font-medium ${withDarkMode('text-gray-700', 'dark:text-gray-300')}`}>{selected.author}</span></p>
                    {selected.stars && <p>{t('pages.marketplace.stars')}: {selected.stars.toLocaleString()}</p>}
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-orange-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> {t('pages.marketplace.viewOnGithub')}
                    </a>
                  </div>

                  {/* Preview do SKILL.md */}
                  {preview?.content ? (
                    <div>
                      <p className={`text-xs font-semibold ${withDarkMode('text-gray-700', 'dark:text-gray-300')} mb-1`}>{t('pages.marketplace.skillMdPreview')}</p>
                      <pre className={`text-xs ${bgColors.primary} ${darkModeCodeBlockColors.bg} ${borderColors.default} ${darkModeBorderColors.default} rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-72`}>
                        {preview.content.slice(0, 2000)}
                        {preview.content.length > 2000 ? '\n...' : ''}
                      </pre>
                    </div>
                  ) : (
                    <p className={`text-xs ${textColors.muted}`}>{t('pages.marketplace.loadingPreview')}</p>
                  )}

                  {/* Install */}
                  <div className="space-y-2">
                    <p className={`text-xs font-semibold ${withDarkMode('text-gray-700', 'dark:text-gray-300')}`}>{t('pages.marketplace.installToWorkspace')}</p>
                    <select
                      value={selectedWorkspace}
                      onChange={e => setSelectedWorkspace(e.target.value)}
                      className={`w-full border ${borderColors.thick} ${darkModeBorderColors.thick} ${bgColors.secondary} ${darkModeBgColors.tertiary} ${textColors.primary} ${darkModeTextColors.primary} rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 ${interactiveStates.focusRing}`}
                    >
                      <option value="">{t('pages.marketplace.selectWorkspace')}</option>
                      {workspaces.map((ws: any) => (
                        <option key={ws.id} value={ws.path || ws.workspace_path}>
                          {ws.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Footer com botão de install */}
            {selectedSkillPath || selected.source !== 'github' ? (
              <div className={`px-4 py-3 border-t ${borderColors.default} ${darkModeBorderColors.default} ${bgColors.secondary} ${darkModeBgColors.secondary}`}>
                {installSuccess ? (
                  <p className={`text-xs ${successColors.text} font-medium text-center`}>✓ {t('pages.marketplace.installedSuccessfully')}</p>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={handleInstall}
                    disabled={!selectedWorkspace || !(selected.raw_content || preview?.content)}
                    loading={installSkill.isPending}
                  >
                    <Download className="h-3.5 w-3.5" /> {t('pages.marketplace.install')}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
