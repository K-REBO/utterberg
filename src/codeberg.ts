import { token } from './oauth';
import { decodeBase64UTF8 } from './encoding';
import { marked } from 'marked';

const CODEBERG_API = 'https://codeberg.org/api/v1/';
const BRANCH = 'main';

export const PAGE_SIZE = 25;

export type ReactionID = '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';

export const reactionTypes: ReactionID[] = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];

let owner: string;
let repo: string;

export function setRepoContext(context: { owner: string; repo: string }) {
  owner = context.owner;
  repo = context.repo;
}

function codebergRequest(relativeUrl: string, init?: RequestInit) {
  init = init || {};
  init.mode = 'cors';
  init.cache = 'no-cache';
  const request = new Request(CODEBERG_API + relativeUrl, init);
  request.headers.set('Accept', 'application/json');
  if (init.body) {
    request.headers.set('Content-Type', 'application/json');
  }
  if (token.value !== null) {
    request.headers.set('Authorization', `token ${token.value}`);
  }
  return request;
}

function codebergFetch(request: Request): Promise<Response> {
  return fetch(request).then(response => {
    if (response.status === 401) {
      token.value = null;
      localStorage.removeItem('utterberg-token');
    }
    return response;
  });
}

// Forgejo doesn't expose global issue search; search per-repo with q param.
export function loadIssueByTerm(term: string): Promise<Issue | null> {
  const url = `repos/${owner}/${repo}/issues?type=issues&state=open&q=${encodeURIComponent(term)}&limit=50`;
  return codebergFetch(codebergRequest(url))
    .then<ForgejoIssue[]>(response => {
      if (!response.ok) {
        throw new Error('Error fetching issues via search.');
      }
      return response.json();
    })
    .then(issues => {
      if (issues.length === 0) return null;
      const termLower = term.toLowerCase();
      const exact = issues.find(i => i.title.toLowerCase() === termLower);
      if (exact) return adaptIssue(exact);
      const contains = issues.find(i => i.title.toLowerCase().includes(termLower));
      if (contains) return adaptIssue(contains);
      return adaptIssue(issues[0]);
    });
}

export function loadIssueByNumber(issueNumber: number): Promise<Issue> {
  return codebergFetch(codebergRequest(`repos/${owner}/${repo}/issues/${issueNumber}`))
    .then<ForgejoIssue>(response => {
      if (!response.ok) throw new Error('Error fetching issue via issue number.');
      return response.json();
    })
    .then(adaptIssue);
}

export function loadCommentsPage(issueNumber: number, page: number): Promise<IssueComment[]> {
  const url = `repos/${owner}/${repo}/issues/${issueNumber}/comments?page=${page}&limit=${PAGE_SIZE}`;
  return codebergFetch(codebergRequest(url))
    .then<ForgejoComment[]>(response => {
      if (!response.ok) throw new Error('Error fetching comments.');
      return response.json();
    })
    .then(comments => comments.map(adaptComment));
}

export function loadUser(): Promise<User | null> {
  if (token.value === null) return Promise.resolve(null);
  return codebergFetch(codebergRequest('user')).then(response => {
    if (response.ok) return response.json().then(adaptUser);
    return null;
  });
}

export function createIssue(
  issueTerm: string,
  documentUrl: string,
  title: string,
  description: string,
  label: string
): Promise<Issue> {
  const body = JSON.stringify({
    title: issueTerm,
    body: `# ${title}\n\n${description}\n\n[${documentUrl}](${documentUrl})`,
    ...(label ? { labels: [] } : {})
  });
  const request = codebergRequest(`repos/${owner}/${repo}/issues`, { method: 'POST', body });
  return codebergFetch(request).then<ForgejoIssue>(response => {
    if (!response.ok) throw new Error('Error creating comments container issue.');
    return response.json();
  }).then(adaptIssue);
}

export function postComment(issueNumber: number, markdown: string): Promise<IssueComment> {
  const body = JSON.stringify({ body: markdown });
  const request = codebergRequest(`repos/${owner}/${repo}/issues/${issueNumber}/comments`, { method: 'POST', body });
  return codebergFetch(request).then<ForgejoComment>(response => {
    if (!response.ok) throw new Error('Error posting comment.');
    return response.json();
  }).then(adaptComment);
}

export function loadJsonFile<T>(path: string): Promise<T> {
  return codebergFetch(codebergRequest(`repos/${owner}/${repo}/contents/${path}?ref=${BRANCH}`))
    .then<{ content: string }>(response => {
      if (response.status === 404) {
        throw new Error(`File "${path}" not found in ${owner}/${repo}.`);
      }
      if (!response.ok) throw new Error(`Error fetching ${path}.`);
      return response.json();
    })
    .then(file => {
      const decoded = decodeBase64UTF8(file.content);
      return JSON.parse(decoded) as T;
    });
}


