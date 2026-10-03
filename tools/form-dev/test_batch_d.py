"""Developer-only tests for FIXLOG "Batch D" (the front end and the user's journey): the server halves.
Called from test_server.py with the test module itself as `T` (check / jget / jpost / req and the sandbox paths).
  W-01 unbuilt slides stay editable mid-build   W-02 delete / archive / restore a deck (the bin)   W-08 brief backup
  W-09 uploads remembered across restarts       F-03 slide pictures: at most two Edge renders at once"""
import contextlib, json, os, sys, time
from pathlib import Path


def run(T):
    check, jget, jpost, req = T.check, T.jget, T.jpost, T.req
    sys.path.insert(0, str(T.REPO / 'engine'))
    import form_server as fs
    import test_batch_c as C
    os.environ['AURA_TEST_UNIT_ROOT'] = str(T.SANDBOX / 'unit')
    print('\n[batch D: W-02 library actions, W-08 brief backup, W-09 uploads, W-01 mid-build edits, F-03]')

    # ---- W-02 over HTTP: delete = move to the bin, restore brings it back, archive is a flag
    s, j = jpost('/api/decks')
    d = j['id']
    check('W-02: a new deck record exists', s == 200 and any(x['id'] == d for x in jget('/api/decks')[1]['decks']))
    s, h, body = req('PATCH', f'/api/decks/{d}', {'archived': True})
    check('W-02: archive is a PATCH flag and the list carries it', s == 200 and next(x for x in jget('/api/decks')[1]['decks'] if x['id'] == d).get('archived') is True, s)
    s, h, body = req('PATCH', f'/api/decks/{d}', {'archived': 'yes'})
    check('W-02: archived must be a boolean', s == 400, s)
    req('PATCH', f'/api/decks/{d}', {'archived': False})
    s, h, body = req('DELETE', f'/api/decks/{d}')
    j = json.loads(body or b'{}')
    check('W-02: DELETE moves the deck to the bin and says where', s == 200 and j.get('ok') and j.get('binned', '').startswith(d + '-'), (s, j))
    check('W-02: it is gone from the library', not any(x['id'] == d for x in jget('/api/decks')[1]['decks']) and jget(f'/api/decks/{d}')[0] == 404)
    binned = j.get('binned')
    check('W-02: the record is in the bin folder, not erased', binned and (T.SANDBOX / '.aura' / 'decks' / '_deleted' / binned / f'{d}.json').is_file())
    s, h, body = req('DELETE', '/api/decks/nosuchdeck')
    check('W-02: deleting an unknown deck is a 404', s == 404, s)
    s, j = jpost('/api/decks/restore', {'binned': binned})
    check('W-02: restore brings the deck back', s == 200 and j.get('ok') and any(x['id'] == d for x in jget('/api/decks')[1]['decks']), (s, j))
    check('W-02: restore of a bad name is refused', jpost('/api/decks/restore', {'binned': '../../etc'})[0] == 400)
    s, h, body = req('DELETE', f'/api/decks/{d}')            # leave the sandbox as found
    check('W-02: the bin is never touched by the reaper (it is the safety net)', 'name == BIN_DIRNAME' in (T.REPO / 'engine' / 'form_server.py').read_text(encoding='utf-8'))

    # ---- W-02 unit: a busy deck is not deleted; the finished files stay; a binned deck's html is not re-adopted
    with C.unit_root(fs, 'w02') as root:
        C.deck_json(fs, root, 'busy1')
        class Stub: busy = True; running = True; deck_id = 'busy1'; waiting = False; run = None
        real = fs.RUNNER; fs.RUNNER = Stub()
        try:
            code, res = fs.delete_deck('busy1')
        finally:
            fs.RUNNER = real
        check('W-02: a deck Claude is working on is not deleted (409)', code == 409 and (root / '.aura' / 'decks' / 'busy1.json').is_file(), (code, res))
        (root / '4 - Your slides' / 'Final deck.html').write_text('<html></html>', encoding='utf-8')
        C.deck_json(fs, root, 'fin1', file='4 - Your slides/Final deck.html', final={'html': '4 - Your slides/Final deck.html'})
        (root / '.aura' / 'decks' / 'fin1').mkdir()
        (root / '.aura' / 'decks' / 'fin1' / 'plan.json').write_text('{}', encoding='utf-8')
        class Idle: busy = False; running = False; deck_id = None; waiting = False; session_id = None; last_deck = None; run = None
        fs.RUNNER = Idle()
        try:
            code, res = fs.delete_deck('fin1')
            fs.migrate_decks()
            ids = [r['id'] for r in fs.all_decks()]
        finally:
            fs.RUNNER = real
        check('W-02: delete works for an idle deck and reports the finished file was kept', code == 200 and res.get('keptFinal') is True, (code, res))
        check('W-02: the finished html in "4 - Your slides" is untouched', (root / '4 - Your slides' / 'Final deck.html').is_file())
        check('W-02: ...and it is NOT re-adopted as a brand-new deck by the library', 'fin1' not in ids and len(ids) == 1 and ids == ['busy1'], ids)
        check('W-02: the work folder went to the bin with the record', any((p / 'work' / 'plan.json').is_file() for p in (root / '.aura' / 'decks' / '_deleted').iterdir()))
        rep = fs.reap(now=time.time() + 400 * 86400)
        check('W-02: even 400 days later the reaper leaves the bin alone', any((root / '.aura' / 'decks' / '_deleted').iterdir()) and not any('_deleted' in r['path'] for r in rep['removed']), rep['removed'])

    # ---- W-08: "start fresh" keeps a copy of the old answers
    jpost('/api/brief', {'basics': {'title': 'Keep me'}})
    brief_dir = T.SANDBOX / '.aura' / 'brief'
    before = len(list(brief_dir.glob('brief-*.json')))
    s, j = jpost('/api/brief/archive')
    after = sorted(brief_dir.glob('brief-*.json'))
    check('W-08: archive copies brief.json to brief-<time>.json', s == 200 and j.get('kept') and len(after) == before + 1 and 'Keep me' in after[-1].read_text(encoding='utf-8'), (s, j))
    with C.unit_root(fs, 'w08') as root:
        for i in range(14): (root / '.aura' / 'brief' / f'brief-2020010{i // 10}-0000{i % 10:02d}.json').write_text('{"a":1}', encoding='utf-8')
        (root / '.aura' / 'brief' / 'brief.json').write_text(json.dumps({'basics': {'title': 'x'}}), encoding='utf-8')
        code, res = fs.archive_brief()
        check('W-08: only the newest ten backups are kept', code == 200 and len(list((root / '.aura' / 'brief').glob('brief-*.json'))) == 10, len(list((root / '.aura' / 'brief').glob('brief-*.json'))))
        (root / '.aura' / 'brief' / 'brief.json').write_text('{}', encoding='utf-8')
        code, res = fs.archive_brief()
        check('W-08: an empty brief makes no backup', code == 200 and res.get('kept') is None, res)

    # ---- W-09: uploads are remembered across restarts
    with C.unit_root(fs, 'w09') as root:
        (root / '.aura' / 'temp' / 'uploads.json').write_text(json.dumps([os.path.normcase(str(root / 'x.pdf'))]), encoding='utf-8')
        loaded = fs._load_uploads()
        check('W-09: the list of uploaded files is read back after a restart', loaded == {os.path.normcase(str(root / 'x.pdf'))}, loaded)
        (root / '.aura' / 'temp' / 'uploads.json').write_text('not json', encoding='utf-8')
        check('W-09: a damaged list is an empty list, not a crash', fs._load_uploads() == set())

    # ---- W-01: unbuilt slides can be saved while Claude builds, except the one being built right now
    with C.unit_root(fs, 'w01') as root:
        slides = [{'id': f's{i}', 'title': f'Slide {i}', 'point': 'p', 'bullets': [], 'sources': [], 'visual': {'main': 'text', 'companions': [], 'phrase': ''}} for i in (1, 2, 3)]
        stored, _probs, _ = fs.normalize_plan({'slides': slides, 'doubts': []}, {'slides': [], 'doubts': []})
        stored['slides'][0]['built'] = True
        stored['seq'] = 1
        C.deck_json(fs, root, 'w01', planState='building', buildTarget='s2', plan=stored)
        (root / '.aura' / 'decks' / 'w01').mkdir(exist_ok=True)
        class Live: busy = True; running = True; deck_id = 'w01'; waiting = False; run = None
        real = fs.RUNNER; fs.RUNNER = Live()
        try:
            def plan_with(fn):
                p = json.loads(json.dumps(fs.load_deck('w01')['plan'])); fn(p); return p
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'][2].update(title='Changed slide three'))})
            check('W-01: an unbuilt slide that is NOT the one being built can be changed mid-build', code == 200, (code, res.get('error')))
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'][1].update(title='Changed the target'))})
            check('W-01: the slide being built right now is locked (409 building)', code == 409 and res.get('error') == 'building', (code, res.get('error')))
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'].append({'id': 's9', 'title': 'Added late', 'point': '', 'bullets': [], 'sources': [], 'visual': {'main': 'text', 'companions': [], 'phrase': ''}}))})
            check('W-01: a slide can be added at the end mid-build', code == 200 and [x['id'] for x in res['plan']['slides']][-1] == 's9', (code, res.get('error')))
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'].pop(2))})
            check('W-01: an unbuilt slide can be removed mid-build', code == 200 and 's3' not in [x['id'] for x in res['plan']['slides']], (code, res.get('error')))
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'][0].update(title='Changed a built one'))})
            check('W-01: a built slide is still fixed (409 built)', code == 409 and res.get('error') == 'built', (code, res.get('error')))
            code, res = fs.save_plan('w01', {'plan': plan_with(lambda p: p['slides'].insert(0, {'id': 's8', 'title': 'Before the built one', 'point': '', 'bullets': [], 'sources': [], 'visual': {'main': 'text', 'companions': [], 'phrase': ''}}))})
            check('W-01: nothing can be put in front of the built slides', code == 409, (code, res.get('error')))
        finally:
            fs.RUNNER = real

    # ---- F-03: the slide-picture renderer is throttled
    check('F-03: at most two slide-picture renders (two Edge launches) at a time', fs.SHOT_SEM._value == 2)
