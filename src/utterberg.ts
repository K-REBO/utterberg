import { pageAttributes as page } from './page-attributes';
import {
  Issue,
  setRepoContext,
  loadIssueByTerm,
  loadIssueByNumber,
  loadCommentsPage,
  loadUser,
  postComment,
  createIssue,
  PAGE_SIZE,
  IssueComment
} from './codeberg';
import { TimelineComponent } from './timeline-component';
import { NewCommentComponent } from './new-comment-component';
import { startMeasuring, scheduleMeasure } from './measure';
import { loadTheme } from './theme';
import { getRepoConfig } from './repo-config';
import { loadToken, handleOAuthCallback } from './oauth';
import { enableReactions, enableSignInToReact } from './reactions';

const t0 = performance.now();
const log = (msg: string) => console.log(`[utterberg +${Math.round(performance.now() - t0)}ms] ${msg}`);

const oauthCode = new URL(location.href).searchParams.get('code');
if (oauthCode) {
  handleOAuthCallback(oauthCode).catch(console.error);
} else {
  setRepoContext(page);
  bootstrap();
}

// ---- Issue番号キャッシュ ----

const ISSUE_CACHE_KEY = `utterberg-issue:${page.owner}/${page.repo}:${page.issueTerm ?? page.issueNumber}`;

function getCachedIssueNumber(): number | null {
  const v = localStorage.getItem(ISSUE_CACHE_KEY);
  return v ? parseInt(v, 10) : null;
}

function loadIssue(): Promise<Issue | null> {
  if (page.issueNumber !== null) return loadIssueByNumber(page.issueNumber);
  const cached = getCachedIssueNumber();
  if (cached !== null) {
    log(`issue cache hit: #${cached}`);
    return loadIssueByNumber(cached);
  }
  return loadIssueByTerm(page.issueTerm as string).then(issue => {
    if (issue) localStorage.setItem(ISSUE_CACHE_KEY, String(issue.number));
    return issue;
  });
}

// ---- コメントキャッシュ ----

const commentsCacheKey = (num: number) =>
  `utterberg-comments:${page.owner}/${page.repo}:${num}`;

function loadCachedComments(issueNum: number): IssueComment[] | null {
  try {
    const raw = localStorage.getItem(commentsCacheKey(issueNum));
    if (!raw) return null;
    return JSON.parse(raw) as IssueComment[];
  } catch {
    return null;
  }
}

function saveCommentsCache(issueNum: number, comments: IssueComment[]) {
  try {
    localStorage.setItem(commentsCacheKey(issueNum), JSON.stringify(comments));
  } catch {
    // localStorage quota exceeded
  }
}

// ---- Bootstrap ----

