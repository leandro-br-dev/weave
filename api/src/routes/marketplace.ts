import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'

const router = Router()

interface MarketplaceItem {
  id: string
  name: string
  description: string
  author: string
  stars: number | null
  url: string
  clone_url: string
  source: 'github' | 'official' | 'community' | 'skillsmp'
  type: 'skill' | 'agent'
  updated_at: string | null
  raw_content?: string
}

interface RepoContentItem {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  download_url: string | null
  is_skill: boolean
}

// Função auxiliar para buscar skills do skillsmp.com
async function fetchSkillsMP(q: string, page: number): Promise<any[]> {
  try {
    // Abordagem 1: API REST se disponível
    const response = await fetch(
      `https://skillsmp.com/api/skills?q=${encodeURIComponent(q)}&limit=50&offset=${(page-1)*50}`,
      {
        headers: {
          'User-Agent': 'weave/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (response.ok && response.headers.get('content-type')?.includes('json')) {
      const data = await response.json() as any;
      const items = data.skills || data.results || data.data || (Array.isArray(data) ? data : []);
      return items.map((s: any) => ({
        id: `skillsmp:${s.id || s.slug || s.name}`,
        name: s.name || s.title,
        description: s.description || s.summary || '',
        author: s.author || s.creator || 'community',
        stars: s.downloads || s.installs || null,
        url: `https://skillsmp.com/skills/${s.slug || s.id}`,
        clone_url: '',
        source: 'skillsmp' as const,
        type: 'skill' as const,
        updated_at: s.updated_at || null,
        raw_content: s.content || s.skill_content || null,
      }));
    }
  } catch (err) {
    console.warn('[marketplace] skillsmp.com search failed:', err);
  }
  return [];
}

// GET /api/marketplace/search?q=frontend&type=skill|agent&source=official|community&page=1
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q = '', type = 'skill', source = 'all', page = '1' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page) || 1)

    const results: MarketplaceItem[] = []

    // Source 1: Repositórios GitHub com topics mais abrangentes
    const topics = type === 'agent'
      ? ['claude-code-subagents', 'claude-agent', 'ai-agent']
      : ['skillsmp', 'claude-skills', 'claude-code-skills', 'agent-skills'];

    for (const topic of topics.slice(0, 2)) {  // 2 topics para não estourar rate limit
      const searchQ = q ? `${q}+topic:${topic}` : `topic:${topic}+language:markdown`;
      try {
        const ghResponse = await fetch(
          `https://api.github.com/search/repositories?q=${searchQ}&sort=stars&per_page=20&page=${pageNum}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'weave'
            },
            signal: AbortSignal.timeout(5000)
          }
        );

        if (ghResponse.ok) {
          const ghData = await ghResponse.json() as any;
          for (const repo of (ghData.items || [])) {
            results.push({
              id: `gh:${repo.full_name}`,
              name: repo.name,
              description: repo.description || '',
              author: repo.owner.login,
              stars: repo.stargazers_count,
              url: repo.html_url,
              clone_url: repo.clone_url,
              source: 'github',
              type: type as 'agent' | 'skill',
              updated_at: repo.updated_at,
            });
          }
        }
      } catch (githubError) {
        console.warn('[marketplace] GitHub search failed for topic', topic, githubError);
      }
    }

    // Source 2: skillsmp.com
    const skillsmpResults = await fetchSkillsMP(q || 'claude', parseInt(page));
    results.push(...skillsmpResults);

    // Source 3: Repos curados conhecidos (fallback sempre presente)
    const curated: MarketplaceItem[] = [
      {
        id: 'curated:anthropics/skills',
        name: 'Official Anthropic Skills',
        description: 'Official skills published by Anthropic — docx, pdf, pptx, xlsx, code-review, and more',
        author: 'anthropics',
        stars: null,
        url: 'https://github.com/anthropics/skills',
        clone_url: 'https://github.com/anthropics/skills.git',
        source: 'official',
        type: 'skill',
        updated_at: null,
      },
      {
        id: 'curated:VoltAgent/awesome-agent-skills',
        name: 'Awesome Agent Skills',
        description: '1234+ production skills from Anthropic, Google, Vercel, Stripe, Cloudflare and community',
        author: 'VoltAgent',
        stars: null,
        url: 'https://github.com/VoltAgent/awesome-agent-skills',
        clone_url: 'https://github.com/VoltAgent/awesome-agent-skills.git',
        source: 'community',
        type: 'skill',
        updated_at: null,
      },
      {
        id: 'curated:alirezarezvani/claude-skills',
        name: 'Claude Skills Collection',
        description: '180+ production-ready skills — engineering, frontend, backend, DevOps, marketing, product',
        author: 'alirezarezvani',
        stars: null,
        url: 'https://github.com/alirezarezvani/claude-skills',
        clone_url: 'https://github.com/alirezarezvani/claude-skills.git',
        source: 'community',
        type: 'skill',
        updated_at: null,
      },
    ]

    // Add curated results when appropriate
    if (!q || source === 'all' || source === 'official') {
      const filteredCurated = curated.filter(c => {
        const matchesQuery = !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
                            c.description.toLowerCase().includes(q.toLowerCase())
        const matchesType = type === 'all' || c.type === type
        const matchesSource = source === 'all' || c.source === source
        return matchesQuery && matchesType && matchesSource
      })
      results.unshift(...filteredCurated)
    }

    // Deduplica por id
    const seen = new Set<string>();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return res.json({ data: unique, error: null })
  } catch (err: any) {
    console.error('[marketplace] Search error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/marketplace/repo-contents?repo=owner/name&path=
// Lista o conteúdo de um repositório para navegar e selecionar skills
router.get('/repo-contents', authenticateToken, async (req, res) => {
  try {
    const { repo, path: filePath = '' } = req.query as Record<string, string>
    if (!repo) {
      return res.status(400).json({ error: 'repo is required' })
    }

    // Tenta branch main, depois master
    let contents: any[] = []
    for (const branch of ['main', 'master']) {
      const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'weave'
          },
          signal: AbortSignal.timeout(8000)
        })

        if (response.ok) {
          const data = await response.json()
          contents = Array.isArray(data) ? data : [data]
          break
        }
      } catch (err) {
        console.warn(`[marketplace] Failed to fetch ${branch} branch:`, err)
        continue
      }
    }

    if (contents.length === 0) {
      return res.status(404).json({ error: 'Repository not found or empty' })
    }

    // Filtra apenas pastas e arquivos SKILL.md
    const items: RepoContentItem[] = contents.map((item: any) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size || 0,
      download_url: item.download_url || null,
      is_skill: item.name.toLowerCase() === 'skill.md',
    }))

    return res.json({ data: items, error: null })
  } catch (err: any) {
    console.error('[marketplace] Repo contents error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/marketplace/preview?repo=owner/name&path=folder/SKILL.md
// Retorna o conteúdo de um SKILL.md para preview
router.get('/preview', authenticateToken, async (req, res) => {
  try {
    const { repo, path: filePath } = req.query as Record<string, string>
    if (!repo || !filePath) {
      return res.status(400).json({ error: 'repo and path are required' })
    }

    // Tenta main, master, e HEAD branches
    for (const branch of ['main', 'master', 'HEAD']) {
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`,
          {
            headers: { 'User-Agent': 'weave' },
            signal: AbortSignal.timeout(8000)
          }
        )

        if (response.ok) {
          const content = await response.text()
          return res.json({ data: { content, path: filePath, branch }, error: null })
        }
      } catch (err) {
        console.warn(`[marketplace] Failed to fetch ${branch} branch:`, err)
        continue
      }
    }

    return res.status(404).json({ error: 'File not found in main or master branch' })
  } catch (err: any) {
    console.error('[marketplace] Preview error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/marketplace/install
// Instala uma skill em um workspace do projeto
// Body: { workspace_path, skill_name, skill_content, type: 'skill'|'agent' }
router.post('/install', authenticateToken, async (req, res) => {
  try {
    const { workspace_path, skill_name, skill_content, type = 'skill' } = req.body
    if (!workspace_path || !skill_name || !skill_content) {
      return res.status(400).json({
        error: 'workspace_path, skill_name, and skill_content are required'
      })
    }

    // Valida que o workspace_path existe
    if (!fs.existsSync(workspace_path)) {
      return res.status(400).json({ error: 'workspace_path does not exist' })
    }

    // Destino: workspace_path/.claude/skills/<skill_name>/SKILL.md
    const skillDir = path.join(workspace_path, '.claude', 'skills', skill_name)
    fs.mkdirSync(skillDir, { recursive: true })

    const skillFile = path.join(skillDir, 'SKILL.md')
    fs.writeFileSync(skillFile, skill_content, 'utf-8')

    return res.json({
      data: {
        installed: true,
        path: skillFile,
        skill_name,
        workspace_path,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('[marketplace] Install error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/marketplace/models — listar modelos disponíveis
router.get('/models', authenticateToken, (_req, res) => {
  return res.json({
    data: [
      {
        id: 'default',
        label: 'Default',
        description: 'Uses the default Claude model'
      },
      {
        id: 'claude-opus-4-6',
        label: 'Claude Opus 4.6',
        description: 'Most capable — recommended for planners'
      },
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        description: 'Balanced — recommended for coders and reviewers'
      },
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fast and efficient — good for simple tasks'
      },
    ],
    error: null,
  })
})

export default router
