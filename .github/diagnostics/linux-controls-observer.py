#!/usr/bin/env python3
"""Read-only Linux CPU/scheduler diagnostic. Original child exit is preserved."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import time

PROC = Path('/proc')
HZ = os.sysconf('SC_CLK_TCK')
PAGE = os.sysconf('SC_PAGE_SIZE')


def read(path):
    try:
        return path.read_text(errors='replace')
    except OSError:
        return None


def stat(path):
    s = read(path)
    if s is None:
        return None
    end = s.rfind(')')
    try:
        f = s[end + 2:].split()
        return {'pid': int(s.split(' ', 1)[0]), 'comm': s[s.index('(') + 1:end],
                'ppid': int(f[1]), 'state': f[0], 'ticks': int(f[11]) + int(f[12]),
                'startTicks': int(f[19]), 'rssBytes': int(f[21]) * PAGE}
    except (ValueError, IndexError):
        return None


def role(pid, name):
    # Never retain command lines or environment data: only a process type.
    args = (read(PROC / str(pid) / 'cmdline') or '').split('\0')
    for arg in args:
        if arg.startswith('--type='):
            kind = arg.split('=', 1)[1]
            return 'chrome-' + (kind if kind in ('gpu-process', 'renderer', 'utility', 'zygote') else 'other')
    name = name.lower()
    if 'chrome' in name or 'chromium' in name:
        return 'chrome-browser'
    if name.startswith('node'):
        return 'node'
    if name == 'xvfb':
        return 'xvfb'
    return 'other-child'


def collect(root, observer_start):
    proc = {}
    for p in PROC.iterdir():
        if p.name.isdigit():
            row = stat(p / 'stat')
            if row:
                proc[row['pid']] = row
    selected = {root}
    while True:
        more = {p for p, row in proc.items() if row['ppid'] in selected}
        if more <= selected:
            break
        selected.update(more)
    rows = []
    for pid in sorted(selected & proc.keys()):
        row = proc[pid]
        row['role'] = role(pid, row['comm'])
        tasks = PROC / str(pid) / 'task'
        threads = []
        try:
            for task in tasks.iterdir():
                t = stat(task / 'stat')
                if t is None:
                    continue
                sched = (read(task / 'schedstat') or '').split()
                if len(sched) >= 3 and all(x.isdigit() for x in sched[:3]):
                    t['schedstat'] = [int(x) for x in sched[:3]]
                threads.append(t)
        except OSError:
            pass
        row['threads'] = threads
        rows.append(row)
    cg = Path('/sys/fs/cgroup')
    for line in (read(PROC / 'self' / 'cgroup') or '').splitlines():
        if line.startswith('0::/'):
            rel = line[4:]
            if '..' not in Path(rel).parts:
                cg = cg / rel
    cpu = (read(PROC / 'stat') or '').splitlines()
    mem = (read(PROC / 'meminfo') or '').splitlines()
    return {'elapsedSeconds': time.monotonic() - observer_start,
            'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'loadavg': read(PROC / 'loadavg'),
            'cpu': [line for line in cpu if line.startswith(('cpu ', 'procs_running ', 'procs_blocked '))],
            'memory': [line for line in mem if line.startswith(('MemTotal:', 'MemAvailable:', 'SwapTotal:', 'SwapFree:'))],
            'pressure': {key: read(PROC / 'pressure' / key) for key in ('cpu', 'memory', 'io')},
            'cgroup': {key: read(cg / key) for key in ('cpu.stat', 'cpu.max', 'cpuset.cpus.effective', 'memory.current', 'memory.max', 'memory.events')},
            'processes': rows}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--interval', type=float, default=3.0)
    p.add_argument('command', nargs=argparse.REMAINDER)
    a = p.parse_args()
    command = a.command[1:] if a.command[:1] == ['--'] else a.command
    if not command or not 1 <= a.interval <= 30:
        p.error('Command and interval in [1,30] required')
    a.out.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    count, errors = 0, []
    # The original case owns input, screenshots, clocks and timeout. This
    # observer never calls the browser, changes affinity, or changes the child.
    with (a.out / 'original.log').open('xb') as log, (a.out / 'host-samples.jsonl').open('x', buffering=1) as samples:
        child = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        while child.poll() is None:
            tick = time.monotonic()
            try:
                row = collect(child.pid, started)
                row['observerCostMs'] = (time.monotonic() - tick) * 1000
                samples.write(json.dumps(row, separators=(',', ':')) + '\n')
                count += 1
            except Exception as e:
                if len(errors) < 16:
                    errors.append(str(e))
            # Poll for child completion without a blocking wait beyond cadence.
            try:
                child.wait(timeout=max(.01, a.interval - (time.monotonic() - tick)))
            except subprocess.TimeoutExpired:
                pass
        rc = child.wait()
    receipt = {'scope': 'Diagnostic only; not release acceptance. CPU ticks and scheduler counters are not GPU-device timing.',
               'childExitCode': rc, 'samples': count, 'observerErrors': errors,
               'clockTicksPerSecond': HZ, 'intervalSeconds': a.interval,
               'cpuCount': os.cpu_count(), 'allowedCpuCount': len(os.sched_getaffinity(0)),
               'elapsedSeconds': time.monotonic() - started}
    (a.out / 'observer-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return rc if rc >= 0 else 128 - rc


if __name__ == '__main__':
    raise SystemExit(main())
