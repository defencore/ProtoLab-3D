import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** A failed or cancelled push must never become the incremental-test baseline. */
export async function findSuccessfulBase({
  repository,
  branch,
  currentRunId,
  token,
  apiUrl = 'https://api.github.com',
  fetchImpl = fetch,
  isAncestor,
}) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository ?? '') || !branch || !token)
    throw new Error('Repository, branch and GitHub token are required for the verified baseline.');
  for (let page = 1; page <= 10; page++) {
    const url = new URL(
      `${apiUrl}/repos/${repository}/actions/workflows/pages.yml/runs`,
    );
    for (const [key, value] of Object.entries({
      branch, event: 'push', status: 'success', per_page: '100', page: String(page),
    })) url.searchParams.set(key, value);
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(`Cannot read successful workflow runs (HTTP ${response.status}).`);
    const body = await response.json();
    if (!Array.isArray(body.workflow_runs)) throw new Error('Invalid workflow-run response.');
    for (const run of body.workflow_runs) {
      if (
        String(run.id) === String(currentRunId) || run.event !== 'push' ||
        run.conclusion !== 'success' || run.head_branch !== branch ||
        !/^[a-f0-9]{40}$/.test(run.head_sha ?? '')
      ) continue;
      if (await isAncestor(run.head_sha)) return run.head_sha;
    }
    if (body.workflow_runs.length < 100) return undefined;
  }
  return undefined;
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/ci/successful-base.mjs');
  const head = process.env.GITHUB_SHA;
  if (!head || !process.env.GITHUB_OUTPUT) throw new Error('GitHub SHA and output are required.');
  const base = await findSuccessfulBase({
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.BASE_BRANCH,
    currentRunId: process.env.GITHUB_RUN_ID,
    token: process.env.GITHUB_TOKEN,
    apiUrl: process.env.GITHUB_API_URL,
    isAncestor: async (sha) => {
      try {
        await execute('git', ['merge-base', '--is-ancestor', sha, head]);
        return true;
      } catch (error) {
        if (typeof error.code === 'number') return false;
        throw error;
      }
    },
  });
  await appendFile(process.env.GITHUB_OUTPUT, `base=${base ?? ''}\n`);
  process.stdout.write(base
    ? `Compare with successful push ${base}.\n`
    : 'No successful ancestor is available; require the complete test suite.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