async function bootstrap() {
  log('bootstrap start');

  // Storage Partitioning対策: client.ts経由でURLパラメータに渡されたトークンを保存
  if (page.utterbergToken) {
    localStorage.setItem('utterberg-token', page.utterbergToken);
    log('token from URL param (post-OAuth handoff)');
    // iframeURLからトークンパラメータを除去
    const u = new URL(location.href);
    u.searchParams.delete('utterberg-token');
    history.replaceState(null, '', u.href);
  }

  await loadToken();
  log('token loaded');

  loadTheme(page.theme, page.origin);
  startMeasuring(page.origin);

  const timeline = new TimelineComponent(null, null);
  document.body.appendChild(timeline.element);

  // キャッシュからコメントを即時表示
  const cachedNum = page.issueNumber ?? getCachedIssueNumber();
  const cachedComments = cachedNum !== null ? loadCachedComments(cachedNum) : null;
  if (cachedComments && cachedComments.length > 0) {
    log(`cache: ${cachedComments.length} comments (instant)`);
    for (const c of cachedComments) timeline.insertComment(c, false);
    scheduleMeasure();
  }

  // issue / user / page1コメントを並列フェッチ
  const earlyCommentsP = cachedNum !== null
    ? loadCommentsPage(cachedNum, 1).catch(() => null as IssueComment[] | null)
    : Promise.resolve(null as IssueComment[] | null);

  log('API calls fired');
  let [issue, user, freshComments] = await Promise.all([loadIssue(), loadUser(), earlyCommentsP]);
  log(`issue=${issue?.number ?? 'null'} user=${user?.login ?? 'null'} fresh=${freshComments?.length ?? 0}`);

  timeline.setUser(user);
  timeline.setIssue(issue);

  if (issue && freshComments) {
    // 新着コメントをキャッシュと差分比較して追加
    const cachedIds = new Set((cachedComments ?? []).map(c => c.id));
    const newOnes = freshComments.filter(c => !cachedIds.has(c.id));
    if (newOnes.length > 0) {
      log(`${newOnes.length} new comment(s)`);
      for (const c of newOnes) timeline.insertComment(c, false);
      scheduleMeasure();
    }
    // キャッシュ更新
    const allCached = [...(cachedComments ?? []), ...newOnes];
    saveCommentsCache(issue.number, allCached);

    // 2ページ目以降があれば読み込む
    if (issue.comments > PAGE_SIZE) {
      fetchRemainingPages(issue, timeline, freshComments);
    }
  } else if (issue && issue.comments > 0 && !freshComments) {
    renderComments(issue, timeline);
  } else if (issue && issue.comments === 0) {
    // コメントなし（初回）はキャッシュも空で正常
    saveCommentsCache(issue.number, []);
  }

  scheduleMeasure();
  if (issue && issue.locked) return;

  enableReactions(!!user);
  enableSignInToReact();

  const submit = async (markdown: string) => {
    await assertOrigin();
    if (!issue) {
      issue = await createIssue(
        page.issueTerm as string,
        page.url,
        page.title,
        page.description || '',
        page.label
      );
      timeline.setIssue(issue);
    }
    const comment = await postComment(issue.number, markdown);
    timeline.insertComment(comment, true);
    // 投稿後にキャッシュ更新
    const updated = loadCachedComments(issue.number) ?? [];
    saveCommentsCache(issue.number, [...updated, comment]);
    newCommentComponent.clear();
  };

  const newCommentComponent = new NewCommentComponent(user, submit);
  timeline.element.appendChild(newCommentComponent.element);
  scheduleMeasure();
  log('bootstrap done');
}

async function fetchRemainingPages(issue: Issue, timeline: TimelineComponent, page1: IssueComment[]) {
  const pageCount = Math.ceil(issue.comments / PAGE_SIZE);
  if (pageCount <= 1) return;

  const loads: Promise<IssueComment[]>[] = [loadCommentsPage(issue.number, pageCount)];
  if (pageCount > 2 && issue.comments % PAGE_SIZE < 3 && issue.comments % PAGE_SIZE !== 0) {
    loads.push(loadCommentsPage(issue.number, pageCount - 1));
  }
  const pages = await Promise.all(loads);
  const existing = new Set([...page1].map(c => c.id));
  for (const p of pages) {
    for (const c of p) {
      if (!existing.has(c.id)) {
        timeline.insertComment(c, false);
        existing.add(c.id);
      }
    }
  }
  scheduleMeasure();
}

async function renderComments(issue: Issue, timeline: TimelineComponent) {
  log(`renderComments: ${issue.comments} comments`);
  const pageCount = Math.ceil(issue.comments / PAGE_SIZE);
  const loads = [loadCommentsPage(issue.number, 1)];
  if (pageCount > 1) loads.push(loadCommentsPage(issue.number, pageCount));
  if (pageCount > 2 && issue.comments % PAGE_SIZE < 3 && issue.comments % PAGE_SIZE !== 0) {
    loads.push(loadCommentsPage(issue.number, pageCount - 1));
  }
  const pages = await Promise.all(loads);
  const all: IssueComment[] = [];
  for (const p of pages) {
    for (const c of p) { timeline.insertComment(c, false); all.push(c); }
  }
  saveCommentsCache(issue.number, all);
  scheduleMeasure();
}

async function assertOrigin() {
  const { origins } = await getRepoConfig();
  const { origin, owner, repo } = page;
  if (origins.indexOf(origin) !== -1) return;

  document.querySelector('.timeline')!.lastElementChild!.insertAdjacentHTML('beforebegin', `
  <div class="flash flash-error flash-not-installed">
    Error: <code>${origin}</code> is not permitted to post to <code>${owner}/${repo}</code>.
    If you own this repo,
    <a href="https://codeberg.org/${owner}/${repo}/_edit/main/utterberg.json" target="_top">
      <strong>update utterberg.json</strong>
    </a>
    to include <code>${origin}</code> in the list of origins.<br/><br/>
    <pre><code>${JSON.stringify({ origins: [origin] }, null, 2)}</code></pre>
  </div>`);
  scheduleMeasure();
  throw new Error('Origin not permitted.');
}
