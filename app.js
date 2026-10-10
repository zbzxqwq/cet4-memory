/* =========================================================================
 *  四级记忆 · 主程序 app.js
 *  纯离线运行：不联网、不上传，学习记录存在本机浏览器里。
 * ========================================================================= */

/* ---------- 1. 解析词库 ---------- */
function scoreDef(e){
  const posCount = (e.def.match(/[a-zA-Z]{1,6}\./g) || []).length;
  return posCount * 1000 + e.def.length;
}
function parseDB(raw){
  const map = new Map();
  String(raw || '').split('\n').forEach(function(line){
    line = line.trim();
    if(!line || line.charAt(0) === '#') return;
    const p = line.split('|');
    if(p.length < 3) return;
    const w = p[0].trim();
    if(!w) return;
    const lvl = parseInt(p[1], 10);
    const def = (p[2] || '').trim();
    if(!def) return;
    const cand = {
      word: w,
      level: (lvl >= 1 && lvl <= 4) ? lvl : 3,
      def: def,
      example: (p[3] || '').replace(/^例[:：]\s*/, '').trim()
    };
    const old = map.get(w);
    if(!old || scoreDef(cand) > scoreDef(old)) map.set(w, cand);
  });
  return Array.from(map.values());
}

const WORDS   = parseDB(window.CET4_RAW);
const BY_WORD = new Map(WORDS.map(function(w){ return [w.word.toLowerCase(), w]; }));

const LEVEL_NAME = {
  1: { t:'核心必考词', c:'l1' },
  2: { t:'高频常考词', c:'l2' },
  3: { t:'常考词',     c:'l3' },
  4: { t:'拓展认知词', c:'l4' }
};

function splitDefs(def){
  return def.split('/').map(function(chunk){
    chunk = chunk.trim();
    const m = chunk.match(/^([a-zA-Z]{1,6}\.)\s*(.*)$/);
    if(m) return { pos:m[1], cn:m[2].trim() };
    return { pos:'', cn:chunk };
  }).filter(function(x){ return x.cn; });
}
function plainDef(e){
  return splitDefs(e.def).map(function(d){ return d.cn; }).join('；');
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ---------- 2. 本地存档 ---------- */
const KEY = 'cet4_memo_v1';
const DEFAULT_STATE = {
  mastered: {}, wrong: {}, seen: {}, plans: {}, dayProgress: {},
  days: [], stars: 0, streakDates: [],
  searchHistory: [],
  settings: { perDay: 50, remindHour: 21 }
};
function loadState(){
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e){ s = {}; }
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Object.keys(st).forEach(function(k){
    if(s[k] !== undefined) st[k] = s[k];
  });
  st.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
  return st;
}
let S = loadState();
function saveState(){
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){}
}

/* ---------- 3. 日期 ---------- */
function dstr(d){
  d = d || new Date();
  const p = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}
const TODAY = dstr();
function todayPlan(){
  if(!S.plans[TODAY]) S.plans[TODAY] = buildPlan(TODAY);
  return S.plans[TODAY];
}
function dayProg(){
  if(!S.dayProgress[TODAY]) S.dayProgress[TODAY] = { done:[], know:[], dunno:[] };
  const p = S.dayProgress[TODAY];
  if(!p.done)  p.done  = [];
  if(!p.know)  p.know  = [];
  if(!p.dunno) p.dunno = [];
  return p;
}

/* ---------- 4. 生成每日计划：高频优先 + 错词强化 ---------- */
function hashSeed(str){
  let h = 2166136261;
  for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededShuffle(arr, seed){
  const a = arr.slice();
  let s = seed || 1;
  function rnd(){ s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s = s >>> 0; return s / 4294967296; }
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function buildPlan(dateStr){
  const n = S.settings.perDay || 50;
  const fresh = [], due = [];
  WORDS.forEach(function(e){
    if(S.mastered[e.word]) return;                                  // 已掌握：永远不再出现
    if(S.wrong[e.word] && S.wrong[e.word].count > 0) due.push(e);   // 不会的词：优先强化
    else fresh.push(e);
  });
  due.sort(function(a, b){ return S.wrong[b.word].count - S.wrong[a.word].count; });

  const seed = hashSeed(dateStr + '_' + n);
  const groups = [[], [], [], []];
  fresh.forEach(function(e){ groups[e.level - 1].push(e); });
  const ordered = [];
  for(let i = 0; i < 4; i++) ordered.push.apply(ordered, seededShuffle(groups[i], seed + i * 7919));

  const plan = [];
  const seen = {};
  const push = function(e){
    if(plan.length >= n) return;
    if(seen[e.word]) return;
    seen[e.word] = 1;
    plan.push(e.word);
  };
  due.forEach(push);
  ordered.forEach(push);
  return plan;
}

/* ---------- 5. 页面切换 ---------- */
function $(id){ return document.getElementById(id); }
const TABS = ['home', 'study', 'wrong', 'bank', 'more'];
function showTab(name){
  TABS.forEach(function(t){
    const v = $('v-' + t);
    if(v) v.classList.toggle('on', t === name);
  });
  document.querySelectorAll('.tabbar button').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab === name);
  });
  if(name === 'wrong') renderWrong();
  if(name === 'bank')  renderBank();
  if(name === 'more')  renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(function(b){
  b.addEventListener('click', function(){
    if(b.dataset.tab === 'study') startSession('daily');
    else showTab(b.dataset.tab);
  });
});

