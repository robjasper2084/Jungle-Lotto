/** Diagnostic-only. Never suppress raw transport events or actual delivery errors. */
export function classifyDeliverySignals(errors,transfers,integrity,requestCounts={}){
 const explained=[],unexplained=[];
 for(const error of errors){
  const match=/^Network (http:\/\/127\.0\.0\.1:\d+\/\S+) net::ERR_ABORTED$/.exec(error);
  if(!match){unexplained.push(error);continue;}
  const url=match[1];if(requestCounts[url]!==1||errors.filter(x=>x===error).length!==1){unexplained.push(error);continue;}const reads=transfers.filter(v=>v.url===url),proofs=integrity.filter(v=>v.url===url);
  if(!/\.glb$/i.test(new URL(url).pathname)||reads.length!==1||proofs.length!==1){unexplained.push(error);continue;}
  const read=reads[0],proof=proofs[0],hash=/^[a-f0-9]{64}$/;
  const complete=read.status===200&&read.complete===true&&read.readError===null&&Number.isSafeInteger(read.bytes)&&read.bytes>0&&read.bytes===read.expectedBytes&&read.bytes===proof.expectedBytes&&read.bytes===proof.observedBytes&&hash.test(read.sha256)&&read.sha256===proof.expectedSha256&&read.sha256===proof.observedSha256&&proof.complete===true&&proof.match===true;
  if(!complete){unexplained.push(error);continue;}
  explained.push({event:error,url,classification:'abort-signal-with-verified-complete-body',bytes:read.bytes,sha256:read.sha256,evidence:'Unique actual loader response consumed to EOF; status, content length, byte count and SHA-256 match the served source file. Raw event retained. Browser lifecycle cause is not established.'});
 }
 return {explained,unexplained};
}
