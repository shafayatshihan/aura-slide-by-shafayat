// Every screen of the studio, in order. app.js walks this list; fields.js draws the `fields` of each screen.
// Keys are the brief keys from the contract (section 5): the server's brief writer and the skill read them, so never
// rename one. Option values match the brief writer too; labels are what people see.

export const GROUPS = ['The talk', 'People', 'Audience', 'Your work', 'The look', 'Your files', 'Extras', 'Make it'];

// The seven upload folders, in screen order ("3 - Put your files here/<name>").
export const FOLDERS = [
  { name: 'Report', headline: 'got a report?', lead: 'drop your thesis or report here. claude reads it first, so this one matters most.',
    title: 'your report', hint: 'pdf or word', accept: '.pdf,.doc,.docx' },
  { name: 'Images and photos', headline: 'any photos or pictures?', lead: 'setups, samples, prototypes, people. real photos make a talk feel real.',
    title: 'photos and pictures', hint: 'jpg, png, heic, svg', accept: 'image/*,.heic' },
  { name: 'Data (csv, excel, graphs)', headline: 'got data or graphs?', lead: 'spreadsheets or chart images. claude can redraw your graphs nice and clean.',
    title: 'data and graphs', hint: 'csv, excel, chart images', accept: '.csv,.tsv,.xlsx,.xls,.json,.txt,.png,.jpg,.jpeg,.svg' },
  { name: 'Logo and university template', headline: 'logos or a template?', lead: 'your university logo, or a template you’re asked to follow.',
    title: 'logos and templates', hint: 'images, pptx or pdf', accept: 'image/*,.pptx,.potx,.pdf' },
  { name: 'Previous year reports', headline: 'examples from before?', lead: 'past reports or slides help claude match what your department expects.',
    title: 'earlier examples', hint: 'pdf, word or powerpoint', accept: '.pdf,.doc,.docx,.ppt,.pptx' },
  { name: 'Journal papers', headline: 'papers you lean on?', lead: 'the key papers you cite. claude pulls references and context from them.',
    title: 'journal papers', hint: 'pdf', accept: '.pdf' },
  { name: 'Anything else', headline: 'anything else?', lead: 'videos, notes, odds and ends. if in doubt, drop it in.',
    title: 'anything else', hint: 'any file', accept: '' },
];

const TYPE_OPTIONS = [
  { value: 'Thesis defence', label: 'Thesis defence', icon: 'cap' },
  { value: 'Thesis progress / interim', label: 'Thesis progress', icon: 'progress' },
  { value: 'Project presentation', label: 'Project', icon: 'rocket' },
  { value: 'Class presentation', label: 'Class talk', icon: 'board' },
  { value: 'Seminar', label: 'Seminar', icon: 'chat' },
  { value: 'Conference talk', label: 'Conference talk', icon: 'mic' },
  { value: 'Proposal', label: 'Proposal', icon: 'bulb' },
  { value: 'Lecture', label: 'Lecture', icon: 'book' },
  { value: 'Other', label: 'Something else', icon: 'sparkle' },
];

const screen = (id, group, scene, headline, lead, fields, extra = {}) => ({ id, group, scene, headline, lead, fields, mode: 'stage', ...extra });