let toastTimer = null;
function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('on'); }, 1900);
}
function celebrate(title, text){
  $('celTitle').textContent = title;
  $('celText').textContent = text;
  $('celebrate').classList.add('on');
}
$('celBtn').addEventListener('click', function(){
  $('celebrate').classList.remove('on');
  showTab('home');
  renderHome();
});

/* ---------- 6. 朗读 ---------- */
function speak(text){
  if(!text) return;
  const mode = (S.settings && S.settings.speakMode) || 'auto';

  // 只用在线发音
  if(mode === 'online'){ playOnline(text); return; }

  // ① 手机：系统自带朗读（不用联网，最快）
  if(window.AndroidHost && typeof window.AndroidHost.speak === 'function'){
    let ok = false;
    try { ok = window.AndroidHost.speak(text); } catch(e){ ok = false; }
    if(ok === true){ return; }
    if(ok === undefined && mode === 'system'){ return; }   // 老版本没有返回值，当作成功
    if(mode === 'system'){ toast('手机自带的朗读用不了，去设置里换成「在线发音」'); return; }
    playOnline(text);                                      // 系统朗读不行 → 在线发音
    return;
  }

  // ② 电脑：浏览器自带朗读
  if(mode === 'system'){
    playWebSpeech(text);
    return;
  }
  // 自动：先试浏览器朗读，1.5 秒没动静就换成在线发音
  if(playWebSpeech(text, function(){ playOnline(text); })) return;
  playOnline(text);
}

/* 浏览器自带朗读；started 回调用于「自动」模式下的兜底 */
function playWebSpeech(text, fallback){
  try{
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    const vs = synth.getVoices().filter(function(v){ return /^en/i.test(v.lang); });
    if(vs.length) u.voice = vs[0];

    let started = false;
    u.onstart = function(){ started = true; };
    u.onerror  = function(){ if(fallback) fallback(); };

    const fire = function(){ try{ synth.speak(u); }catch(e){ if(fallback) fallback(); } };
    // 不要紧跟着 cancel 立刻 speak（有些 Chrome 版本会因此不发声）
    if(synth.speaking || synth.pending){
      synth.cancel();
      setTimeout(fire, 80);
    }else{
      fire();
    }
    if(fallback){
      setTimeout(function(){ if(!started) fallback(); }, 1500);
    }
    return true;
  }catch(e){ return false; }
}

/* 在线发音（有道词典的发音接口），手机和电脑都能用 */
let audioEl = null;
function playOnline(text){
  try{
    if(!audioEl){
      audioEl = new Audio();
      audioEl.preload = 'auto';
    }
    audioEl.pause();
    audioEl.src = 'https://dict.youdao.com/dictvoice?type=2&audio=' + encodeURIComponent(text);
    audioEl.currentTime = 0;
    const pr = audioEl.play();
    if(pr && pr.catch) pr.catch(function(){});
  }catch(e){}
}
$('btnSpeak').addEventListener('click', function(){ if(current) speak(current.word); });

/* ---------- 7. 学习会话 ---------- */
let queue = [];
let current = null;
let sessionTotal = 0;
let sessionKind = 'daily';
let revealed = false;    // 当前这个单词的中文意思是否已经显示
let armedFrom = null;    // 已经点过一次的是哪个按钮：'know' / 'dunno'

function startSession(kind){
  sessionKind = kind || 'daily';
  const prog = dayProg();

  if(sessionKind === 'wrong'){
    const list = Object.keys(S.wrong).filter(function(w){
      return S.wrong[w].count > 0 && !S.mastered[w] && BY_WORD.has(w.toLowerCase());
    });
    if(!list.length){ toast('错词本是空的，真厉害！'); showTab('wrong'); return; }
    list.sort(function(a, b){ return S.wrong[b].count - S.wrong[a].count; });
    queue = list;
  }else{
    const plan = todayPlan();
    const left = plan.filter(function(w){ return prog.done.indexOf(w) < 0; });
    if(!left.length){ toast('今天的单词已经学完啦！🎉'); showTab('home'); return; }
    queue = left.slice();
  }
  sessionTotal = queue.length;
  showTab('study');
  nextCard();
}

function nextCard(){
  if(!queue.length){ finishSession(); return; }
  const w = queue.shift();
  current = BY_WORD.get(String(w).toLowerCase());
  if(!current){ nextCard(); return; }

  const lv = LEVEL_NAME[current.level] || LEVEL_NAME[3];
  $('lvlBadge').textContent = lv.t;
  $('lvlBadge').className = 'lvlbadge ' + lv.c;
  $('wordText').textContent = current.word;

  $('defs').innerHTML = splitDefs(current.def).map(function(d){
    return '<div class="defrow"><span class="pos">' + esc(d.pos || '释义') + '</span>' +
           '<span class="cn">' + esc(d.cn) + '</span></div>';
  }).join('');
  $('example').textContent = current.example || '';
  $('example').style.display = current.example ? 'block' : 'none';

  $('defs').style.display   = 'none';
  $('hiddenBox').style.display = 'block';
  $('judgeRow').style.display  = 'grid';
  revealed = false;
  armedFrom = null;
  $('btnKnow').textContent = '😃 我会了';
  $('btnDunno').textContent = '🤔 还不会';

  $('qCounter').textContent = '第 ' + (sessionTotal - queue.length) + ' / ' + sessionTotal + ' 个';
  $('hintLine').textContent = '先想一想：它是什么意思？';
  $('hiddenBox').style.display = 'block';
  speak(current.word);
  window.scrollTo(0, 0);
}

