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

// OAuthコールバック処理: URLに ?code= がある場合はトークン交換して元のページへ戻る
const oauthCode = new URL(location.href).searchParams.get('code');
if (oauthCode) {
  handleOAuthCallback(oauthCode).catch(console.error);
} else {
  setRepoContext(page);
  bootstrap();
}

function loadIssue(): Promise<Issue | null> {
  if (page.issueNumber !== null) {
    return loadIssueByNumber(page.issueNumber);
  }
  return loadIssueByTerm(page.issueTerm as string);
}

async function bootstrap() {
  await loadToken();
  // tslint:disable-next-line:prefer-const
  let [issue, user] = await Promise.all([
    loadIssue(),
    loadUser(),
    loadTheme(page.theme, page.origin)
  ]);

  startMeasuring(page.origin);

  const timeline = new TimelineComponent(user, issue);
  document.body.appendChild(timeline.element);

  if (issue && issue.comments > 0) {
    renderComments(issue, timeline);
  }

  scheduleMeasure();

  if (issue && issue.locked) {
    return;
  }

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
    newCommentComponent.clear();
  };

  const newCommentComponent = new NewCommentComponent(user, submit);
  timeline.element.appendChild(newCommentComponent.element);
}

async function renderComments(issue: Issue, timeline: TimelineComponent) {
  const renderPage = (comments: IssueComment[]) => {
    for (const comment of comments) {
      timeline.insertComment(comment, false);
    }
  };

  const pageCount = Math.ceil(issue.comments / PAGE_SIZE);
  const pageLoads = [loadCommentsPage(issue.number, 1)];
  if (pageCount > 1) {
    pageLoads.push(loadCommentsPage(issue.number, pageCount));
  }
  if (pageCount > 2 && issue.comments % PAGE_SIZE < 3 && issue.comments % PAGE_SIZE !== 0) {
    pageLoads.push(loadCommentsPage(issue.number, pageCount - 1));
  }
  const pages = await Promise.all(pageLoads);
  for (const p of pages) {
    renderPage(p);
  }
  let hiddenPageCount = pageCount - pageLoads.length;
  let nextHiddenPage = 2;
  const renderLoader = (afterPage: IssueComment[]) => {
    if (hiddenPageCount === 0) return;
    const load = async () => {
      loader.setBusy();
      const p = await loadCommentsPage(issue.number, nextHiddenPage);
      loader.remove();
      renderPage(p);
      hiddenPageCount--;
      nextHiddenPage++;
      renderLoader(p);
    };
    const afterComment = afterPage.pop()!;
    const loader = timeline.insertPageLoader(afterComment, hiddenPageCount * PAGE_SIZE, load);
  };
  renderLoader(pages[0]);
}

async function assertOrigin() {
  const { origins } = await getRepoConfig();
  const { origin, owner, repo } = page;
  if (origins.indexOf(origin) !== -1) return;

  document.querySelector('.timeline')!.lastElementChild!.insertAdjacentHTML('beforebegin', `
  <div class="flash flash-error flash-not-installed">
    Error: <code>${origin}</code> is not permitted to post to <code>${owner}/${repo}</code>.
    Confirm this is the correct repo for this site's comments. If you own this repo,
    <a href="https://codeberg.org/${owner}/${repo}/_edit/main/utterberg.json" target="_top">
      <strong>update utterberg.json</strong>
    </a>
    to include <code>${origin}</code> in the list of origins.<br/><br/>
    Suggested configuration:<br/>
    <pre><code>${JSON.stringify({ origins: [origin] }, null, 2)}</code></pre>
  </div>`);
  scheduleMeasure();
  throw new Error('Origin not permitted.');
}
