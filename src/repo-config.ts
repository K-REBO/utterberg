import { loadJsonFile } from './codeberg';
import { pageAttributes } from './page-attributes';

export interface RepoConfig {
  origins: string[];
}

let promise: Promise<RepoConfig>;

export function getRepoConfig() {
  if (!promise) {
    promise = loadJsonFile<RepoConfig>('utterberg.json').then(
      data => {
        if (!Array.isArray(data.origins)) {
          data.origins = [];
        }
        return data;
      },
      () => ({ origins: [pageAttributes.origin] })
    );
  }
  return promise;
}