function reveal(fromBtn){
  if(!current) return;
  $('defs').style.display   = 'block';
  $('hiddenBox').style.display = 'none';
  revealed = true;
  armedFrom = fromBtn || null;
  if(fromBtn === 'know'){
    // 点「我会了」的第一次：先给中文意思，让孩子自己对一对
    $('btnKnow').textContent = '✅ 记住了，继续 →';
    $('hintLine').textContent = '对一对：刚才你想对了吗？再点一次「我会了」就进入下一个';
  }else if(fromBtn === 'dunno'){
    // 点「还不会」的第一次：也先给中文意思，让孩子看一眼再走
    $('btnDunno').textContent = '📖 记一下，继续 →';
    $('hintLine').textContent = '看一眼中文意思，把它记住～再点一次「还不会」就进入下一个';
  }else{
    $('hintLine').textContent = '看完中文意思，再点上面的按钮吧～';
  }
}
$('hiddenBox').addEventListener('click', function(){ reveal(false); });

function answer(know){
  if(!current) return;
  const prog = dayProg();
  const w = current.word;

  if(know){
    S.mastered[w] = Date.now();
    if(prog.know.indexOf(w) < 0) prog.know.push(w);
    delete S.wrong[w];
    S.stars += 1;
  }else{
    const prev = S.wrong[w];
    S.wrong[w] = {
      count: (prev ? prev.count : 0) + 1,
      last:  Date.now(),
      first: (prev && prev.first) ? prev.first : Date.now()
    };
    if(prog.dunno.indexOf(w) < 0) prog.dunno.push(w);
    const at = Math.min(3, queue.length);   // 过 3 个词再回来找它
    queue.splice(at, 0, w);
  }
  if(prog.done.indexOf(w) < 0) prog.done.push(w);
  S.seen[w] = (S.seen[w] || 0) + 1;
  markDay();
  saveState();
  nextCard();
}
$('btnKnow').addEventListener('click', function(){
  if(!current) return;
  // 第一次点：先显示中文意思；第二次点：确实会了，进入下一个
  if(!revealed){ reveal('know'); return; }
  answer(true);
});
$('btnDunno').addEventListener('click', function(){
  if(!current) return;
  // 第一次点：先显示中文意思；第二次点：确认不会，进入下一个
  if(!revealed){ reveal('dunno'); return; }
  toast('好的，它待会儿还会回来～');
  answer(false);
});

function finishSession(){
  current = null;
  if(sessionKind === 'wrong'){ renderWrong(); showTab('wrong'); return; }
  const prog = dayProg();
  const plan = todayPlan();
  const left = plan.filter(function(w){ return prog.done.indexOf(w) < 0; });
  if(left.length) celebrate('休息一下！', '还有 ' + left.length + ' 个单词，接着加油！');
  else celebrate('今天全部学完啦！', '你已经掌握 ' + Object.keys(S.mastered).length + ' 个单词，太厉害了！');
  saveState();
}

function markDay(){
  if(S.days.indexOf(TODAY) < 0) S.days.push(TODAY);
  if(S.streakDates.indexOf(TODAY) < 0) S.streakDates.push(TODAY);
}

/* ---------- 8. 首页 ---------- */
function renderHome(){
  const prog = dayProg();
  const plan = todayPlan();
  const total = plan.length || (S.settings.perDay || 50);
  const done  = plan.filter(function(w){ return prog.done.indexOf(w) >= 0; }).length;
  const left  = Math.max(0, plan.filter(function(w){ return prog.done.indexOf(w) < 0; }).length);

  $('todayDate').textContent = '今天是 ' + TODAY + '　·　学习顺序：核心必考词 → 高频常考词 → 常考词 → 拓展词';
  $('ringDone').textContent = done;
  $('ringTotal').textContent = '/ ' + total;
  $('ringArc').setAttribute('stroke-dashoffset', String(314 - 314 * Math.min(1, done / Math.max(1, total))));
  $('mMasteredToday').textContent = prog.know.length;
  $('mWrongToday').textContent    = prog.dunno.length;
  $('mLeftToday').textContent     = left;
  $('todayTitle').textContent = left ? ('今天还剩 ' + left + ' 个单词') : '今天的任务全部完成！';

  $('sMastered').textContent  = Object.keys(S.mastered).length;
  $('sRest').textContent      = Math.max(0, WORDS.length - Object.keys(S.mastered).length);
  $('sTotalDays').textContent = S.days.length;
  $('sStars').textContent     = S.stars;
  $('streakNum').textContent  = calcStreak();
  $('dbCount').textContent    = WORDS.length;

  const hour = new Date().getHours();
  const b = $('reminderBanner');
  if(left > 0 && hour >= (S.settings.remindHour || 19)){
    b.classList.add('on');
    $('reminderText').textContent = '还剩 ' + left + ' 个单词没有完成。现在学会记得最牢，加油！';
  }else if(left > 0 && prog.done.length > 0){
    b.classList.add('on');
    $('reminderText').textContent = '还剩 ' + left + ' 个单词，继续加油，马上就完成啦！';
  }else{
    b.classList.remove('on');
  }
  $('helloLine').textContent = left ? ('今天还有 ' + left + ' 个单词等你哦') : '今天的单词全部完成啦 🎉';
}