export const SCREENS = [
  { id: 'welcome', group: null, scene: 'welcome', mode: 'full', fields: [] },

  // ---- The talk
  screen('type', 'The talk', 'talk', 'what kind of talk is it?', 'pick the closest one. it shapes everything that follows.', [
    { type: 'choice', key: 'basics.type', label: 'the kind of talk', required: true, cols: 3, options: TYPE_OPTIONS,
      msg: 'pick the one that fits best, even roughly.' },
    { type: 'text', key: 'basics.typeOther', label: 'what is it?', placeholder: 'e.g. club pitch, viva, workshop',
      when: get => get('basics.type') === 'Other', required: true, msg: 'tell me a word or two about what kind of talk it is.' },
  ]),
  screen('title', 'The talk', 'talk', 'what’s it called?', 'the title goes on your first slide. a working title is totally fine.', [
    { type: 'text', key: 'basics.title', label: 'title', multiline: 3, required: true,
      placeholder: 'e.g. Solar-powered water pump for rural irrigation', msg: 'your talk needs a name. even a rough one is fine.' },
    { type: 'text', key: 'basics.subtitle', label: 'subtitle', placeholder: 'optional, e.g. a final-year project' },
  ]),
  screen('when', 'The talk', 'talk', 'when and where?', 'a date and an event help claude set the scene on the title slide.', [
    { type: 'date', key: 'basics.date', label: 'date of the talk' },
    { type: 'text', key: 'basics.event', label: 'course or event', placeholder: 'e.g. ME 400 thesis, or ICME 2026' },
  ]),

  // ---- People
  screen('presenters', 'People', 'people', 'who’s presenting?', 'add everyone who’ll be up there with you, up to eight.', [
    { type: 'repeater', key: 'people.presenters', label: 'presenters', item: 'presenter', min: 1, max: 8, perPage: 4, layout: 'person',
      cols: [{ key: 'name', label: 'name', placeholder: 'full name', required: true },
             { key: 'id', label: 'id', placeholder: 'student id' },
             { key: 'role', label: 'role', placeholder: 'role' }],
      msg: 'add at least one presenter’s name.', rowMsg: 'every presenter needs a name (or remove the empty row).' },
  ]),
  screen('supervisor', 'People', 'people', 'who’s guiding you?', 'your supervisor or teacher, and where you study. skip anything that doesn’t apply.', [
    { type: 'text', key: 'people.supervisor', label: 'supervisor or teacher', placeholder: 'e.g. Dr. Jane Rahman' },
    { type: 'text', key: 'people.supervisorTitle', label: 'their title', placeholder: 'e.g. Professor, Dept. of EEE' },
    { type: 'text', key: 'people.institution', label: 'university or institution', placeholder: 'e.g. BUET' },
    { type: 'text', key: 'people.department', label: 'department', placeholder: 'e.g. Mechanical Engineering' },
  ]),

  // ---- Audience
  screen('audience', 'Audience', 'audience', 'who’s listening?', 'pick everyone who’ll be in the room. claude tunes the words for them.', [
    { type: 'multi', key: 'audience.who', label: 'the audience', options: [
      { value: 'Examiners / teachers', label: 'Examiners or teachers' }, { value: 'Classmates', label: 'Classmates' },
      { value: 'Researchers / experts', label: 'Researchers or experts' }, { value: 'Industry', label: 'Industry people' },
      { value: 'General public', label: 'General public' }, { value: 'School students', label: 'School students' }] },
    { type: 'seg', key: 'audience.level', label: 'how much do they already know?', default: 'Some background', stack: true, options: [
      { value: 'New to the topic', label: 'Almost nothing' }, { value: 'Some background', label: 'A little' },
      { value: 'Experts', label: 'A lot, they’re experts' }] },
  ]),
  screen('time', 'Audience', 'audience', 'how long do you have?', 'claude paces the slides so you finish right on time.', [
    { type: 'stepper', key: 'audience.minutes', label: 'time limit', unit: 'min', min: 1, max: 180, default: 10, required: true,
      msg: 'how many minutes do you have? a rough guess is fine.' },
    { type: 'stepper', key: 'audience.qa', label: 'question time after', unit: 'min', min: 0, max: 60, allowEmpty: true, emptyLabel: 'not sure' },
    { type: 'stepper', key: 'audience.slides', label: 'number of slides', unit: 'slides', min: 1, max: 80, allowEmpty: true,
      emptyLabel: 'claude decides', startAt: get => Math.max(4, Math.round((+get('audience.minutes') || 10) * 1.1)) },
  ]),

  // ---- Your work
  screen('work', 'Your work', 'work', 'what’s your work about?', 'a sentence or two in plain words is perfect.', [
    { type: 'text', key: 'work.field', label: 'subject area', placeholder: 'e.g. fluid mechanics, microbiology' },
    { type: 'textarea', key: 'work.summary', label: 'in a sentence or two, what did you do?', rows: 5,
      placeholder: 'e.g. we built a cheap sensor that warns farmers before soil gets too dry.' },
  ]),
  screen('why', 'Your work', 'work', 'why does it matter?', 'the problem you tackled, and how you went about it.', [
    { type: 'textarea', key: 'work.problem', label: 'the problem, or why it matters', rows: 5, placeholder: 'who has this problem, and why care?' },
    { type: 'textarea', key: 'work.method', label: 'how you did it', rows: 5, placeholder: 'methods, tools, experiments, simulations…' },
  ]),
  screen('results', 'Your work', 'results', 'what did you find?', 'your headline numbers, and the one thing people should remember.', [
    { type: 'repeater', key: 'work.results', label: 'key results', item: 'result', min: 1, max: 5, perPage: 5, layout: 'pair',
      cols: [{ key: 'what', label: 'result', placeholder: 'e.g. efficiency gain' }, { key: 'value', label: 'value', placeholder: 'e.g. 23%' }] },
    { type: 'textarea', key: 'work.message', label: 'if they remember one thing…', rows: 3, placeholder: 'e.g. cheap sensors can save a whole harvest.' },
  ]),
  screen('status', 'Your work', 'results', 'is it finished?', 'done and dusted, or still cooking? both make great talks.', [
    { type: 'choice', key: 'work.status', label: 'where it stands', cols: 2, options: [
      { value: 'Finished', label: 'Yes, finished', icon: 'flag' }, { value: 'Still going', label: 'Still going', icon: 'loop' }] },
    { type: 'textarea', key: 'work.next', label: 'what comes next?', rows: 4, placeholder: 'future work, open questions, next steps' },
  ]),

  // ---- The look
  screen('look', 'The look', null, 'pick a look', 'hover to preview each one. or let claude choose what suits your topic.', [], { component: 'looks' }),
  screen('style', 'The look', 'style', 'how lively should it be?', '3d models, moving diagrams, and how much of both. we’ve picked a happy middle.', [
    { type: 'toggle', key: 'style.threeD', label: '3d simulations', sub: 'models and scenes you can spin', icon: 'cube', on: 'yes', off: 'no', default: 'yes' },
    { type: 'toggle', key: 'style.twoD', label: '2d animations', sub: 'diagrams that move and build up', icon: 'wave', on: 'yes', off: 'no', default: 'yes' },
    { type: 'slider', key: 'style.amount', label: 'how much illustration and animation', min: 0, max: 100, default: 60 },
    // Quality vs speed: the server turns this into Claude's model and effort (best = opus, balanced/fast = sonnet).
    { type: 'seg', key: 'style.quality', label: 'quality or speed?', default: 'balanced', stack: true, options: [
      { value: 'best', label: 'best quality · slower, uses more of your plan' },
      { value: 'balanced', label: 'balanced · great slides at a good pace' },
      { value: 'fast', label: 'fast · quickest, lightest on your plan' }] },
  ]),
  screen('plan', 'The look', 'review', 'want to plan the slides?', 'claude can plan them for you, or you can sketch the order yourself.', [
    { type: 'toggle', key: 'plan.auto', label: 'let claude plan them', sub: 'turn off to list the slides yourself', icon: 'wand', on: true, off: false, default: true },
    { type: 'repeater', key: 'plan.slides', label: 'your slides', item: 'slide', min: 1, max: 60, perPage: 5, layout: 'slide', compact: true,
      when: get => get('plan.auto') === false,
      cols: [{ key: 'title', label: 'slide title', placeholder: 'slide title' }, { key: 'covers', label: 'covers', placeholder: 'what it covers' },
             { key: 'file', label: 'file', type: 'file' }] },
  ]),

  // ---- Your files (one screen per folder)
  ...FOLDERS.map((f, i) => screen(`files-${i + 1}`, 'Your files', 'files', f.headline, f.lead, [], {
    component: 'uploads', folder: f,
    // The last folder also asks what to leave out; it sits under the lead so the drop zone keeps the full column.
    left: f.name === 'Anything else' ? [{ type: 'text', key: 'files.avoid', label: 'any file claude should not use?', placeholder: 'e.g. old_draft.pdf' }] : null,
  })),

  // ---- Extras
  screen('content', 'Extras', 'extras', 'anything special to include?', 'pick what you’d like to see. claude fits it all in neatly.', [
    { type: 'multi', key: 'content.include', label: 'include', default: ['References slide', 'Thank you and questions slide'], options: [
      { value: 'Equations', label: 'Equations' }, { value: 'Tables', label: 'Tables' }, { value: 'Charts from my data', label: 'Charts from my data' },
      { value: 'My photos', label: 'My photos' }, { value: 'Videos', label: 'Videos' }, { value: 'References slide', label: 'References slide' },
      { value: 'Acknowledgements slide', label: 'Thank-you to people' }, { value: 'Thank you and questions slide', label: '“Questions?” end slide' },
      { value: 'Contact details', label: 'My contact details' }] },
    { type: 'select', key: 'content.citations', label: 'citation style', options: [
      { value: '', label: 'claude decides' }, { value: 'IEEE', label: 'IEEE' }, { value: 'APA', label: 'APA' },
      { value: 'Harvard', label: 'Harvard' }, { value: 'My department’s style', label: 'my department’s style' }] },
  ]),
  screen('where', 'Extras', 'extras', 'where will you present?', 'so the slides look sharp on the screen you’ll actually have.', [
    { type: 'multi', key: 'delivery.where', label: 'where', default: ['Projector in a room'], options: [
      { value: 'Projector in a room', label: 'Projector in a room' }, { value: 'Big TV', label: 'Big TV' },
      { value: 'Online meeting', label: 'Online (Zoom, Meet, Teams)' }, { value: 'Phone', label: 'From my phone' }] },
    { type: 'seg', key: 'delivery.offline', label: 'will there be internet?', default: 'No internet - must work offline', stack: true, options: [
      { value: 'No internet - must work offline', label: 'No, or not sure (works offline)' }, { value: 'Internet available', label: 'Yes, there’s internet' }] },
  ]),
  screen('help', 'Extras', 'extras', 'what would help on the day?', 'backups and notes, so nothing can go wrong in the room.', [
    { type: 'multi', key: 'delivery.backups', label: 'backup copies', default: ['PDF'], options: [
      { value: 'PDF', label: 'PDF' }, { value: 'PowerPoint', label: 'PowerPoint' }] },
    { type: 'multi', key: 'delivery.help', label: 'help for you', default: ['Speaker notes'], options: [
      { value: 'Speaker notes', label: 'Speaker notes' }, { value: 'Timed speaker script', label: 'Timed script' }] },
    { type: 'seg', key: 'delivery.clicker', label: 'using a clicker?', default: 'Not sure', options: [
      { value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }, { value: 'Not sure', label: 'Not sure' }] },
  ]),
  screen('extra', 'Extras', 'extras', 'anything else?', 'last chance for wishes, no-gos and deadlines.', [
    { type: 'text', key: 'extra.avoid', label: 'anything claude should avoid?', placeholder: 'e.g. no jokes, no raw data' },
    { type: 'date', key: 'extra.deadline', label: 'when do you need the slides?' },
    { type: 'textarea', key: 'extra.notes', label: 'other notes for claude', rows: 4, placeholder: 'anything at all' },
  ]),

  // ---- Make it
  screen('review', 'Make it', 'review', 'ready when you are', 'here’s what claude will work from. tap anything to change it.', [], { component: 'review' }),
  screen('workshop', 'Make it', 'workshop', 'claude is making your slides', 'this takes a little while. if claude asks something, answer on the right.', [],
    { component: 'workshop' }),
];

// Defaults that live on component screens (no field spec to carry them).
export const EXTRA_DEFAULTS = { 'look.theme': 'Claude chooses', 'style.amountLabel': 'Balanced' };

// Structural starting values (not "suggested" answers).
export const INITIAL = { 'people.presenters': [{ name: '', id: '', role: '' }], 'work.results': [{ what: '', value: '' }] };

export const AMOUNT_LABELS = [[20, 'Minimal'], [45, 'Light'], [70, 'Balanced'], [90, 'Rich'], [100, 'Maximum']];
export const amountLabel = v => (AMOUNT_LABELS.find(([max]) => (+v || 0) <= max) || AMOUNT_LABELS[4])[1];

// The four phases shown on the welcome screen.
export const PHASES = ['tell me about your talk', 'drop in your files', 'pick a look you love', 'claude builds the slides'];
