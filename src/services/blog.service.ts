import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> { success: boolean; message?: string; data: T; errors?: Record<string, unknown>; }
type Id = string | number;
type Payload = Record<string, unknown>;

async function g<T>(u: string, params?: Payload) { const { data } = await apiClient.get<ApiEnvelope<T>>(u, { params }); return data; }
async function p<T>(u: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(u, payload); return data; }
async function pa<T>(u: string, payload: Payload) { const { data } = await apiClient.patch<ApiEnvelope<T>>(u, payload); return data; }
async function del<T>(u: string) { const { data } = await apiClient.delete<ApiEnvelope<T>>(u); return data; }

function base(ws: Id) { return `/organization/blog/workspaces/${ws}`; }
function keysBase(ws: Id) { return `/organization/apikeys/workspaces/${ws}`; }

export interface BlogAuthorRow { id: number; name: string; slug: string; bio?: string; }
export interface BlogCategoryRow { id: number; name: string; slug: string; description?: string; seo_title?: string; meta_description?: string; post_count?: number; }
export interface BlogTagRow { id: number; name: string; slug: string; }
export interface BlogPostRow {
  id: number; title: string; slug: string; excerpt: string; body: string; cover_image?: string | null;
  author: number | null; category: number | null; tags: number[];
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  published_at: string | null; scheduled_for: string | null; reading_minutes: number;
  seo_title: string; meta_description: string; canonical_url: string; og_title: string; og_description: string;
  twitter_card: string; robots: string; focus_keyword: string; secondary_keywords: string[];
  short_answer: string; faqs: { q: string; a: string }[]; key_entities: string[]; tldr: string[]; aeo_ready: boolean;
  created_at?: string; updated_at?: string;
}
export interface APIKeyRow { id: number; name: string; prefix: string; scopes: string[]; is_active: boolean; last_used_at: string | null; created_at: string | null; revoked_at: string | null; key?: string; }

function crud<T>(res: string) {
  return {
    list: (ws: Id, params?: Payload) => g<T[]>(`${base(ws)}/${res}/`, params),
    create: (ws: Id, payload: Payload) => p<T>(`${base(ws)}/${res}/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<T>(`${base(ws)}/${res}/${id}/`, payload),
    remove: (ws: Id, id: Id) => del<null>(`${base(ws)}/${res}/${id}/`),
  };
}

export const BlogService = {
  posts: crud<BlogPostRow>('posts'),
  categories: crud<BlogCategoryRow>('categories'),
  tags: crud<BlogTagRow>('tags'),
  authors: crud<BlogAuthorRow>('authors'),
  apiKeys: {
    list: (ws: Id) => g<{ keys: APIKeyRow[]; available_scopes: string[] }>(`${keysBase(ws)}/`),
    create: (ws: Id, name: string, scopes: string[]) => p<APIKeyRow>(`${keysBase(ws)}/`, { name, scopes }),
    revoke: (ws: Id, id: Id) => p<APIKeyRow>(`${keysBase(ws)}/${id}/revoke/`, {}),
  },
};