function calcStreak(){
  if(!S.streakDates.length) return 0;
  const set = {};
  S.streakDates.forEach(function(d){ set[d] = 1; });
  let n = 0;
  const d = new Date();
  for(let i = 0; i < 400; i++){
    const k = dstr(d);
    if(set[k]) n++;
    else if(i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------- 9. 错词本 ---------- */
function renderWrong(){
  const list = Object.keys(S.wrong).filter(function(w){
    return S.wrong[w].count > 0 && !S.mastered[w];
  });
  const box = $('wrongList');
  if(!list.length){
    box.innerHTML = '<div class="item ok"><span class="w">🎉</span>' +
                    '<span class="m">错词本是空的，全部记住啦！</span></div>';
    return;
  }
  list.sort(function(a, b){ return S.wrong[b].count - S.wrong[a].count; });
  box.innerHTML = list.map(function(w){
    const e = BY_WORD.get(w.toLowerCase());
    const cn = e ? plainDef(e) : '（词库中没有这个词）';
    const rec = S.wrong[w] || {};
    const t = rec.first || rec.last;
    const day = t ? dstr(new Date(t)) : '';
    return '<div class="item bad"><span class="w">' + esc(w) + '</span>' +
           '<span class="m">' + esc(cn) +
             (day ? '<br><span style="color:#b91c1c;font-weight:700">第一次记错：' + day + '</span>' : '') +
           '</span>' +
           '<span class="tag bad">错了 ' + S.wrong[w].count + ' 次</span></div>';
  }).join('');
}

/* ---------- 10. 词库 ---------- */
/* 单词按首字母 A→Z 排序，支持翻页、字母跳转、搜索记录 */
const BANK = { q: '', letter: '', page: 1, per: 50 };

function firstLetter(w){
  const c = String(w || '').trim().charAt(0).toUpperCase();
  return (c >= 'A' && c <= 'Z') ? c : '其他';
}
function alphaCompare(a, b){
  const x = a.word.toLowerCase(), y = b.word.toLowerCase();
  return x < y ? -1 : (x > y ? 1 : 0);
}
function bankMatched(){
  const kw = BANK.q.trim().toLowerCase();
  if(!kw) return WORDS;
  return WORDS.filter(function(e){
    return e.word.toLowerCase().indexOf(kw) >= 0 || e.def.toLowerCase().indexOf(kw) >= 0;
  });
}
function bankFiltered(){
  let list = bankMatched();
  if(BANK.letter) list = list.filter(function(e){ return firstLetter(e.word) === BANK.letter; });
  return list.slice().sort(alphaCompare);
}

function renderLetterBar(){
  const counts = {};
  bankMatched().forEach(function(e){
    const L = firstLetter(e.word);
    counts[L] = (counts[L] || 0) + 1;
  });
  const letters = [];
  for(let i = 0; i < 26; i++) letters.push(String.fromCharCode(65 + i));
  if(counts['其他']) letters.push('其他');

  let html = '<button class="letterbtn' + (BANK.letter ? '' : ' active') + '" data-l="">全部</button>';
  html += letters.map(function(L){
    return '<button class="letterbtn' + (BANK.letter === L ? ' active' : '') +
           (counts[L] ? '' : ' empty') + '" data-l="' + L + '">' + L + '</button>';
  }).join('');
  $('letterBar').innerHTML = html;
  document.querySelectorAll('#letterBar .letterbtn').forEach(function(b){
    b.addEventListener('click', function(){
      const L = b.dataset.l;
      BANK.letter = (L && BANK.letter === L) ? '' : L;   // 再点一次取消
      BANK.page = 1;
      renderBank();
    });
  });
}

function renderHistory(){
  const h = S.searchHistory || [];
  $('historyWrap').style.display = h.length ? 'flex' : 'none';
  $('historyChips').innerHTML = h.map(function(q){
    return '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + '</button>';
  }).join('');
  document.querySelectorAll('#historyChips .chip').forEach(function(b){
    b.addEventListener('click', function(){
      BANK.q = b.dataset.q;
      BANK.letter = ''; BANK.page = 1;
      renderBank();
    });
  });
}
function recordSearch(q){
  q = String(q || '').trim();
  if(!q) return;
  const h = (S.searchHistory || []).filter(function(x){ return x !== q; });
  h.unshift(q);
  S.searchHistory = h.slice(0, 8);
  saveState();
  renderHistory();
}

function renderBank(){
  if($('searchInput').value !== BANK.q) $('searchInput').value = BANK.q;
  $('btnClearSearch').classList.toggle('on', !!BANK.q);

  const list  = bankFiltered();
  const total = list.length;
  const per   = BANK.per || 50;
  const pages = Math.max(1, Math.ceil(total / per));
  if(BANK.page > pages) BANK.page = pages;
  if(BANK.page < 1)     BANK.page = 1;
  const start = (BANK.page - 1) * per;
  const pageItems = list.slice(start, start + per);

  const scope = BANK.letter ? ('字母 ' + BANK.letter + ' 开头') : '全部单词';
  $('bankSummary').textContent = '共 ' + WORDS.length + ' 个单词，按首字母 A → Z 排序。' +
    (BANK.q ? ('搜索「' + BANK.q + '」找到 ' + total + ' 个。')
            : ('当前显示：' + scope + '，' + total + ' 个。'));

  $('bankList').innerHTML = pageItems.map(function(e){
    const ok = !!S.mastered[e.word];
    return '<div class="item ' + (ok ? 'ok' : '') + '">' +
           '<span class="w">' + esc(e.word) + '</span>' +
           '<span class="m">' + esc(plainDef(e)) + '</span>' +
           (ok ? '<span class="tag ok">已掌握</span>'
               : '<span class="tag" style="background:#eef3ff;color:#3358d4">L' + e.level + '</span>') +
           '</div>';
  }).join('') || '<div class="muted">没有找到这个词～换个字母或换个词试试。</div>';

  $('pageInfo').textContent = '第 ' + BANK.page + ' / ' + pages + ' 页 · 共 ' + total + ' 个';
  $('btnPrevPage').disabled = BANK.page <= 1;
  $('btnNextPage').disabled = BANK.page >= pages;

  document.querySelectorAll('.page-size').forEach(function(x){
    x.classList.toggle('sel', +x.dataset.n === per);
  });
  renderLetterBar();
}

$('searchInput').addEventListener('input', function(){
  BANK.q = $('searchInput').value;
  BANK.page = 1;
  renderBank();
});
$('searchInput').addEventListener('keydown', function(ev){
  if(ev.key === 'Enter'){ recordSearch(BANK.q); BANK.page = 1; renderBank(); }
});
$('searchInput').addEventListener('change', function(){ recordSearch(BANK.q); });
$('searchInput').addEventListener('blur',   function(){ recordSearch(BANK.q); });

$('btnClearSearch').addEventListener('click', function(){
  BANK.q = ''; BANK.page = 1;
  $('searchInput').value = '';
  renderBank();
  $('searchInput').focus();
});
$('btnClearHistory').addEventListener('click', function(){
  if(!(S.searchHistory || []).length) return;
  S.searchHistory = [];
  saveState();
  renderHistory();
  toast('搜索记录已删除');
});
$('btnPrevPage').addEventListener('click', function(){
  BANK.page--; renderBank(); window.scrollTo(0, 0);
});
$('btnNextPage').addEventListener('click', function(){
  BANK.page++; renderBank(); window.scrollTo(0, 0);
});
document.querySelectorAll('.page-size').forEach(function(b){
  b.addEventListener('click', function(){
    BANK.per = +b.dataset.n;
    BANK.page = 1;
    renderBank();
    toast('每页显示 ' + b.dataset.n + ' 个单词');
  });
});

/* ---------- 11. 设置 ---------- */
/* 换挡位时重新排今天的计划：已经学过的单词一个都不丢 */
function retargetPlan(newCount){
  const old  = todayPlan();          // 确保今天的计划已经存在
  const prog = dayProg();
  const doneSet = {};
  prog.done.forEach(function(w){ doneSet[w] = 1; });

  const keep = old.filter(function(w){ return doneSet[w]; });    // 已学过的，永远保留
  const rest = old.filter(function(w){ return !doneSet[w]; });   // 还没学的

  let plan;
  if(old.length >= newCount){
    // 调小：保留已学过的，再用还没学的补到新数量（补不满就以已学过的为准）
    const need = Math.max(0, newCount - keep.length);
    plan = keep.concat(rest.slice(0, need));
  }else{
    // 调大：保留原计划，再补一批新词
    plan = keep.concat(rest);
    const used = {};
    plan.forEach(function(w){ used[w] = 1; });
    const more = WORDS.filter(function(e){
      return !S.mastered[e.word] && !used[e.word];
    }).sort(function(a, b){
      if(a.level !== b.level) return a.level - b.level;
      const x = a.word.toLowerCase(), y = b.word.toLowerCase();
      return x < y ? -1 : (x > y ? 1 : 0);
    }).slice(0, newCount - plan.length).map(function(e){ return e.word; });
    plan = plan.concat(more);
  }
  S.plans[TODAY] = plan;
}

function renderSettings(){
  document.querySelectorAll('.daily-opt').forEach(function(b){
    b.classList.toggle('sel', +b.dataset.n === +S.settings.perDay);
  });
  document.querySelectorAll('.time-opt').forEach(function(b){
    b.classList.toggle('sel', +b.dataset.t === +S.settings.remindHour);
  });
  $('nowTimeSet').textContent =
    (S.settings.remindHour < 10 ? '0' : '') + S.settings.remindHour + ':00';

  // 发音方式
  const sm = S.settings.speakMode || 'auto';
  document.querySelectorAll('.speak-opt').forEach(function(b){
    b.classList.toggle('sel', b.dataset.v === sm);
  });
  $('speakHint').innerHTML =
    sm === 'system' ? '只用手机／电脑自带的朗读，<b>不需要上网</b>。如果点了没声音，说明系统缺英文语音包，换成「在线发音」。'
  : sm === 'online' ? '每次都用<b>在线发音</b>（需要上网），声音更清楚，手机电脑都一样。'
                    : '先试自带的朗读；<b>1.5 秒内没出声就自动改用在线发音</b>（需要上网）。';
}
document.querySelectorAll('.daily-opt').forEach(function(b){
  b.addEventListener('click', function(){
    const n = +b.dataset.n;
    S.settings.perDay = n;
    retargetPlan(n);                       // 换挡时重新排今天的计划，已学过的不清零
    saveState();
    renderSettings();
    renderHome();
    const prog = dayProg();
    const plan = todayPlan();
    const doneCount = plan.filter(function(w){ return prog.done.indexOf(w) >= 0; }).length;
    toast('每天学习 ' + n + ' 个单词' + (doneCount ? ('，已学的 ' + doneCount + ' 个保留') : ''));
  });
});
document.querySelectorAll('.time-opt').forEach(function(b){
  b.addEventListener('click', function(){
    S.settings.remindHour = +b.dataset.t;
    saveState();
    renderSettings();
    toast('提醒时间设为 ' + b.textContent.trim());
  });
});

document.querySelectorAll('.speak-opt').forEach(function(b){
  b.addEventListener('click', function(){
    S.settings.speakMode = b.dataset.v;
    saveState();
    renderSettings();
    toast('发音方式：' + b.textContent.trim());
    setTimeout(function(){ speak('campus'); }, 120);
  });
});
$('btnTestSpeak').addEventListener('click', function(){
  speak('campus');
  toast('听不到声音？把「发音方式」换成「在线发音」再试');
});

/* ---------- 12. 导出 Word（真正的 .docx，手机 WPS 也能正常显示表格） ---------- */
let CRC_TABLE = null;
function crc32(bytes){
  if(!CRC_TABLE){
    const t = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    CRC_TABLE = t;
  }
  let crc = 0xFFFFFFFF;
  for(let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* 把一个 zip 写出来。entries: [{name, raw, comp}]，comp 为 null 时用「不压缩」存 */
function zipAssemble(entries){
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = function(n){ return [n & 255, (n >>> 8) & 255]; };
  const u32 = function(n){ return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; };

  entries.forEach(function(e){
    const nameBytes = enc.encode(e.name);
    const raw = e.raw;
    const comp = e.comp || null;
    const crc = crc32(raw);
    const method = comp ? 8 : 0;
    const csize = comp ? comp.length : raw.length;
    const hdr = [].concat(
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0),
      u32(crc), u32(csize), u32(raw.length),
      u16(nameBytes.length), u16(0)
    );
    parts.push(new Uint8Array(hdr), nameBytes, comp || raw);
    central.push({ name: nameBytes, crc: crc, csize: csize, usize: raw.length, method: method, offset: offset });
    offset += hdr.length + nameBytes.length + csize;
  });

  const cdStart = offset;
  central.forEach(function(c){
    const h = [].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(c.method), u16(0), u16(0),
      u32(c.crc), u32(c.csize), u32(c.usize),
      u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset)
    );
    parts.push(new Uint8Array(h), c.name);
    offset += h.length + c.name.length;
  });

  parts.push(new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(offset - cdStart), u32(cdStart), u16(0)
  )));

  let total = 0;
  parts.forEach(function(p){ total += p.length; });
  const out = new Uint8Array(total);
  let pos = 0;
  parts.forEach(function(p){ out.set(p, pos); pos += p.length; });
  return out;
}

