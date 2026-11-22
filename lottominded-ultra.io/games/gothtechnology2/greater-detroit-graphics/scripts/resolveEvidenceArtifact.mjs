import { appendFile } from 'node:fs/promises';

const id = value => Number.isSafeInteger(value) && value > 0;
const commit = value => /^[a-f0-9]{40}$/.test(value);

export async function resolveEvidenceArtifact({ head, workflowId, repoId, defaultBranch }, get) {
  if (!commit(head) || !id(repoId) || !defaultBranch) throw Error('Missing candidate or repository identity');
  if (workflowId !== undefined && !id(workflowId)) throw Error('Invalid GDS_EVIDENCE_WORKFLOW_ID');

  const name = 'gds-evidence-' + head;
  for (let page = 1; ; page++) {
    const { artifacts } = await get('actions/artifacts?name=' + name + '&per_page=100&page=' + page);
    for (const artifact of artifacts) {
      const origin = artifact.workflow_run;
      if (artifact.name !== name || artifact.expired !== false || !id(artifact.id) ||
          !/^sha256:[a-f0-9]{64}$/.test(artifact.digest) || !id(origin?.id) ||
          origin.repository_id !== repoId || origin.head_repository_id !== repoId ||
          origin.head_branch !== defaultBranch || !commit(origin.head_sha)) continue;

      const run = await get('actions/runs/' + origin.id);
      const trustedWorkflow = workflowId === undefined
        ? run.path === '.github/workflows/gds-device-evidence.yml'
        : run.workflow_id === workflowId;
      if (trustedWorkflow && run.id === origin.id &&
          run.repository?.id === repoId && run.head_repository?.id === repoId &&
          run.event === 'workflow_dispatch' && run.head_branch === defaultBranch &&
          run.head_sha === origin.head_sha && run.status === 'completed' && run.conclusion === 'success') {
        const comparison = await get('compare/' + run.head_sha + '...' + encodeURIComponent(defaultBranch));
        if (comparison.merge_base_commit?.sha === run.head_sha) return { artifactId: artifact.id, runId: run.id };
      }
    }
    if (artifacts.length < 100) break;
  }
  throw Error('No current ' + name + ' from a successful trusted device evidence run');
}

if (import.meta.main) {
  const env = process.env;
  const get = async path => {
    const response = await fetch('https://api.github.com/repos/' + env.GITHUB_REPOSITORY + '/' + path, {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        'X-GitHub-Api-Version': '2022-11-28' }, redirect: 'error'
    });
    if (!response.ok) throw Error('GitHub evidence lookup failed (HTTP ' + response.status + ')');
    return response.json();
  };
  const result = await resolveEvidenceArtifact({
    head: env.GDS_CANDIDATE_SHA, workflowId: env.GDS_EVIDENCE_WORKFLOW_ID ? Number(env.GDS_EVIDENCE_WORKFLOW_ID) : undefined,
    repoId: Number(env.GITHUB_REPOSITORY_ID), defaultBranch: env.GDS_DEFAULT_BRANCH
  }, get);
  await appendFile(env.GITHUB_OUTPUT, 'artifact-id=' + result.artifactId + '\nrun-id=' + result.runId + '\n');
}
