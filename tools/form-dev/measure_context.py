"""Developer-only: how big is the conversation a slide build / a slide edit runs in? (FIXLOG L-17, "Per-slide conversations")
  python tools/form-dev/measure_context.py [--port 8795] [--sandbox X:\\aura-dev-ctx] [--slides 8] [--before <old form_server.py>]
Runs the REAL form server against the fake Claude on an 8-slide plan: planning, every slide built one by one, then two edits of
slide 2. With --before (e.g. the v0.5.1 form_server.py) it runs that server too and prints both side by side:
  before = v0.5.1: one conversation per deck; a conversation past AURA_CTX_RESET (150k) is handed off to a fresh one at the next
           slide; every edit resumes whatever the deck's latest conversation is
  after  = v0.5.2: one conversation per slide (fresh and self-contained at its build, resumed for its edits) + one for the deck
The fake models the conversation size as: 60k tokens when a conversation starts (skills + plan read), +40k for planning, +100k per
built slide (calibrated on the real take: 340k after 3 of 7 slides), + message/4. It reports it like the real stream
(message.usage), and the server records the last value (deck: ctxTokens; slide: slideConvs[id].ctxTokens). So the table shows the
POLICY's effect under that model, not a measurement of a real model; the real per-slide growth is the number to replace
(AURA_FAKE_CTX_SLIDE). Also prints the size of the opening message of a slide conversation."""
import json, os, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
args = sys.argv[1:]
PORT = int(args[args.index('--port') + 1]) if '--port' in args else 8795
SANDBOX = Path(args[args.index('--sandbox') + 1]) if '--sandbox' in args else Path(r'X:\aura-dev-ctx')
SLIDES = int(args[args.index('--slides') + 1]) if '--slides' in args else 8
BEFORE = Path(args[args.index('--before') + 1]) if '--before' in args else None
sys.argv = [sys.argv[0], '--port', str(PORT), '--sandbox', str(SANDBOX)]
sys.path.insert(0, str(HERE))
import test_server as T            # the harness: start_server / jget / jpost / wait_plan_idle


def ctx_of(P, box):
    """(tokens, session id) of the conversation the last run used: the run's slide conversation, else the deck's."""
    rec = json.loads((box / '.aura' / 'decks' / f'{P}.json').read_text(encoding='utf-8'))
    conv = T.jget('/api/claude/status')[1].get('conv')
    c = (rec.get('slideConvs') or {}).get(conv) if conv else None
    return (c.get('ctxTokens'), c.get('sessionId')) if c else (rec.get('ctxTokens'), rec.get('sessionId'))


def one_run(server, box):
    subprocess.run([sys.executable, str(HERE / 'sandbox.py'), str(box), '--reset', '--no-venv'], check=True, stdout=subprocess.DEVNULL)
    T.SERVER, T.SANDBOX, T.AURA = server, box, box / '.aura'     # each run its own sandbox (a killed server's children may still hold the last one)
    srv = T.start_server(AURA_CTX_RESET=150000)
    rows = []
    try:
        T.jpost('/api/brief', {'basics': {'title': 'Context deck'}, 'look': {'theme': 'Bold Blue'}, 'style': {'quality': 'balanced'}})
        P = T.jpost('/api/plan/start', {})[1]['deckId']
        T.wait_plan_idle(P)
        rows.append(('planning',) + ctx_of(P, box))
        for n in range(1, SLIDES + 1):
            T.jpost(f'/api/decks/{P}/build', {'mode': 'next'})
            T.wait_plan_idle(P)
            rows.append((f'build {n}',) + ctx_of(P, box))
        for k in (1, 2):
            T.jpost('/api/claude/reply', {'deckId': P, 'slide': 2, 'text': f'make the heading shorter ({k})'})
            T.wait_plan_idle(P)
            rows.append((f'edit 2 #{k}',) + ctx_of(P, box))
        evs = T.jget('/api/claude/events?since=0')[1]['events']
        handoffs = sum(1 for e in evs if e.get('code') == 'handoff')
        built = T.plan_of(P).get('built')
    finally:
        T.stop_server(srv)
    return rows, handoffs, built


def main():
    out, tmp = {}, None
    try:
        if BEFORE:
            tmp = REPO / 'engine' / '_measure_before.py'          # it must sit in engine/ (it finds its files next to itself)
            shutil.copyfile(BEFORE, tmp)
            out['before (v0.5.1)'] = one_run(tmp, Path(str(SANDBOX) + '-before'))
        out['after (per-slide)'] = one_run(REPO / 'engine' / 'form_server.py', SANDBOX)
    finally:
        if tmp and tmp.exists(): tmp.unlink()
    print(f'\nConversation size after each step, {SLIDES} slides (tokens; simulated growth, see the file header)')
    print(f'{"step":<12}' + ''.join(f'{k:<32}' for k in out))
    first = next(iter(out.values()))[0]
    for i in range(len(first)):
        cells = []
        for k, (rows, h, b) in out.items():
            r = rows[i]
            prev = {x[2] for x in rows[:i]}
            note = ' (new)' if r[2] and r[2] not in prev else ''
            cells.append(f'{(r[1] or 0):>9,}{note:<23}')
        print(f'{first[i][0]:<12}' + ''.join(cells))
    for k, (rows, h, b) in out.items():
        toks = [r[1] or 0 for r in rows]
        print(f'{k}: peak {max(toks):,}, edits of slide 2 ran in {[r[1] for r in rows if r[0].startswith("edit")]}, hand-offs {h}, '
              f'slides built {b}, conversations {len({r[2] for r in rows if r[2]})}')
    sys.path.insert(0, str(REPO / 'engine'))
    os.environ['AURA_HOME'] = str(SANDBOX / '.aura')
    import form_server as fs
    slides = [{'id': f's{i}', 'title': f'Slide {i}', 'point': f'the point of slide {i}', 'bullets': ['a fact', 'another fact'],
               'visual': {'main': '3d', 'companions': ['labels'], 'detail': 'detailed', 'motion': 'timed', 'phrase': 'a cut-away'},
               'sources': ['Report/report.pdf'], 'built': i < 5} for i in range(1, 9)]
    rec = {'id': 'aaaaaaaaaaaa', 'look': 'Bold Blue', 'plan': {'slides': slides}, 'flow': 'plan',
           'slideConvs': {f's{i}': {'summary': f'Slide {i} is ready: a cut-away 3D model on the right, three labels, a timed fuel pulse.'} for i in range(1, 5)}}
    step = fs.build_message(rec, slides[4], 5, 8)
    opening = fs.slide_conv_message(rec, 's5', step)
    print(f'\none build-step message: {len(step):,} chars (~{len(step) // 4:,} tokens); as the opening of slide 5\'s own conversation '
          f'(plan digest + how slides 1-4 were built + the step): {len(opening):,} chars (~{len(opening) // 4:,} tokens)')


if __name__ == '__main__':
    main()
