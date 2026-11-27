"""Read-only artifact provenance and shape audit; never changes capture evidence."""
import collections
import datetime
import hashlib
import json
import pathlib
import statistics
import sys
import urllib.parse
import re
import zipfile

try:
    assert len(sys.argv) == 4, 'Usage: audit-capture.py archive.zip output-directory fixed.json'
    archive = pathlib.Path(sys.argv[1]).resolve()
    output_directory = pathlib.Path(sys.argv[2]).resolve()
    fixed_path = pathlib.Path(sys.argv[3]).resolve()
    fixed = json.loads(fixed_path.read_text())
    publication = fixed['publication']
    observer_pin = fixed['observer']
    capture_pin = fixed['capture']
    case = 'cadillac'
    output_directory.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(archive)
    infos = z.infolist()
    assert len(infos) <= 4096, 'Unexpected archive entry count'
    names = [item.filename for item in infos]
    assert len(names) == len(set(names)), 'Duplicate archive member names'
    assert all(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
               and chr(92) not in name for name in names), 'Unsafe archive member name'
    results = [name for name in names if name == 'result.json' or name.endswith('/result.json')]
    assert len(results) == 1, 'Exactly one diagnostic result is required'
    member_prefix = results[0][:-len('result.json')]
    allowed = {
        'result.json', 'invocation.json', 'diagnostic-status.json', 'observer-process-exit.json',
        'payload-manifest.json', 'built-files.json', 'source-prepare.json', 'source-built.json',
        'source-run.json', 'source-after-run.json', 'original-driver.mjs', 'loaded-bundles.json',
        'asset-events.ndjson', 'parsed-scripts.ndjson', 'diagnostic-events.ndjson', 'native.cpuprofile',
        'original-driver-output/report.json', 'trace-category-request.json', 'trace-categories.json',
        'trace-categories-response.json', 'observer-cleanup-terminal.json'
    }
    selected_member_receipts = []
    selected_total_bytes = 0
    class ZipMember:
        def __init__(self, name):
            assert isinstance(name, str) and (name in allowed or
                re.fullmatch(r'observer-[A-Za-z0-9_-]+\.json', name) or
                re.fullmatch(r'bundles/[0-9a-f]{64}\.js', name)), 'Unexpected small member: ' + str(name)
            self.name = member_prefix + name
        def exists(self):
            return self.name in names
        def read_bytes(self):
            global selected_total_bytes
            info = z.getinfo(self.name)
            assert not info.is_dir() and 0 <= info.file_size <= 64 * 1024 * 1024, 'Small-member size bound'
            assert selected_total_bytes + info.file_size <= 256 * 1024 * 1024, 'Cumulative small-member read bound'
            data = z.read(info)
            assert len(data) == info.file_size, 'Small-member byte count mismatch'
            selected_total_bytes += len(data)
            selected_member_receipts.append({'member': self.name, 'bytes': len(data),
                'sha256': hashlib.sha256(data).hexdigest(), 'crcVerifiedByZipReader': True})
            return data
        def read_text(self):
            return self.read_bytes().decode('utf-8')
    class ZipRoot:
        def __truediv__(self, name):
            return ZipMember(name)
        def __str__(self):
            return str(archive) + '!' + member_prefix
    root = ZipRoot()
    expected = {
        'cadillac': ('75906273c0cd414c0d004320fc6f654b4783e5b1', '9f0351be133dd370a676090d27559a0adaf00605'),
        'armory': ('1e4feafa6964f4c68b27bae07e02d102f92a2c5d', '58e2e20338be0ca9cac3a8058b836eaf9d990a1f'),
    }[case]
    driver_sha = '8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5'
    driver_blob = 'c722b5810a7693e5ece72ed00b4401e7cde7267a'
    preload_sha = observer_pin['preloadSha256']
    frozen_receipt = {'files': observer_pin['files']}
    frozen_manifest_path = fixed_path.parent / 'observer-manifest.json'
    checks, issues = {}, []
    
    def check(name, value):
        checks[name] = bool(value)
        if not value:
            issues.append(name)
    
    def read(name):
        path = root / name
        if not path.exists():
            issues.append('missing: ' + name)
            return None
        return json.loads(path.read_text())
    
    def sha(data):
        return hashlib.sha256(data).hexdigest()
    
    def lines(name):
        p = root / name
        return [json.loads(s) for s in p.read_text().splitlines() if s.strip()] if p.exists() else []
    
    def compact(value):
        return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()
    
    archive_digest = hashlib.sha256()
    with archive.open('rb') as archive_file:
        for block in iter(lambda: archive_file.read(1024 * 1024), b''):
            archive_digest.update(block)
    archive_sha256 = archive_digest.hexdigest()
    check('archive-exact-bytes', archive.stat().st_size == capture_pin['archiveBytes'])
    check('archive-sha256', archive_sha256 == str(capture_pin.get('archiveSha256', '')).removeprefix('sha256:'))
    check('capture-fixed-attempt-and-head', capture_pin['runId'] == 45987971947 and capture_pin['attempt'] == 1 and
          capture_pin['head'] == 'a8e8b97a531d57b3c2b5b23d99aa0636d4c8dd25' and
          capture_pin['artifactId'] == 15193147198 and capture_pin['repository'] == 'robjasper2084/Jungle-Lotto')
    check('fixed-publication-bindings', publication['head'] == capture_pin['head'] and
          publication['tree'] == '9254637264c720434534cdc1a1ff463508c1408a' and
          publication['parent'] == '43102a047603bf12a6a416a63499bb69670dfa54' and
          publication['syntheticCheckout']['sha'] == '7594cc90e76cf16468d789ae79e7243430e89dbb' and
          publication['syntheticCheckout']['tree'] == publication['tree'] and
          publication['syntheticCheckout']['parents'] == ['893f769838166e6e35624b7b979ed5cbb8414507', publication['head']])
    check('fixed-observer-pins', preload_sha == '99301382fe138de6556e9bbaf51130457c9fba07b1aecdc9e1a86771e273e722' and
          observer_pin['manifestSha256'] == '04b84ed7ba6fd8181f229e76dc70354ec5dad19d328c7036010f3be3992d1aca')
    result = read('result.json')
    invocation = read('invocation.json')
    state = read('diagnostic-status.json')
    terminal = read('observer-process-exit.json')
    manifest = read('payload-manifest.json')
    build = read('built-files.json')
    source_receipts = {}
    for name in ['prepare', 'built', 'run', 'after-run']:
        value = read('source-' + name + '.json')
        source_receipts[name] = value
        if value:
            check('source-' + name + '-exact', (value['commit'], value['tree']) == expected)
            check('source-' + name + '-driver', value['driver']['sha256'] == driver_sha and value['driver']['gitBlob'] == driver_blob)
            check('source-' + name + '-working-files', value['objectsOnly'] is False)
            for item in value.get('buildStatisticChanges', []):
                before, after = item['before'].copy(), item['after'].copy()
                before.pop('buildMs', None)
                after.pop('buildMs', None)
                check('source-' + name + '-only-buildMs', before == after and item['onlyElapsedBuildMsDiffers'] is True)
    
    driver = root / 'original-driver.mjs'
    if driver.exists():
        data = driver.read_bytes()
        check('driver-bytes', len(data) == 20186)
        check('driver-sha256', sha(data) == driver_sha)
        check('driver-git-blob', hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == driver_blob)
    else:
        issues.append('missing: original-driver.mjs')
    
    if invocation:
        check('preload-sha256', invocation.get('preloadSha256') == preload_sha)
        check('workflow-synthetic-head', invocation.get('workflowHead') == publication['syntheticCheckout']['sha'])
        check('invocation-source', (invocation['source']['commit'], invocation['source']['tree']) == expected)
    if result and invocation and state and terminal:
        ids = [x.get('invocationId') for x in [result, invocation, state, terminal]]
        check('invocation-ids-match', len(set(ids)) == 1 and bool(ids[0]))
        check('source-and-build-preserved', result.get('sourceAndBuildPreserved') is True)
        check('diagnostic-complete', result.get('diagnosticComplete') is True and result.get('diagnosticPartial') is False)
        for label, value in [('state', state), ('terminal', terminal)]:
            check(label + '-clean-completion', value.get('complete') is True and value.get('partial') is False and not value.get('errors') and value.get('failureRevision') == 0)
    
    if build:
        check('build-manifest-hash', sha(compact(build['files'])) == build['manifestSha256'])
    bundles = read('loaded-bundles.json') or []
    build_files = {x['path']: x for x in (build or {}).get('files', [])}
    for bundle in bundles:
        p = root / bundle['file']
        check('loaded-' + bundle['sha256'][:12], p.exists() and sha(p.read_bytes()) == bundle['sha256'])
        relative = urllib.parse.unquote(urllib.parse.urlparse(bundle['url']).path).lstrip('/')
        check('built-' + bundle['sha256'][:12], build_files.get(relative, {}).get('sha256') == bundle['sha256'])
    
    assets = lines('asset-events.ndjson')
    scripts = lines('parsed-scripts.ndjson')
    diagnostic_events = lines('diagnostic-events.ndjson')
    event_clock = {x['name']: datetime.datetime.fromisoformat(x['at'].replace('Z', '+00:00')).timestamp() * 1000
                   for x in diagnostic_events if x.get('at')}
    if state:
        check('asset-event-count', len(assets) == state.get('assetEvents'))
        check('parsed-script-count', len(scripts) == state.get('parsedScripts'))
    cpu_path = root / 'native.cpuprofile'
    cpu_summary = None
    if cpu_path.exists():
        data = cpu_path.read_bytes()
        cpu = json.loads(data)
        deltas, samples = cpu.get('timeDeltas', []), cpu.get('samples', [])
        check('cpu-arrays', len(deltas) == len(samples) and bool(samples))
        ids = {x['id'] for x in cpu['nodes']}
        check('cpu-sample-node-ids', set(samples).issubset(ids))
        if state and state.get('cpuProfile'):
            check('cpu-file-sha256', sha(data) == state['cpuProfile']['sha256'])
        cpu_summary = {
            'bytes': len(data), 'sha256': sha(data), 'nodes': len(ids), 'samples': len(samples),
            'startTimeUs': cpu['startTime'], 'endTimeUs': cpu['endTime'],
            'durationMs': (cpu['endTime'] - cpu['startTime']) / 1000,
            'sampleSpanMs': sum(deltas) / 1000, 'negativeDeltas': sum(x < 0 for x in deltas),
            'sampleDeltaP50Us': statistics.median(deltas) if deltas else None,
            'sampleDeltaMinUs': min(deltas) if deltas else None,
            'sampleDeltaMaxUs': max(deltas) if deltas else None,
            'sampleDeltaOver10ms': sum(x > 10000 for x in deltas),
            'sampleDeltaOver50ms': sum(x > 50000 for x in deltas),
        }
        check('cpu-recording-within-advertised-110s-bound', cpu_summary['durationMs'] <= 110000)
    
    stop_timing = {'eventTimesEpochMs': {name: event_clock.get(name) for name in [
        'before-capture-setup', 'capture-started', 'capture-stopping', 'cpu-profile-saved', 'trace-saved', 'capture-collected']}}
    if 'capture-stopping' in event_clock and 'cpu-profile-saved' in event_clock:
        stop_timing['stoppingEventToCpuSaveMs'] = event_clock['cpu-profile-saved'] - event_clock['capture-stopping']
        stop_timing['note'] = 'Stop-event persistence is not awaited in this payload. This interval includes independent protocol stop and raw-file saving; it is not GPU execution or a precise disk-write duration.'
    if cpu_summary and state and state.get('alignment', {}).get('available'):
        alignment = state['alignment']
        offset = alignment['traceMinusObserverClockOffsetsMs'][0]
        end_epoch = cpu_summary['endTimeUs'] / 1000 - offset + alignment['timeOriginMs']
        stop_timing['cpuEndMappedEpochMs'] = end_epoch
        if 'capture-stopping' in event_clock:
            stop_timing['cpuEndAfterStoppingEventMs'] = end_epoch - event_clock['capture-stopping']
        last_w = next((p for p in alignment['pairedMarks'] if p['name'] == 'trusted-w-keyup'), None)
        if last_w:
            stop_timing['cpuEndAfterTrustedWUpMs'] = (cpu_summary['endTimeUs'] - last_w['trace']['ts']) / 1000
    
    # Raw trace remains inside the archive; audit_trace_zip.mjs validates it independently.
    report = read('original-driver-output/report.json')
    original = None
    if report:
        p = report.get('profile', {})
        original = {
            'sourceHead': report.get('sourceHead'), 'passed': report.get('passed'),
            'baselinePassed': report.get('baselinePassed'), 'frameQualityAccepted': report.get('frameQualityAccepted'),
            'device': report.get('device'), 'mode': report.get('mode'), 'viewport': report.get('viewport'),
            'renderBackend': report.get('renderBackend'), 'rendererFallback': report.get('rendererFallback'),
            'actualGpu': report.get('actualGpu'), 'stopReason': p.get('stopReason'),
            'frameMs': p.get('metrics', {}).get('frameMs'), 'maxFrameMs': p.get('maxFrameMs'),
            'over250ms': p.get('over250ms'), 'activeSeconds': p.get('activeSeconds'),
            'excludedSeconds': p.get('excludedSeconds'), 'inactiveSeconds': p.get('inactiveSeconds'), 'invalidSamples': p.get('invalidSamples'), 'hiddenSeconds': p.get('hiddenSeconds'),
            'frames': p.get('frames'), 'droppedFrameSamples': p.get('droppedFrameSamples'),
            'input': report.get('input'), 'probeErrors': report.get('probeErrors'),
            'errors': report.get('errors'), 'failedRequests': report.get('failedRequests'),
        }
        check('report-original-source', report.get('sourceHead') == expected[0])
    
    
    
    expected_categories = ['cc', 'viz', 'gpu', 'toplevel', 'toplevel.flow', 'devtools.timeline', 'blink.user_timing']
    if manifest and state:
        check('single-fixed-original-case', list(manifest['cases']) == ['cadillac'] and manifest['cases']['cadillac']['commit'] == expected[0])
        check('all-seven-fixed-categories', state.get('trace', {}).get('categories') == expected_categories)
        check('512MiB-buffer-and-file-caps', manifest['bounds']['traceBufferKiB'] == 524288 and manifest['bounds']['traceFileBytes'] == 536870912)
        check('independent-stop-and-cleanup-bounds', all(manifest['bounds'].get(k) == v for k, v in {'traceDrainTimeoutMs': 60000, 'captureWatchdogMs': 110000, 'protocolTimeoutMs': 4000, 'cleanupTimeoutMs': 10000}.items()))
        check('diagnostic-not-gpu-execution', state.get('gpuExecutionMeasured') is False and result.get('gpuExecutionMeasured') is False)
        check('trace-no-loss-or-cap', state['trace'].get('dataLossOccurred') is False and state['trace'].get('capReached') is False)
        check('trace-stream-complete', state['trace'].get('streamComplete') is True)
        check('clock-alignment-available', state.get('alignment', {}).get('available') is True)
        check('transport-and-final-writes-clean', state.get('finalization') == {'transportClosed': True, 'writesHealthy': True, 'statusPersisted': True})
        check('all-diagnostic-overflows-zero', all(state.get(k) == 0 for k in ['bundleOverflow', 'assetEventOverflow', 'parsedScriptOverflow', 'errorOverflow']))
        final_checkpoints = [item for item in state.get('checkpoints', []) if item.get('label') == 'final']
        raw_observer = read(final_checkpoints[-1]['file']) if final_checkpoints else None
        if raw_observer:
            check('genuine-raw-keyup-and-overflow', raw_observer.get('stoppedBy') == 'trusted-w-keyup' and raw_observer.get('keyups') == 1 and raw_observer.get('keydowns', 0) > 0 and raw_observer['raf']['overflow'] == 0 and raw_observer['longTasks']['overflow'] == 0 and raw_observer['markOverflow'] == 0)
        for label, source in source_receipts.items():
            if source:
                check('source-' + label + '-locked-packages', all(source['packageFiles'][manifest['project'] + '/' + path]['sha256'] == digest for path,digest in manifest['packageFiles'].items()))
        if invocation:
            check('invocation-exact-runtime', invocation.get('settings') == manifest['runtime'])
            check('driver-deadline-unchanged', invocation.get('strictStepTimeoutMinutes') == 28)
        check('native-chrome-launch', state.get('launch') == {'channel': 'chrome', 'headless': False, 'args': ['--enable-gpu', '--use-gl=angle', '--use-angle=metal']})
        check('native-desktop-page', state.get('pageOptions') == {'viewport': {'width': 1440, 'height': 900}, 'deviceScaleFactor': 1, 'isMobile': False, 'hasTouch': False, 'reducedMotion': 'reduce'})
        request = read('trace-category-request.json')
        enumerated = read('trace-categories.json')
        response = read('trace-categories-response.json')
        if request:
            check('exact-category-request-receipt', request.get('requestedCategories') == expected_categories and request.get('enumerationIsCapabilityProof') is False and request.get('requiredEvidenceScope') == 'trusted-W-window')
            check('enumeration-raw-receipt', isinstance(enumerated,list) and isinstance(response,dict) and response.get('categories') == enumerated)
            check('incomplete-enumeration-warning-preserved', request.get('enumerationComplete') is True or (bool(request.get('warning')) and any(row.get('where') == 'trace-category-enumeration' for row in state.get('warnings',[]))))
    if result and report:
        runtime = result.get('runtimeReceipt', {})
        check('original-runtime-native-metal', runtime.get('renderBackend') == 'angle-metal' and runtime.get('rendererFallback') is None and 'Apple Paravirtual' in str(runtime.get('actualGpu',{}).get('renderer','')))
        check('original-full-high-graphics', runtime.get('device') == 'desktop' and runtime.get('mode') == 'full' and runtime.get('requestedSeconds') == 90 and runtime.get('viewport') == {'width':1440,'height':900} and runtime.get('settingsAtStart') == {'quality':'high','effectiveQuality':'high','cap':60,'pixelRatio':1,'adaptiveScale':1,'diagnosticReduction':False} and runtime.get('worldPerformanceDiagnosticAtStart') is False)
        check('original-native-input', runtime.get('stopReason') == 'trusted-W-keyup' and runtime.get('input',{}).get('keyups') == 1 and runtime.get('input',{}).get('heartbeatError') is None)
        check('original-no-hidden-time-or-dropped-frame-samples', original.get('hiddenSeconds') == 0 and original.get('droppedFrameSamples') == 0)
        check('original-verdict-consistent', result['originalVerdict'].get('passed') == report.get('passed') and result['originalVerdict'].get('sourceHead') == report.get('sourceHead'))
    if state:
        t = state.get('trace', {})
        issued, acknowledged, deadline, finished = [t.get(k) for k in ['stopIssuedAtNodeEpochMs','stopAcknowledgedAtNodeEpochMs','finalizationDeadlineNodeEpochMs','finalizationFinishedAtNodeEpochMs']]
        check('one-absolute-60s-finalization-budget', isinstance(issued,(int,float)) and deadline == issued + 60000)
        check('end-rpc-within-4s', isinstance(issued,(int,float)) and isinstance(acknowledged,(int,float)) and 0 <= acknowledged-issued <= 4000)
        check('trace-finalization-finished-within-original-budget', isinstance(finished,(int,float)) and isinstance(deadline,(int,float)) and finished < deadline)
    if 'capture-stopping' in event_clock and 'trace-saved' in event_clock:
        stop_timing['stoppingEventToTraceSavedMs'] = event_clock['trace-saved'] - event_clock['capture-stopping']
        check('trace-drain-within-60s', stop_timing['stoppingEventToTraceSavedMs'] <= 60000)
    
    if manifest:
        frozen_manifest_bytes = frozen_manifest_path.read_bytes()
        expected_manifest_sha = observer_pin['manifestSha256']
        check('frozen-manifest-binding', sha(frozen_manifest_bytes) == expected_manifest_sha and manifest == json.loads(frozen_manifest_bytes) == observer_pin['manifest'])
    if state:
        check('browser-root-scope-disclosed', state.get('trace',{}).get('processScope') == 'browser-root/all-browser-processes')
        for label, receipt in [('state',state),('terminal',terminal or {})]:
            for name in ['page','browserTrace']:
                transport = receipt.get('transports',{}).get(name,{})
                check(label+'-'+name+'-owned-close', all(transport.get(k) is v for k,v in {
                    'created':True,'creationTimedOut':False,'detachAcknowledged':True,'closeObserved':True,
                    'closed':True,'unexpectedClose':False}.items()) and transport.get('detachCalls') == 1 and
                    not transport.get('creationError') and not transport.get('detachError'))
                made,requested,detached,ack,closed = [transport.get(k) for k in ['createdAtNodeEpochMs','createRequestedAtNodeEpochMs',
                    'detachRequestedAtNodeEpochMs','detachAcknowledgedAtNodeEpochMs','closedAtNodeEpochMs']]
                check(label+'-'+name+'-creation-within-4s', all(isinstance(x,(float,int)) for x in [made,requested]) and 0 <= made-requested < 4000)
                check(label+'-'+name+'-detach-and-close-within-2s', all(isinstance(x,(float,int)) for x in [detached,ack,closed]) and 0 <= ack-detached <= 2000 and 0 <= closed-detached <= 2000)
        life=state.get('lifecycle',{})
        page=state.get('transports',{}).get('page',{})
        page_work=life.get('pageWorkFinishedAtNodeEpochMs')
        page_detach=page.get('detachRequestedAtNodeEpochMs')
        check('page-detach-follows-page-work', isinstance(page_work,(int,float)) and isinstance(page_detach,(int,float)) and page_detach >= page_work)
        trace_issued=state.get('trace',{}).get('stopIssuedAtNodeEpochMs')
        trace_finished=state.get('trace',{}).get('finalizationFinishedAtNodeEpochMs')
        check('trace-stop-issued-before-page-detach', isinstance(trace_issued,(int,float)) and isinstance(page_detach,(int,float)) and trace_issued <= page_detach)
        stop_timing['pageDetachPrecededTraceFinishObserved'] = (page_detach <= trace_finished) if all(isinstance(x,(int,float)) for x in [page_detach,trace_finished]) else None
        cleanup_file=root/'observer-cleanup-terminal.json'
        if cleanup_file.exists():
            cleanup=json.loads(cleanup_file.read_text())
            check('cleanup-terminal-clean-if-present', cleanup.get('complete') is True and cleanup.get('partial') is False and not cleanup.get('errors') and cleanup.get('failureRevision') == 0)
        stop_timing['lifecycle']=life
        stop_timing['ownedTransports']=state.get('transports',{})
        stop_timing['lifecycleNote']='Node event receipt timestamps identify observed closure and explicit ownership release; they are not browser execution or GPU timestamps.'
    
    output = {
        'case': case, 'root': str(root), 'auditCompleted': True, 'releaseAcceptance': False,
        'checks': checks, 'issues': issues, 'provenanceChecksPassed': all(checks.values()) and not issues,
        'capture': capture_pin, 'publication': publication,
        'observerPins': {'preloadSha256': preload_sha, 'manifestSha256': observer_pin['manifestSha256'], 'files': observer_pin['files']},
        'archive': {'path': str(archive), 'bytes': archive.stat().st_size, 'sha256': archive_sha256, 'memberPrefix': member_prefix, 'rawTraceExtracted': False},
        'selectedMemberReceipts': selected_member_receipts,
        'status': {k: (state or {}).get(k) for k in ['phase','complete','partial','errors','warnings','failureRevision','finalization','trace','alignment','checkpoints','browserVersion','launch','pageOptions','cpuStop','lifecycle','transports']},
        'resultOriginalVerdict': (result or {}).get('originalVerdict'), 'original': original,
        'cpu': cpu_summary, 'stopTiming': stop_timing,
        'rawTraceNote': 'Retained in the single ZIP; see independent trace-stream-audit.json for raw hash, coverage and clock evidence.',
        'resources': {'bundles': len(bundles),'bundleBytes':sum(x['bytes'] for x in bundles),'assetEvents':len(assets),'parsedScripts':len(scripts)},
    }
    z.close()
    (output_directory / 'environment-capture-audit.json').write_text(json.dumps(output, indent=2) + '\n')
    print('CAPTURE_AUDIT_JSON=' + json.dumps(output, separators=(',', ':')))
    sys.exit(0 if output['provenanceChecksPassed'] else 1)
except Exception as error:
    failure_output = {'auditCompleted': False, 'releaseAcceptance': False, 'provenanceChecksPassed': False,
        'error': type(error).__name__ + ': ' + str(error), 'checks': globals().get('checks', {}),
        'issues': globals().get('issues', []) + ['audit-exception'],
        'selectedMemberReceipts': globals().get('selected_member_receipts', [])}
    if 'output_directory' in globals():
        try:
            (output_directory / 'environment-capture-audit.json').write_text(json.dumps(failure_output, indent=2) + '\n')
        except Exception:
            pass
    print('CAPTURE_AUDIT_JSON=' + json.dumps(failure_output, separators=(',', ':')))
    raise
