"""Developer-only: how big does the conversation get while a deck is built slide by slide? (FIXLOG L-17)
  python tools/form-dev/measure_context.py [--port 8795] [--sandbox X:\\aura-dev-ctx] [--slides 8]
Runs the REAL form server against the fake Claude twice on an 8-slide plan:
  before = AURA_CTX_RESET huge  -> every step resumes the one conversation (the old behaviour)
  after  = the default policy   -> a conversation past the threshold is not carried further: the next slide starts a fresh one
                                   that is handed the plan and the built slides (self-contained step message)
The fake models the conversation size as: 60k tokens when a conversation starts (skills + plan read), +40k for planning, +100k per
built slide (calibrated on the real take: 340k after 3 of 7 slides), + message/4. It reports it like the real stream
(message.usage), and the server records the last value on the deck (ctxTokens). So the table shows the POLICY's effect under that
model, not a measurement of a real model; the real per-slide growth is the number to replace (AURA_FAKE_CTX_SLIDE).
Also prints the size of one build-step message in the old form and in the new self-contained form."""
import json, os, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
args = sys.argv[1:]
PORT = int(args[args.index('--port') + 1]) if '--port' in args else 8795
SANDBOX = Path(args[args.index('--sandbox') + 1]) if '--sandbox' in args else Path(r'X:\aura-dev-ctx')
SLIDES = int(args[args.index('--slides') + 1]) if '--slides' in args else 8
sys.argv = [sys.argv[0], '--port', str(PORT), '--sandbox', str(SANDBOX)]
sys.path.insert(0, str(HERE))
import test_server as T            # the harness: start_server / jget / jpost / wait_plan_idle


def one_run(label, reset):
    subprocess.run([sys.executable, str(HERE / 'sandbox.py'), str(SANDBOX), '--reset', '--no-venv'], check=True, stdout=subprocess.DEVNULL)
    srv = T.start_server(AURA_CTX_RESET=reset)
    rows = []
    try:
        T.jpost('/api/brief', {'basics': {'title': 'Context deck'}, 'look': {'theme': 'Bold Blue'}, 'style': {'quality': 'balanced'}})
        P = T.jpost('/api/plan/start', {})[1]['deckId']
        T.wait_plan_idle(P)
        rec = json.loads((SANDBOX / '.aura' / 'decks' / f'{P}.json').read_text(encoding='utf-8'))
        rows.append((0, 'planning', rec.get('ctxTokens'), rec.get('sessionId')))
        for n in range(1, SLIDES + 1):
            T.jpost(f'/api/decks/{P}/build', {'mode': 'next'})
            T.wait_plan_idle(P)
            rec = json.loads((SANDBOX / '.aura' / 'decks' / f'{P}.json').read_text(encoding='utf-8'))
            rows.append((n, f'slide {n}', rec.get('ctxTokens'), rec.get('sessionId')))
        evs = T.jget('/api/claude/events?since=0')[1]['events']
        handoffs = sum(1 for e in evs if e.get('code') == 'handoff')
        built = T.plan_of(P).get('built')
    finally:
        T.stop_server(srv)
    return rows, handoffs, built


def main():
    out = {}
    for label, reset in (('before (always resume)', 10 ** 9), ('after (hand-off at 150k)', 150000)):
        out[label] = one_run(label, reset)
    print(f'\nConversation size after each step, {SLIDES} slides (tokens; simulated growth, see the file header)')
    print(f'{"step":<10}' + ''.join(f'{k:<30}' for k in out))
    for i in range(SLIDES + 1):
        cells = []
        for k, (rows, h, b) in out.items():
            r = rows[i]
            tok = r[2] or 0
            prev = rows[i - 1][3] if i else None
            note = ' (fresh)' if i and r[3] != prev else ''
            cells.append(f'{tok:>9,}{note:<21}')
        print(f'{rows[i][1] if False else ("planning" if i == 0 else f"slide {i}"):<10}' + ''.join(cells))
    for k, (rows, h, b) in out.items():
        toks = [r[2] or 0 for r in rows]
        print(f'{k}: peak {max(toks):,}, hand-offs {h}, slides built {b}')
    sys.path.insert(0, str(REPO / 'engine'))
    os.environ['AURA_HOME'] = str(SANDBOX / '.aura')
    import form_server as fs
    slides = [{'id': f's{i}', 'title': f'Slide {i}', 'point': f'the point of slide {i}', 'bullets': ['a fact', 'another fact'],
               'visual': {'main': '3d', 'companions': ['labels'], 'detail': 'detailed', 'motion': 'timed', 'phrase': 'a cut-away'},
               'sources': ['Report/report.pdf'], 'built': i < 5} for i in range(1, 9)]
    rec = {'id': 'aaaaaaaaaaaa', 'look': 'Bold Blue', 'plan': {'slides': slides}, 'flow': 'plan'}
    new = fs.build_message(rec, slides[4], 5, 8)
    card = fs.step_card('s5', 5)
    old = ('[build-slide id=s5 n=5 of=8] Build slide 5 of 8 now: "Slide 5". Follow `.claude/skills/aura-slide/building.md`: build ONLY this '
           'slide, exactly as planned in `.aura/decks/aaaaaaaaaaaa/plan.json`.\nPack into the deck folder `.aura/decks/aaaaaaaaaaaa/` (the '
           '[deck-folder] line; CLAUDE.md "Where you write").\n' + card)
    print(f'\none build-step message: old form {len(old):,} chars (~{len(old) // 4:,} tokens), new self-contained form {len(new):,} chars '
          f'(~{len(new) // 4:,} tokens); in exchange the step no longer opens plan.json or the source files itself')


if __name__ == '__main__':
    main()
