/** Shared, fail-closed release decisions. No credentials or inferred publication. */
export const REPOSITORY = 'robjasper2084/Jungle-Lotto';
export const GAME_PATH = 'lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/';
export function requireTarget(sha, runId) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw Error('Enter the exact 40-character lowercase commit SHA.');
  if (!/^[1-9][0-9]*$/.test(String(runId)) || !Number.isSafeInteger(Number(runId))) throw Error('Enter a valid production workflow run ID.');
}
export function assertDeployment(run, jobs, sha, runId) {
  requireTarget(sha, runId);
  if (String(run?.id) !== String(runId) || run.head_sha !== sha || run.head_branch !== 'main' || run.event !== 'push' || run.name !== 'Deploy GitHub Pages' || run.repository?.full_name !== REPOSITORY || run.head_repository?.full_name !== REPOSITORY) throw Error('Run identity is not the requested main-push production commit.');
  if (run.status !== 'completed' || run.conclusion !== 'success') throw Error('Production workflow is not completed successfully: '+(run.conclusion || run.status));
  if (!Array.isArray(jobs)) throw Error('Missing actual job evidence.');
  const required = ['build','deploy'].map(name => {
    const matches=jobs.filter(job => job.name===name);
    if(matches.length!==1) throw Error('Missing or ambiguous '+name+' job.');
    const job=matches[0];
    if(job.status!=='completed'||job.conclusion!=='success') throw Error(name+' job did not succeed: '+(job.conclusion||job.status));
    if(!Array.isArray(job.steps)||job.steps.some(step=>['failure','cancelled','timed_out','action_required'].includes(step.conclusion))) throw Error('Invalid or failed steps in '+name+' job.');
    return job;
  });
  const actual=required[1].steps.find(step=>step.name==='Deploy to GitHub Pages');
  if(actual?.status!=='completed'||actual.conclusion!=='success') throw Error('Actual Deploy to GitHub Pages step did not succeed.');
  return {commit:sha,runId:Number(runId),jobs:required.map(j=>({name:j.name,id:j.id,status:j.status,conclusion:j.conclusion,steps:j.steps})),deployStep:actual.name};
}
export function assertManifest(manifest, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha) || manifest?.commit!==sha || manifest?.belleGame?.commit!==sha || manifest.belleGame.version!==1 || manifest.belleGame.entry!==GAME_PATH+'index.html' || !Array.isArray(manifest.belleGame.files) || manifest.belleGame.files.length<2) throw Error('Public manifest does not identify the exact target and emitted Belle Isle game.');
  return {commit:sha,entry:manifest.belleGame.entry};
}
/** Only these three independently established facts may produce liveVerified. */
export function liveVerified({deployment,publicBytes,browser}, sha) {
  return /^[0-9a-f]{40}$/.test(sha) && deployment?.commit===sha && deployment?.passed===true && publicBytes?.commit===sha && publicBytes?.passed===true && browser?.commit===sha && browser?.passed===true;
}