/* 尽量用浏览器自带的压缩；不支持就退回「不压缩」 */
async function zipCompress(entries){
  if(typeof CompressionStream !== 'function') return null;
  const out = [];
  for(let i = 0; i < entries.length; i++){
    const cs = new CompressionStream('deflate-raw');
    const buf = await new Response(
      new Blob([entries[i].raw]).stream().pipeThrough(cs)
    ).arrayBuffer();
    out.push({ name: entries[i].name, raw: entries[i].raw, comp: new Uint8Array(buf) });
  }
  return out;
}

function escXml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* rows: [[左列, 右列], ...]  —— 左列大字号，右列留白（或写中文） */
async function makeDocxBytes(rows, opts){
  opts = opts || {};
  const leftSz  = opts.leftSz  || 36;     // 单位是半磅，36 = 18pt
  const rightSz = opts.rightSz || 22;
  const bold    = !!opts.header;
  const enc = new TextEncoder();
  let body = '';
  for(let i = 0; i < rows.length; i++){
    const left  = escXml(rows[i][0]);
    const right = escXml(rows[i][1] || '');
    const b = (bold && i === 0) ? '<w:b/>' : '';
    body +=
      '<w:tr><w:trPr><w:trHeight w:val="800" w:hRule="atLeast"/></w:trPr>' +
      '<w:tc><w:tcPr><w:tcW w:w="3800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
      '<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' +
      b + '<w:sz w:val="' + leftSz + '"/><w:szCs w:val="' + leftSz + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + left + '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>' +
      '<w:p><w:r><w:rPr>' + b + '<w:sz w:val="' + rightSz + '"/><w:szCs w:val="' + rightSz + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + right + '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>';
  }

  const docXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    '<w:tbl><w:tblPr><w:tblW w:w="8600" w:type="dxa"/><w:tblBorders>' +
    '<w:top w:val="single" w:sz="8" w:color="000000"/>' +
    '<w:left w:val="single" w:sz="8" w:color="000000"/>' +
    '<w:bottom w:val="single" w:sz="8" w:color="000000"/>' +
    '<w:right w:val="single" w:sz="8" w:color="000000"/>' +
    '<w:insideH w:val="single" w:sz="8" w:color="000000"/>' +
    '<w:insideV w:val="single" w:sz="8" w:color="000000"/>' +
    '</w:tblBorders></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="3800"/><w:gridCol w:w="4800"/></w:tblGrid>' +
    body +
    '</w:tbl><w:p/><w:sectPr>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const entries = [
    { name: '[Content_Types].xml', raw: enc.encode(contentTypes) },
    { name: '_rels/.rels',         raw: enc.encode(rels) },
    { name: 'word/document.xml',   raw: enc.encode(docXml) }
  ];
  try{
    const packed = await zipCompress(entries);
    if(packed) return zipAssemble(packed);
  }catch(e){}
  return zipAssemble(entries);      // 保底：不压缩也一定是对的
}