export async function toggleReaction(reactionUrl: string, content: ReactionID) {
  // reactionUrl は "/repos/owner/repo/issues/N/reactions" 形式
  const path = reactionUrl.replace(CODEBERG_API, '');
  // 既存のリアクションを取得してトグル
  const getReq = codebergRequest(path);
  const existing: Array<{ user: { login: string }; content: string }> = await codebergFetch(getReq).then(r => r.json());
  const userReaction = existing.find(r => r.content === content && r.user.login === (token.value ? 'me' : ''));

  if (userReaction) {
    const delBody = JSON.stringify({ content });
    const delReq = codebergRequest(path, { method: 'DELETE', body: delBody });
    await codebergFetch(delReq);
    return { deleted: true };
  }
  const postBody = JSON.stringify({ content });
  const postReq = codebergRequest(path, { method: 'POST', body: postBody });
  await codebergFetch(postReq);
  return { deleted: false };
}

// ---- Forgejo API types ----

interface ForgejoUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  email: string;
}

interface ForgejoLabel {
  name: string;
  color: string;
  url: string;
}

interface ForgejoIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  user: ForgejoUser;
  labels: ForgejoLabel[];
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  is_locked: boolean;
}

interface ForgejoComment {
  id: number;
  html_url: string;
  body: string;
  user: ForgejoUser;
  created_at: string;
  updated_at: string;
}

// ---- Adapters ----

function adaptUser(u: ForgejoUser): User {
  return {
    login: u.login,
    id: u.id,
    avatar_url: u.avatar_url,
    gravatar_id: '',
    url: `https://codeberg.org/api/v1/users/${u.login}`,
    html_url: u.html_url,
    followers_url: '',
    following_url: '',
    gists_url: '',
    starred_url: '',
    subscriptions_url: '',
    organizations_url: '',
    repos_url: '',
    events_url: '',
    received_events_url: '',
    type: 'User'
  };
}

function emptyReactions(url: string): Reactions {
  return { url, total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 };
}

function adaptIssue(fi: ForgejoIssue): Issue {
  const reactionUrl = `${CODEBERG_API}repos/${owner}/${repo}/issues/${fi.number}/reactions`;
  return {
    url: `${CODEBERG_API}repos/${owner}/${repo}/issues/${fi.number}`,
    repository_url: `${CODEBERG_API}repos/${owner}/${repo}`,
    labels_url: '',
    comments_url: `${CODEBERG_API}repos/${owner}/${repo}/issues/${fi.number}/comments`,
    events_url: '',
    html_url: fi.html_url,
    id: fi.id,
    number: fi.number,
    title: fi.title,
    user: adaptUser(fi.user),
    locked: fi.is_locked,
    labels: fi.labels.map(l => ({ url: l.url, name: l.name, color: l.color })),
    state: fi.state,
    assignee: null,
    milestone: null,
    comments: fi.comments,
    created_at: fi.created_at,
    updated_at: fi.updated_at,
    closed_at: null,
    pull_request: { html_url: null, diff_url: null, patch_url: null },
    body: fi.body,
    score: 0,
    reactions: emptyReactions(reactionUrl),
    author_association: 'NONE'
  };
}

function adaptComment(fc: ForgejoComment): IssueComment {
  const reactionUrl = `${CODEBERG_API}repos/${owner}/${repo}/issues/comments/${fc.id}/reactions`;
  const body_html = marked.parse(fc.body) as string;
  return {
    id: fc.id,
    url: `${CODEBERG_API}repos/${owner}/${repo}/issues/comments/${fc.id}`,
    html_url: fc.html_url,
    body_html,
    user: adaptUser(fc.user),
    created_at: fc.created_at,
    updated_at: fc.updated_at,
    author_association: 'NONE',
    reactions: emptyReactions(reactionUrl)
  };
}

// ---- Public types (same interface as the original github.ts) ----

export interface User {
  login: string;
  id: number;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
}

export type CommentAuthorAssociation =
  | 'COLLABORATOR'
  | 'CONTRIBUTOR'
  | 'FIRST_TIMER'
  | 'FIRST_TIME_CONTRIBUTOR'
  | 'MEMBER'
  | 'NONE'
  | 'OWNER';

export interface Reactions {
  url: string;
  total_count: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

export interface Reaction {
  id: number;
  user: User;
  content: ReactionID;
  created_at: string;
}

export interface Issue {
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  id: number;
  number: number;
  title: string;
  user: User;
  locked: boolean;
  labels: { url: string; name: string; color: string }[];
  state: string;
  assignee: null;
  milestone: null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: null;
  pull_request: { html_url: null; diff_url: null; patch_url: null };
  body: string;
  score: number;
  reactions: Reactions;
  author_association: CommentAuthorAssociation;
}

export interface IssueComment {
  id: number;
  url: string;
  html_url: string;
  body_html: string;
  user: User;
  created_at: string;
  updated_at: string;
  author_association: CommentAuthorAssociation;
  reactions: Reactions;
}
