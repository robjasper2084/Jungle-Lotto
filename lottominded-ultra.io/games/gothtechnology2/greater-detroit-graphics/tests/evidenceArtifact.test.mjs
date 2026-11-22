import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEvidenceArtifact } from '../scripts/resolveEvidenceArtifact.mjs';

const head = 'a'.repeat(40), trustedSha = 'b'.repeat(40);
const options = { head, repoId: 1, defaultBranch: 'main' };
const origin = { id: 13, repository_id: 1, head_repository_id: 1, head_branch: 'main', head_sha: trustedSha };
const artifact = { id: 24, name: 'gds-evidence-' + head, expired: false,
  digest: 'sha256:' + 'c'.repeat(64), workflow_run: origin };
const run = { id: 13, workflow_id: 7, repository: { id: 1 }, head_repository: { id: 1 },
  path: '.github/workflows/gds-device-evidence.yml', head_branch: 'main', head_sha: trustedSha,
  event: 'workflow_dispatch', status: 'completed', conclusion: 'success' };

function api({ pages = [[artifact]], producer = run, ancestor = trustedSha } = {}) {
  return async path => {
    const query = 'actions/artifacts?name=' + artifact.name + '&per_page=100&page=';
    if (path.startsWith(query)) return { artifacts: pages[Number(path.slice(query.length)) - 1] ?? [] };
    if (path === 'actions/runs/13') return producer;
    if (path === 'compare/' + trustedSha + '...main') return { merge_base_commit: { sha: ancestor } };
    throw Error('Unexpected API path: ' + path);
  };
}

test('selects one immutable artifact from the default branch device workflow, including later pages', async () => {
  const pages = [Array(100).fill({ ...artifact, expired: true }), [artifact]];
  assert.deepEqual(await resolveEvidenceArtifact(options, api({ pages })), { artifactId: 24, runId: 13 });
});

test('allows an explicitly configured producer identity', async () => {
  const producer = { ...run, path: '.github/workflows/device-lab.yml' };
  assert.deepEqual(await resolveEvidenceArtifact({ ...options, workflowId: 7 }, api({ producer })), { artifactId: 24, runId: 13 });
  await assert.rejects(resolveEvidenceArtifact({ ...options, workflowId: 9 }, api({ producer })), /No current/);
  await assert.rejects(resolveEvidenceArtifact({ ...options, workflowId: NaN }, api()), /Invalid/);
});

test('rejects absent, stale, unpinned, expired, and fork-produced evidence', async () => {
  const invalid = [{ ...artifact, name: 'gds-evidence-' + trustedSha }, { ...artifact, digest: null },
    { ...artifact, expired: true }, { ...artifact, workflow_run: { ...origin, head_repository_id: 2 } },
    { ...artifact, workflow_run: { ...origin, head_branch: 'topic' } }];
  for (const page of [[], ...invalid.map(a => [a])]) {
    await assert.rejects(resolveEvidenceArtifact(options, api({ pages: [page] })), /No current/);
  }
});

test('rejects PR runs, other workflows, failed runs, and revisions outside the default branch', async () => {
  for (const changed of [{ event: 'pull_request' }, { path: '.github/workflows/gds-real-capture.yml' },
    { conclusion: 'failure' }, { head_branch: 'topic' }, { head_repository: { id: 2 } }, { head_sha: head }]) {
    await assert.rejects(resolveEvidenceArtifact(options, api({ producer: { ...run, ...changed } })), /No current/);
  }
  await assert.rejects(resolveEvidenceArtifact(options, api({ ancestor: head })), /No current/);
});