/* 存文件：电脑走浏览器下载，手机走安卓接口（二进制用 base64 传） */
function saveDocxFile(bytes, filename){
  const name = filename + '_' + TODAY + '.docx';
  const type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if(window.AndroidHost && typeof window.AndroidHost.saveBinary === 'function'){
    try{
      const fr = new FileReader();
      fr.onload = function(){
        try{
          const b64 = String(fr.result).split(',')[1] || '';
          window.AndroidHost.saveBinary(name, b64);
        }catch(e){}
      };
      fr.readAsDataURL(new Blob([bytes], { type: type }));
      return;
    }catch(e){}
  }
  const blob = new Blob([bytes], { type: type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
}

function exportDoc(words, title, filename, withMeaning){
  if(!words.length){ toast('没有可以导出的单词'); return; }
  const rows = words.map(function(w){ return [w, '']; });
  toast('正在生成 Word 表格…');
  makeDocxBytes(rows).then(function(bytes){
    saveDocxFile(bytes, filename);
    toast('已导出 ' + words.length + ' 个单词');
  }).catch(function(){
    toast('导出失败，请再试一次');
  });
}

/* 错词表：两列 —— 日期（第一次记错） + 单词 */
function exportWrongDoc(){
  const list = Object.keys(S.wrong).filter(function(w){ return !S.mastered[w]; });
  if(!list.length){ toast('错词本是空的，没有可以导出的单词'); return; }

  const rows = list.map(function(w){
    const rec = S.wrong[w] || {};
    const t = rec.first || rec.last;
    return { word: w, date: t ? dstr(new Date(t)) : '' };
  });
  rows.sort(function(a, b){
    if(a.date !== b.date) return a.date < b.date ? -1 : 1;
    const x = a.word.toLowerCase(), y = b.word.toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  });

  const head = '<tr><th style="width:150px">日期</th><th>单词</th></tr>';
  const firstDay = rows[0].date, lastDay = rows[rows.length - 1].date;
  const span = (firstDay && lastDay && firstDay !== lastDay)
    ? (firstDay + ' 至 ' + lastDay)
    : (firstDay || '');
  const table = [['日期', '单词']];
  rows.forEach(function(r){ table.push([r.date || '—', r.word]); });
  makeDocxBytes(table, { leftSz: 24, rightSz: 28, header: true }).then(function(bytes){
    saveDocxFile(bytes, '四级错词表');
    toast('已导出 ' + rows.length + ' 个错词');
  }).catch(function(){
    toast('导出失败，请再试一次');
  });
}

function planWords(){ return todayPlan(); }
function wrongWords(){ return Object.keys(S.wrong).filter(function(w){ return !S.mastered[w]; }); }
function masteredWords(){ return Object.keys(S.mastered); }

$('btnExportToday').addEventListener('click', function(){
  exportDoc(planWords(), '四级记忆 · 今日单词表', '四级今日单词表', false);
});
$('btnExportWrong').addEventListener('click', function(){
  exportWrongDoc();
});
$('btnExportWrong2').addEventListener('click', function(){
  exportWrongDoc();
});
$('btnExportAll').addEventListener('click', function(){
  const all = WORDS.slice().sort(function(a, b){
    if(a.level !== b.level) return a.level - b.level;
    return a.word.localeCompare(b.word);
  }).map(function(e){ return e.word; });
  exportDoc(all, '四级记忆 · 全部单词表', '四级全部单词表', false);
});
$('btnExportMastered').addEventListener('click', function(){
  exportDoc(masteredWords().sort(), '四级记忆 · 已掌握单词', '四级已掌握单词表', false);
});

/* ---------- 13. 其他按钮 ---------- */
$('btnStart').addEventListener('click',     function(){ startSession('daily'); });
$('btnReview').addEventListener('click',    function(){ startSession('wrong'); });
$('btnStudyWrong').addEventListener('click',function(){ startSession('wrong'); });
$('btnBackHome').addEventListener('click',  function(){ showTab('home'); renderHome(); });

$('btnReset').addEventListener('click', function(){
  if(confirm('确定要清空所有学习记录吗？这个操作不能撤销。\n（建议先导出 Word 表格留档）')){
    S = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    renderHome(); renderWrong(); renderSettings();
    toast('已清空，重新开始！');
  }
});

$('btnAskNotify').addEventListener('click', function(){
  if(!('Notification' in window)){ toast('这个浏览器不支持弹窗提醒'); return; }
  Notification.requestPermission().then(function(p){
    if(p === 'granted'){
      toast('好的！以后到了提醒时间会通知你');
      new Notification('四级记忆', { body:'提醒功能已打开，加油背单词！', icon:'icon-192.png' });
    }else{
      toast('没有打开弹窗提醒也没关系，打开程序会提醒你');
    }
  });
});

/* ---------- 13.5 学习记录导出 / 导入（给 Codex 技能用） ---------- */
function progressSnapshot(){
  const mastered = Object.keys(S.mastered);
  const wrongMap = {};
  Object.keys(S.wrong).forEach(function(w){
    if(!S.mastered[w]) wrongMap[w] = S.wrong[w].count;
  });
  const wrongDates = {};
  Object.keys(S.wrong).forEach(function(w){
    const r = S.wrong[w] || {};
    const t = r.first || r.last;
    if(!S.mastered[w] && t) wrongDates[w] = dstr(new Date(t));
  });
  const plans = {};
  Object.keys(S.plans).forEach(function(d){ plans[d] = S.plans[d]; });
  const dayProgress = {};
  Object.keys(S.dayProgress).forEach(function(d){
    const p = S.dayProgress[d];
    dayProgress[d] = {
      done:  (p.done  || []).slice(),
      know:  (p.know  || []).slice(),
      dunno: (p.dunno || []).slice()
    };
  });
  return {
    app: '四级记忆',
    version: 1,
    exportedAt: new Date().toISOString(),
    today: TODAY,
    settings: S.settings,
    stars: S.stars,
    studyDays: S.days,
    masteredWords: mastered,
    wrongWords: wrongMap,
    wrongDates: wrongDates,
    plans: plans,
    dayProgress: dayProgress
  };
}
$('btnSaveProgress').addEventListener('click', function(){
  const text = JSON.stringify(progressSnapshot(), null, 2);
  const name = '四级学习记录_' + TODAY + '.json';
  if(window.AndroidHost && typeof window.AndroidHost.saveDoc === 'function'){
    try { window.AndroidHost.saveDoc(name, text); return; } catch(e){}
  }
  const blob = new Blob([text], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast('学习记录已导出');
});
$('btnLoadProgress').addEventListener('click', function(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = function(){
    const f = inp.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = function(){
      try{ importSnapshotObject(JSON.parse(rd.result)); }
      catch(e){ toast('这个文件读不出来，请选择正确的学习记录文件'); }
    };
    rd.readAsText(f, 'utf-8');
  };
  inp.click();
});

/* ---------- 14. 启动 ---------- */
/* ---------------- 13.7 用文件搬运学习记录（蓝牙 / 数据线 / 微信） ---------------- */

/* 把对方（手机或电脑）的进度合并进来：只加不减，绝不丢本地的进度 */
function mergeSnapshot(remote){
  if(!remote || typeof remote !== 'object') return false;
  let changed = false;

  (remote.masteredWords || []).forEach(function(w){
    if(!S.mastered[w]){ S.mastered[w] = Date.now(); changed = true; }
  });

  const ww = remote.wrongWords || {};
  const wd = remote.wrongDates || {};
  Object.keys(ww).forEach(function(w){
    if(S.mastered[w]) return;
    const cur = S.wrong[w];
    const cnt = Math.max(cur ? cur.count : 0, ww[w] | 0);
    if(!cur || cur.count !== cnt){
      let first = (cur && cur.first) ? cur.first : 0;
      if(!first && wd[w]) first = new Date(wd[w] + 'T09:00:00').getTime();
      if(!first && cur && cur.last) first = cur.last;
      S.wrong[w] = { count: cnt, last: Date.now(), first: first || Date.now() };
      changed = true;
    }
  });

  (remote.studyDays || []).forEach(function(d){
    if(S.days.indexOf(d) < 0){ S.days.push(d); changed = true; }
    if(S.streakDates.indexOf(d) < 0) S.streakDates.push(d);
  });

  if(typeof remote.stars === 'number' && remote.stars > S.stars){ S.stars = remote.stars; changed = true; }

  // 每天的单词计划：本地没有的日期才采用对方的
  const rp = remote.plans || {};
  Object.keys(rp).forEach(function(d){
    if(!S.plans[d] && Array.isArray(rp[d])){ S.plans[d] = rp[d]; changed = true; }
  });
  // 每天的完成情况：按单词合并
  const rd = remote.dayProgress || {};
  Object.keys(rd).forEach(function(d){
    const r = rd[d] || {};
    if(!S.dayProgress[d]) S.dayProgress[d] = { done:[], know:[], dunno:[] };
    const l = S.dayProgress[d];
    ['done', 'know', 'dunno'].forEach(function(k){
      if(!l[k]) l[k] = [];
      (Array.isArray(r[k]) ? r[k] : []).forEach(function(w){
        if(l[k].indexOf(w) < 0){ l[k].push(w); changed = true; }
      });
    });
  });

  return changed;
}

/* 把一份学习记录合进来（文件导入、以及手机蓝牙收到文件后都走这里） */
function importSnapshotObject(d){
  try{
    const changed = mergeSnapshot(d);
    saveState();
    renderHome(); renderWrong(); renderBank(); renderSettings();
    toast(changed ? '已导入学习记录 ✅' : '这份记录和现在的一样');
    return changed;
  }catch(e){
    toast('这份记录读不出来，请选择正确的学习记录文件');
    return false;
  }
}

/* 安卓版：用蓝牙收到 .json 文件后点开，会自动调用这里 */
window.__importText = function(text){
  try { return importSnapshotObject(JSON.parse(text)); }
  catch(e){ toast('这份记录读不出来'); return false; }
};

function checkReminder(){
  const hour = new Date().getHours();
  const plan = todayPlan();
  const prog = dayProg();
  const left = plan.filter(function(w){ return prog.done.indexOf(w) < 0; });
  if(left.length && hour >= (S.settings.remindHour || 19)){
    if('Notification' in window && Notification.permission === 'granted'){
      try{
        new Notification('四级记忆 · 今日提醒', {
          body:'还有 ' + left.length + ' 个单词没有学完，快去完成今天的任务吧！',
          icon:'icon-192.png'
        });
      }catch(e){}
    }
  }
}

showTab('home');
renderHome();
renderSettings();
renderWrong();
renderHistory();
checkReminder();
setInterval(checkReminder, 10 * 60 * 1000);

/* ---------- 15. PWA（可选，安装后才能离线打开） ---------- */
if('serviceWorker' in navigator && location.protocol.indexOf('http') === 0){
  navigator.serviceWorker.register('sw.js').catch(function(){});
}
