import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  stars: number | null;
  url: string;
  clone_url: string;
  source: 'official' | 'community' | 'github';
  type: 'skill' | 'agent';
  updated_at: string | null;
}

export interface RepoContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
  is_skill: boolean;
}

export function useMarketplaceSearch(q: string, type: string, page: number = 1) {
  return useQuery({
    queryKey: ['marketplace', 'search', q, type, page],
    queryFn: () => apiClient.get<MarketplaceItem[]>(
      `/api/marketplace/search?q=${encodeURIComponent(q)}&type=${type}&page=${page}`
    ),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
}

export function useRepoContents(repo: string, path: string) {
  return useQuery({
    queryKey: ['marketplace', 'repo', repo, path],
    queryFn: () => apiClient.get<RepoContentItem[]>(
      `/api/marketplace/repo-contents?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`
    ),
    enabled: !!repo,
  });
}

export function useSkillPreview(repo: string, path: string) {
  return useQuery({
    queryKey: ['marketplace', 'preview', repo, path],
    queryFn: () => apiClient.get<{ content: string; path: string }>(
      `/api/marketplace/preview?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`
    ),
    enabled: !!repo && !!path,
  });
}

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspace_path: string;
      skill_name: string;
      skill_content: string;
      type?: string;
    }) => apiClient.post('/api/marketplace/install', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
