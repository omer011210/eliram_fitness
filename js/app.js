/* Couple workout & nutrition plan — vanilla JS, no build step.
 * State lives in one object (localStorage = offline cache). Optional Firebase
 * sync (js/sync.js) and a compressed share-link (#s=...) sit on top of it. */
(function(){
  'use strict';

  // ---------- helpers ----------
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function ymd(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var seq = 0;
  function uid(p){ return p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6); }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} }
  function debounce(fn, ms){ var t; return function(){ clearTimeout(t); t = setTimeout(fn, ms); }; }

  var LS = { state:'ef-state-v1', dirty:'ef-dirty-v1', me:'ef-me', only:'ef-only-mine', theme:'ef-theme', pair:'ef-pair' };

  // ---------- calendar ----------
  var DAYS = [
    {id:'sun', label:'יום א׳', full:'יום ראשון'},
    {id:'mon', label:'יום ב׳', full:'יום שני'},
    {id:'tue', label:'יום ג׳', full:'יום שלישי'},
    {id:'wed', label:'יום ד׳', full:'יום רביעי'},
    {id:'thu', label:'יום ה׳', full:'יום חמישי'},
    {id:'fri', label:'יום ו׳', full:'יום שישי'},
    {id:'sat', label:'יום ש׳', full:'שבת'}
  ];
  function weekStart(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); }
  function curWeek(){ return ymd(weekStart()); }
  function dateOfDay(i){ var s = weekStart(); return new Date(s.getFullYear(), s.getMonth(), s.getDate() + i); }
  function todayIdx(){ return new Date().getDay(); }

  // ---------- workout templates ----------
  function R(n,s,r,t){ return {name:n, sets:s||'', reps:r||'', note:t||''}; }
  var TPL = {
    A:{title:'אימון A',focus:'חזה, כתפיים, יד אחורית',meta:"עד 60 דק'",rows:[
      R('לחיצת חזה במוט / משקולות','4','8–12','שכמות יציבות וצמודות'),
      R('פרפר במשקולות / כבלים','3','10–12','כיווץ מבוקר, כיפוף קל במרפקים'),
      R('לחיצת כתפיים בישיבה / עמידה','3','8–12','גב זקוף, ליבה מוחזקת'),
      R('הרחקה לצדדים / ארנולד פרס','3','12–15','תנועה נקייה ללא תנופה'),
      R('פשיטת מרפקים בפולי / כבל','3','10–12','מרפקים מקובעים לצדי הגוף')]},
    B:{title:'אימון B',focus:'גב ויד קדמית',meta:"כ-40 דק'",rows:[
      R('מתח (Pull-ups)','4','6–10','טכניקה מלאה, גומייה לפי צורך'),
      R('פולי עליון באחיזה רחבה','3','8–12','משיכה לחזה עליון, שחרור איטי'),
      R('חתירה במכונה / משקולות','3','8–12','גב ישר, משיכה לכיוון האגן'),
      R('פייס פול / הרחקה אופקית','3','12–15','כתף אחורית ומקרבי שכמות'),
      R('כפיפת מרפקים במוט / משקולות','3','10–12','בידוד מלא של היד הקדמית'),
      R('כפיפת מרפקים אחיזת פטישים','3','10–12','עבודה על הזרוע והאמה')]},
    C:{title:'אימון C',focus:'רגליים, חיזוק ברכיים ובטן',meta:"עד 60 דק'",rows:[
      R('סקוואט (מוט / משקולות)','3–4','8–12','ירידה מבוקרת, ברכיים לכיוון האצבעות'),
      R('דדליפט רומני (RDL)','3','10–12','חיזוק המסטרינג, גב ישר לחלוטין'),
      R('מכרעים לאחור','3',"10 לרגל",'הפחתת עומס מפיקת הברך, חיזוק מייצבים'),
      R('פשיטת ברכיים במכונה','3','12–15','מנעד מבוקר, חיזוק ממוקד'),
      R('עליות מדרגה מבוקרות','3',"10 לרגל","דחיפה מהעקב, ירידה איטית (3 שנ')"),
      R('פלאנק / הרמת רגליים בתלייה','3',"45–60 שנ' / 12–15",'יציבות ליבה, אגן ניטרלי')]},
    RUN1:{title:'ריצה 1',focus:'ריצה קלה מיד אחרי אימון B',meta:"20 דק'",rows:[
      R('חימום מפרקי: קרסוליים וארבע-ראשי','','','לפני הריצה'),R('ריצה קלה','',"20 דק'",'')]},
    RUN2:{title:'ריצה 2',focus:'קצב קל-בינוני · בוקר או ערב, לפי הנוחות',meta:"25–60 דק'",rows:[
      R('חימום מפרקי: קרסוליים וארבע-ראשי','','','לפני הריצה'),R('ריצה קלה-בינונית','',"25–60 דק'",'')]},
    HIIT:{title:'HIIT — אימון מחזורי',focus:"40 שנ' עבודה עצימה, 20 שנ' מנוחה · 4–5 סיבובים",meta:"30–40 דק'",rows:[
      R('סווינגים','',"40 שנ'"),R('טרסטרס','',"40 שנ'"),R('קפיצות בחבל','',"40 שנ'"),R('ברפיז','',"40 שנ'"),
      R('ספרינטים','',"40 שנ'"),R('סקוואטים ומכרעים בקפיצה','',"40 שנ'"),R('אופציה: אתגר Murph')]},
    HIITS:{title:'HIIT קצר',focus:"סיום ליום הריצה · 40 שנ' עבודה, 20 שנ' מנוחה",meta:"15 דק'",rows:[
      R('סווינגים','',"40 שנ'"),R('קפיצות בחבל','',"40 שנ'"),R('ברפיז','',"40 שנ'")]},
    STRETCH:{title:'פעילות מתונה / מתיחות',focus:'יום עבודה עמוס — ללא אימון עצים',meta:"15 דק' (רשות)",rows:[R('מתיחות לשחרור','',"15 דק'",'רשות')]},
    REST:{title:'מנוחה מלאה',focus:'התאוששות, תזונה ושינה איכותית',meta:'—',rows:[]},
    BLANK:{title:'אימון חדש',focus:'',meta:'',rows:[R('')]}
  };
  var DEF = {sun:['A'],mon:['B','RUN1'],tue:['REST'],wed:['C'],thu:['HIIT'],fri:['STRETCH'],sat:['RUN2','HIITS']};
  var CHIPS = [['BLANK','כרטיסייה ריקה'],['A','אימון A'],['B','אימון B'],['C','אימון C'],['RUN1','ריצה'],['HIIT','HIIT'],['STRETCH','מתיחות'],['REST','מנוחה']];

  function withIds(card){
    card.id = card.id || uid('c');
    card.rows = (card.rows || []).map(function(r){ return {id:r.id || uid('r'), name:r.name||'', sets:r.sets||'', reps:r.reps||'', note:r.note||''}; });
    card.title = card.title || ''; card.meta = card.meta || ''; card.focus = card.focus || '';
    card.hidden = !!card.hidden;
    return card;
  }
  function fromTpl(k){ var c = clone(TPL[k]); delete c.id; return withIds(c); }
  function defaultPlan(){ var o = {}; DAYS.forEach(function(d){ o[d.id] = DEF[d.id].map(fromTpl); }); return o; }

  // ---------- nutrition defaults ('a'/'b' = the two profiles) ----------
  var DEFAULT_MEALS = [
    { id:'breakfast', title:'ארוחת בוקר', time:"3 דק' · אפס בישול", water:1, toggle:true,
      options:{
        a:{label:'אופציה A · יוגורט ופרי', whos:[
          {p:'a', g:'~25 גרם חלבון', text:'גביע יוגורט חלבון (20 גרם חלבון) + פרי חתוך + 15 שקדים/אגוזים.'},
          {p:'b', g:'~20 גרם חלבון', text:'גביע יוגורט חלבון (20 גרם חלבון) + פרי חתוך + 8 שקדים/אגוזים.'}
        ]},
        b:{label:'אופציה B · כריך מהיר', whos:[
          {p:'a', g:'~25 גרם חלבון', text:"2 פרוסות לחם מלא + קופסת טונה קטנה (או 3 כפות גבינה 5%/קוטג') + ירק שטוף בצד."},
          {p:'b', g:'~18–20 גרם חלבון', text:"פרוסת לחם מלא + 3/4 קופסת טונה (או 2 כפות גבינה/קוטג') + ירק שטוף בצד."}
        ]}
      }
    },
    { id:'snack', title:'ארוחת ביניים / לפני אימון', time:'דקה אחת · ללא הכנה', water:1, toggle:false,
      whos:[{label:'לשניכם', span:true, text:'1–2 תמרים + 5 שקדים — לזמינות אנרגיה מהירה לפני אימון.'}]
    },
    { id:'lunch', title:'ארוחת צהריים', time:"10 דק' · סלט עשיר במרכז", water:2, toggle:false,
      whos:[
        {label:'בסיס משותף', span:true, text:'קערה גדולה: ירקות חתוכים (מלפפון, עגבנייה, גמבה, חסה/עלי בייבי, בצל) + כף שמן זית/טחינה, לימון ומלח.'},
        {p:'a', g:'~40 גרם חלבון', text:'130–150 גרם חזה עוף/סלמון/הודו (או 180 גרם טופו) + כוס אורז מלא/קינואה/בטטה אפויה.'},
        {p:'b', g:'~25–30 גרם חלבון', text:'90–100 גרם חזה עוף/סלמון/הודו (או 120 גרם טופו) + חצי כוס אורז מלא/קינואה/בטטה אפויה.'}
      ]
    },
    { id:'dinner', title:'ארוחת ערב', time:"10 דק' · חמה וקלה אחרי אימון", water:1, toggle:true,
      options:{
        a:{label:'אופציה A · ביצים וגבינה', whos:[
          {p:'a', g:'~30 גרם חלבון', text:"3 ביצים (חביתה/שקשוקה/קשות) + חצי גביע קוטג' 5% (או 2 פרוסות צהובה 9%) + 2 פרוסות לחם מלא + ירק בצד."},
          {p:'b', g:'~20 גרם חלבון', text:"2 ביצים + רבע גביע קוטג' 5% (או פרוסת צהובה 9%) + פרוסת לחם מלא + ירק בצד."}
        ]},
        b:{label:'אופציה B · מוקפץ מהיר', whos:[
          {p:'a', g:'~35 גרם חלבון', text:'120 גרם רצועות חזה עוף/טופו + לקט ירקות קפואים מוקפצים.'},
          {p:'b', g:'~20 גרם חלבון', text:'80 גרם רצועות חזה עוף/טופו + לקט ירקות קפואים מוקפצים.'}
        ]}
      }
    }
  ];
  var MEAL_BY_ID = {}; DEFAULT_MEALS.forEach(function(m){ MEAL_BY_ID[m.id] = m; });

  // ---------- state ----------
  var DEFAULT_NAMES = {a:'אלירם', b:'דוריאן'};
  function defaultState(){
    return {v:1, profiles:clone(DEFAULT_NAMES), plan:defaultPlan(), nutri:{}, done:{a:{}, b:{}}, logs:{a:{}, b:{}}};
  }
  function isObj(o){ return o && typeof o === 'object' && !Array.isArray(o); }
  function normalize(s){
    var d = defaultState();
    if(!isObj(s)) return d;
    var out = {v:1};
    out.profiles = isObj(s.profiles) ? {a:String(s.profiles.a || DEFAULT_NAMES.a).slice(0,24), b:String(s.profiles.b || DEFAULT_NAMES.b).slice(0,24)} : d.profiles;
    out.plan = {};
    DAYS.forEach(function(day){
      var list = isObj(s.plan) && Array.isArray(s.plan[day.id]) ? s.plan[day.id] : d.plan[day.id];
      out.plan[day.id] = list.filter(isObj).map(withIds);
    });
    out.nutri = {};
    if(isObj(s.nutri)) DAYS.forEach(function(day){ if(isObj(s.nutri[day.id])) out.nutri[day.id] = s.nutri[day.id]; });
    out.done = {a:isObj(s.done) && isObj(s.done.a) ? s.done.a : {}, b:isObj(s.done) && isObj(s.done.b) ? s.done.b : {}};
    out.logs = {a:isObj(s.logs) && isObj(s.logs.a) ? s.logs.a : {}, b:isObj(s.logs) && isObj(s.logs.b) ? s.logs.b : {}};
    return out;
  }

  var hadLocalState = false;
  var state = (function(){
    var raw = lsGet(LS.state);
    if(raw){ try{ hadLocalState = true; return normalize(JSON.parse(raw)); }catch(e){} }
    return defaultState();
  })();
  var freshDevice = !hadLocalState;

  // Sync fields: each is stored as its own JSON string, so the two phones rarely overwrite each other
  var FIELDS = {
    profiles:{get:function(){ return state.profiles; }, set:function(v){ state.profiles = v; }},
    plan:    {get:function(){ return state.plan; },     set:function(v){ state.plan = v; }},
    nutri:   {get:function(){ return state.nutri; },    set:function(v){ state.nutri = v; }},
    done_a:  {get:function(){ return state.done.a; },   set:function(v){ state.done.a = v; }},
    done_b:  {get:function(){ return state.done.b; },   set:function(v){ state.done.b = v; }},
    logs_a:  {get:function(){ return state.logs.a; },   set:function(v){ state.logs.a = v; }},
    logs_b:  {get:function(){ return state.logs.b; },   set:function(v){ state.logs.b = v; }}
  };
  var FIELD_NAMES = Object.keys(FIELDS);
  var lastStr = {};
  FIELD_NAMES.forEach(function(f){ lastStr[f] = JSON.stringify(FIELDS[f].get()); });
  var dirty = (function(){ try{ return JSON.parse(lsGet(LS.dirty)) || {}; }catch(e){ return {}; } })();

  function saveLocal(){ lsSet(LS.state, JSON.stringify(state)); hadLocalState = true; }
  // Call after every change to `state`: persists and marks changed fields for sync
  function commit(){
    var changed = false;
    FIELD_NAMES.forEach(function(f){
      var s = JSON.stringify(FIELDS[f].get());
      if(s !== lastStr[f]){ lastStr[f] = s; dirty[f] = (dirty[f] || 0) + 1; changed = true; }
    });
    saveLocal();
    if(changed){ lsSet(LS.dirty, JSON.stringify(dirty)); Sync.schedulePush(); }
  }

  // ---------- device prefs ----------
  var me = lsGet(LS.me); if(me !== 'a' && me !== 'b') me = null;
  var onlyMine = lsGet(LS.only) === '1';
  var viewP = me || 'a';
  var viewDay = todayIdx();
  function pname(p){ return (state.profiles && state.profiles[p]) || DEFAULT_NAMES[p]; }
  function other(p){ return p === 'a' ? 'b' : 'a'; }

  function applyBodyClasses(){
    var b = document.body;
    b.classList.toggle('only-mine', !!(onlyMine && me));
    b.classList.toggle('me-a', me === 'a');
    b.classList.toggle('me-b', me === 'b');
  }

  // ---------- toast ----------
  var toastT;
  function toast(msg, btnLabel, onBtn, ms){
    var el = $('#toast'), btn = $('#toastBtn');
    $('#toastText').textContent = msg;
    btn.hidden = !btnLabel;
    btn.textContent = btnLabel || '';
    btn.onclick = function(){ el.classList.remove('show'); if(onBtn) onBtn(); };
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function(){ el.classList.remove('show'); }, ms || (btnLabel ? 9000 : 2600));
  }

  // Re-render a region without yanking focus/keyboard from someone typing in it
  var deferred = new Map();
  function renderSafe(region, fn){
    var a = document.activeElement;
    if(region && a && region.contains(a) && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'SELECT')){
      deferred.set(region, fn);
      return;
    }
    fn();
  }
  document.addEventListener('focusout', function(){
    setTimeout(function(){
      deferred.forEach(function(fn, region){
        var a = document.activeElement;
        if(!(a && region.contains(a))){ deferred.delete(region); fn(); }
      });
    }, 50);
  });

  // ---------- pointer-events drag (mouse + touch + pen) ----------
  function pointerDrag(container, onDrop){
    container.addEventListener('pointerdown', function(e){
      var h = e.target.closest('.drag-handle');
      if(!h || !container.contains(h)) return;
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      var card = h.closest('.meal-card'), board = card && card.parentElement;
      if(!board) return;
      e.preventDefault();
      try{ h.setPointerCapture(e.pointerId); }catch(err){}
      var y = e.clientY, active = true, raf = 0, moved = false;
      var grab = e.clientY - card.getBoundingClientRect().top;
      card.classList.add('dragging');
      document.body.classList.add('is-dragging');
      function place(){
        var sibs = $$(':scope > .meal-card:not(.hidden-card)', board).filter(function(c){ return c !== card; });
        var before = null;
        for(var i = 0; i < sibs.length; i++){
          var r = sibs[i].getBoundingClientRect();
          if(y < r.top + r.height / 2){ before = sibs[i]; break; }
        }
        if(before){ if(card.nextElementSibling !== before){ board.insertBefore(card, before); moved = true; } }
        else if(sibs.length){ var last = sibs[sibs.length - 1]; if(last.nextElementSibling !== card){ board.insertBefore(card, last.nextElementSibling); moved = true; } }
        // keep the card under the finger; its empty slot shows where it will land
        card.style.transform = '';
        card.style.transform = 'translateY(' + (y - grab - card.getBoundingClientRect().top) + 'px)';
      }
      function loop(){
        if(!active) return;
        var top = ($('header.nav').getBoundingClientRect().bottom || 0) + 60, bottom = window.innerHeight - 70, dy = 0;
        if(y < top) dy = -Math.ceil((top - y) / 4);
        else if(y > bottom) dy = Math.ceil((y - bottom) / 4);
        if(dy){ window.scrollBy({top:dy, left:0, behavior:'instant'}); place(); }
        raf = requestAnimationFrame(loop);
      }
      function onMove(ev){ if(ev.pointerId !== e.pointerId) return; y = ev.clientY; place(); }
      function onEnd(ev){
        if(ev.pointerId !== e.pointerId) return;
        active = false; cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        card.classList.remove('dragging');
        card.style.transform = '';
        document.body.classList.remove('is-dragging');
        if(moved) onDrop(board);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      raf = requestAnimationFrame(loop);
    });
  }

  // =====================================================================
  //  Workout board
  // =====================================================================
  var wkTabs = $('#wkTabs'), wkPanels = $('#wkPanels'), wkBoards = {};
  var dayOpts = '<option value="">העבר ליום…</option>' + DAYS.map(function(x){ return '<option value="' + x.id + '">' + x.label + '</option>'; }).join('');

  function rowHtml(r){
    return '<div class="ex-row" data-id="' + esc(r.id) + '">' +
      '<div class="ex-name" contenteditable="true" data-placeholder="תרגיל">' + esc(r.name) + '</div>' +
      '<div class="ex-num ex-sets" contenteditable="true" data-placeholder="סטים">' + esc(r.sets) + '</div>' +
      '<div class="ex-num ex-reps" contenteditable="true" data-placeholder="חזרות">' + esc(r.reps) + '</div>' +
      '<div class="ex-note" contenteditable="true" data-placeholder="דגש">' + esc(r.note) + '</div>' +
      '<button class="ex-del" type="button" title="הסירו תרגיל" aria-label="הסירו תרגיל">×</button></div>';
  }
  function wkCardEl(d){
    var c = document.createElement('div');
    c.className = 'meal-card wk-card' + (d.hidden ? ' hidden-card' : '');
    c.dataset.id = d.id;
    c.innerHTML =
      '<div class="meal-head"><span class="drag-handle" title="גררו לשינוי סדר">⠿</span><span class="order-badge">•</span>' +
      '<h3 contenteditable="true" data-placeholder="שם הכרטיסייה">' + esc(d.title) + '</h3>' +
      '<span class="meal-time" contenteditable="true" data-placeholder="משך">' + esc(d.meta) + '</span>' +
      '<button class="card-del" type="button" title="הסירו כרטיסייה" aria-label="הסירו כרטיסייה">×</button>' +
      '<div class="reorder-btns"><button class="mv" type="button" data-dir="up" aria-label="למעלה">▲</button><button class="mv" type="button" data-dir="down" aria-label="למטה">▼</button></div></div>' +
      '<p class="wk-focus" contenteditable="true" data-placeholder="מיקוד / הערה">' + esc(d.focus) + '</p>' +
      '<div class="ex-head"><span>תרגיל</span><span>סטים</span><span>חזרות</span><span>דגש</span><span></span></div>' +
      '<div class="ex-rows">' + (d.rows || []).map(rowHtml).join('') + '</div>' +
      '<div class="wk-foot"><button class="wk-add-ex" type="button">+ תרגיל</button><select class="wk-sel" aria-label="העבר ליום">' + dayOpts + '</select></div>';
    return c;
  }
  function wkCardData(c){
    function t(r, s){ var el = r.querySelector(s); return el ? el.textContent : ''; }
    return {id:c.dataset.id, title:t(c,'h3'), meta:t(c,'.meal-time'), focus:t(c,'.wk-focus'), hidden:c.classList.contains('hidden-card'),
      rows:$$('.ex-row', c).map(function(r){ return {id:r.dataset.id, name:t(r,'.ex-name'), sets:t(r,'.ex-sets'), reps:t(r,'.ex-reps'), note:t(r,'.ex-note')}; })};
  }
  function wkUpdateTabs(){
    DAYS.forEach(function(d, i){
      var titles = state.plan[d.id].filter(function(c){ return !c.hidden; }).map(function(c){ return c.title.trim(); }).filter(Boolean);
      var tab = wkTabs.querySelector('[data-day="' + d.id + '"]');
      tab.innerHTML = '<b>' + d.label + '</b><small>' + esc(titles.join(' + ') || '—') + '</small>';
      tab.classList.toggle('is-today', i === todayIdx());
    });
  }
  function wkRenumber(board){
    $$(':scope > .meal-card:not(.hidden-card)', board).forEach(function(c, i){ c.querySelector('.order-badge').textContent = i + 1; });
    var p = board.closest('.day-panel'), bin = p.querySelector('.trash-bin'), list = p.querySelector('.trash-list');
    var hid = $$(':scope > .meal-card.hidden-card', board);
    list.innerHTML = '';
    hid.forEach(function(c){
      var chip = document.createElement('span'); chip.className = 'trash-chip';
      var n = document.createElement('span'); n.textContent = c.querySelector('h3').textContent || 'כרטיסייה';
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'שחזרו';
      b.addEventListener('click', function(){ c.classList.remove('hidden-card'); wkChanged(board); });
      chip.appendChild(n); chip.appendChild(b); list.appendChild(chip);
    });
    bin.hidden = hid.length === 0;
  }
  function wkActivate(id){
    $$('.day-tab', wkTabs).forEach(function(t){ t.classList.toggle('active', t.dataset.day === id); });
    $$('.day-panel', wkPanels).forEach(function(p){ p.classList.toggle('active', p.dataset.day === id); });
  }
  function wkSetup(){
    DAYS.forEach(function(d, i){
      var tab = document.createElement('button');
      tab.type = 'button'; tab.className = 'day-tab wk-tab' + (i === todayIdx() ? ' active' : ''); tab.dataset.day = d.id;
      wkTabs.appendChild(tab);
      var p = document.createElement('div');
      p.className = 'day-panel' + (i === todayIdx() ? ' active' : ''); p.dataset.day = d.id;
      p.innerHTML = '<div class="meal-board"></div>' +
        '<div class="trash-bin" hidden><div class="trash-head"><span class="trash-title">כרטיסיות שהוסרו</span><button class="trash-restore-all" type="button">שחזרו הכל</button></div><div class="trash-list"></div></div>' +
        '<button class="add-meal-btn" type="button">+ הוסיפו כרטיסייה</button>' +
        '<div class="wk-tpl" hidden>' + CHIPS.map(function(c){ return '<button class="wk-chip" type="button" data-tpl="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
      wkPanels.appendChild(p);
      wkBoards[d.id] = p.querySelector('.meal-board');
    });
  }
  function renderPlan(){
    DAYS.forEach(function(d){
      var board = wkBoards[d.id];
      board.innerHTML = '';
      state.plan[d.id].forEach(function(c){ board.appendChild(wkCardEl(c)); });
      wkRenumber(board);
    });
    wkUpdateTabs();
  }
  function wkReadAll(){ DAYS.forEach(function(d){ state.plan[d.id] = $$(':scope > .meal-card', wkBoards[d.id]).map(wkCardData); }); }
  var todaySoon = debounce(function(){ renderSafe($('#today'), renderToday); }, 300);
  function wkChanged(board){
    if(board) wkRenumber(board);
    wkReadAll(); commit(); wkUpdateTabs(); todaySoon();
  }

  function wkBind(){
    wkTabs.addEventListener('click', function(e){ var t = e.target.closest('.day-tab'); if(t) wkActivate(t.dataset.day); });
    wkPanels.addEventListener('click', function(e){
      var t = e.target, panel = t.closest('.day-panel'), board = panel && panel.querySelector('.meal-board'), card = t.closest('.meal-card');
      if(!panel) return;
      if(t.closest('.ex-del')){ t.closest('.ex-row').remove(); wkChanged(board); return; }
      if(t.closest('.wk-add-ex')){
        var rows = card.querySelector('.ex-rows');
        rows.insertAdjacentHTML('beforeend', rowHtml({id:uid('r'), name:'', sets:'', reps:'', note:''}));
        rows.lastElementChild.querySelector('.ex-name').focus(); wkChanged(board); return;
      }
      if(t.closest('.card-del')){ card.classList.add('hidden-card'); wkChanged(board); return; }
      if(t.closest('.mv')){
        var up = t.closest('.mv').dataset.dir === 'up';
        if(up && card.previousElementSibling) board.insertBefore(card, card.previousElementSibling);
        else if(!up && card.nextElementSibling) board.insertBefore(card.nextElementSibling, card);
        wkChanged(board); return;
      }
      if(t.closest('.trash-restore-all')){
        $$('.meal-card.hidden-card', board).forEach(function(c){ c.classList.remove('hidden-card'); });
        wkChanged(board); return;
      }
      if(t.closest('.add-meal-btn')){ var tp = panel.querySelector('.wk-tpl'); tp.hidden = !tp.hidden; return; }
      var chip = t.closest('.wk-chip');
      if(chip){
        var nc = wkCardEl(fromTpl(chip.dataset.tpl)); board.appendChild(nc);
        chip.closest('.wk-tpl').hidden = true; wkChanged(board);
        nc.scrollIntoView({behavior:'smooth', block:'center'});
      }
    });
    wkPanels.addEventListener('change', function(e){
      var s = e.target.closest('.wk-sel'); if(!s || !s.value) return;
      var card = s.closest('.meal-card'), from = card.closest('.meal-board'), id = s.value, to = wkBoards[id];
      s.value = '';
      if(!to || to === from) return;
      to.appendChild(card); wkRenumber(from); wkChanged(to); wkActivate(id);
      card.scrollIntoView({behavior:'smooth', block:'center'});
    });
    var typing = debounce(function(){ wkChanged(null); }, 500);
    wkPanels.addEventListener('input', function(e){ if(e.target.isContentEditable) typing(); });
    wkPanels.addEventListener('blur', function(e){ if(e.target.isContentEditable) wkChanged(null); }, true);
    pointerDrag(wkPanels, wkChanged);

    // reset (two-step confirm)
    var resetBtn = $('#wkReset'), armed = false, rt;
    function disarm(){ armed = false; resetBtn.textContent = 'איפוס הלוח לתוכנית המקורית'; resetBtn.style.color = ''; }
    resetBtn.addEventListener('click', function(){
      if(!armed){ armed = true; resetBtn.textContent = 'לחצו שוב לאישור — כל ההתאמות בלוח האימונים יימחקו'; resetBtn.style.color = 'var(--danger)'; rt = setTimeout(disarm, 4000); return; }
      clearTimeout(rt); disarm();
      state.plan = defaultPlan(); renderPlan(); commit(); todaySoon();
    });
  }

  // =====================================================================
  //  Nutrition board
  // =====================================================================
  var nTabs = $('#dayTabs'), nPanels = $('#dayPanels'), nBoards = {};

  // Ordered meal list for a day, merging defaults with saved customisations
  function nutriModel(dayId){
    var data = state.nutri[dayId] || {};
    var list = DEFAULT_MEALS.map(function(spec){ return {id:spec.id, spec:spec}; });
    (Array.isArray(data.custom) ? data.custom : []).forEach(function(c){ if(c && c.id) list.push({id:String(c.id), custom:c}); });
    var order = Array.isArray(data.order) ? data.order : [];
    list.forEach(function(x, i){ var k = order.indexOf(x.id); x.k = k < 0 ? 1000 + i : k; });
    list.sort(function(a, b){ return a.k - b.k; });
    var opts = data.opts || {}, water = data.water || {}, hidden = Array.isArray(data.hidden) ? data.hidden : [];
    return list.map(function(x){
      var dflt = x.spec ? x.spec.water : 1;
      x.opt = opts[x.id] === 'b' ? 'b' : 'a';
      x.water = water[x.id] != null ? water[x.id] : (dflt != null ? dflt : 1);
      x.hidden = hidden.indexOf(x.id) >= 0;
      x.title = x.spec ? x.spec.title : (x.custom.title || '');
      x.time = x.spec ? x.spec.time : (x.custom.time || '');
      x.whos = x.spec ? (x.spec.toggle ? x.spec.options[x.opt].whos : x.spec.whos)
                      : [{p:'a', text:x.custom.a || ''}, {p:'b', text:x.custom.b || ''}];
      return x;
    });
  }

  function whoLabel(w){ return w.p ? '<span class="pname" data-p="' + w.p + '">' + esc(pname(w.p)) + '</span>' : esc(w.label); }
  function whoHtml(w){
    return '<div class="who' + (w.span ? ' span' : '') + '"' + (w.p ? ' data-p="' + w.p + '"' : '') + '><div class="who-row"><span class="who-label">' + whoLabel(w) + '</span>' +
      (w.g ? '<span class="who-g">' + esc(w.g) + '</span>' : '') + '</div><p>' + esc(w.text) + '</p></div>';
  }
  function waterRowHtml(water){
    return '<div class="water-row"><span class="water-label">💧 כוסות מים בארוחה</span><div class="water-ctrl"><button class="wbtn" type="button" data-act="dec" aria-label="פחות">−</button><span class="water-count">' + esc(water) + '</span><button class="wbtn" type="button" data-act="inc" aria-label="יותר">+</button></div></div>';
  }
  function headHtml(title, time, editable){
    var ce = editable ? ' contenteditable="true"' : '';
    return '<div class="meal-head"><span class="drag-handle" title="גררו לשינוי סדר">⠿</span><span class="order-badge">1</span>' +
      '<h3' + ce + (editable ? ' data-placeholder="שם הארוחה"' : '') + '>' + esc(title) + '</h3>' +
      '<span class="meal-time"' + ce + (editable ? ' data-placeholder="זמן הכנה"' : '') + '>' + esc(time) + '</span>' +
      '<button class="card-del" type="button" title="הסירו כרטיסייה" aria-label="הסירו כרטיסייה">×</button>' +
      '<div class="reorder-btns"><button class="mv" type="button" data-dir="up" aria-label="למעלה">▲</button><button class="mv" type="button" data-dir="down" aria-label="למטה">▼</button></div></div>';
  }
  function mealCardEl(x){
    var card = document.createElement('div');
    card.className = 'meal-card' + (x.hidden ? ' hidden-card' : '');
    card.dataset.id = x.id;
    var html;
    if(x.spec){
      var spec = x.spec;
      html = headHtml(spec.title, spec.time, false);
      if(spec.toggle){
        html += '<div class="opt-toggle">' + ['a','b'].map(function(k){ return '<button class="opt-btn' + (x.opt === k ? ' active' : '') + '" type="button" data-opt="' + k + '">' + esc(spec.options[k].label) + '</button>'; }).join('') + '</div>';
        ['a','b'].forEach(function(k){ html += '<div class="opt-panel" data-opt="' + k + '"' + (x.opt === k ? '' : ' hidden') + '>' + spec.options[k].whos.map(whoHtml).join('') + '</div>'; });
      } else {
        html += '<div class="opt-panel">' + spec.whos.map(whoHtml).join('') + '</div>';
      }
    } else {
      // custom card: every user-typed string is escaped (was raw innerHTML before)
      var c = x.custom;
      html = headHtml(c.title || '', c.time || '', true) +
        '<div class="opt-panel">' + ['a','b'].map(function(p){
          return '<div class="who" data-p="' + p + '"><div class="who-row"><span class="who-label">' + whoLabel({p:p}) + '</span></div>' +
            '<p contenteditable="true" data-k="' + p + '" data-placeholder="תארו כאן את הארוחה...">' + esc(c[p] || '') + '</p></div>';
        }).join('') + '</div>';
    }
    card.innerHTML = html + waterRowHtml(x.water);
    return card;
  }
  function nRenumber(board){
    $$(':scope > .meal-card:not(.hidden-card)', board).forEach(function(card, i){ card.querySelector('.order-badge').textContent = i + 1; });
    var panel = board.closest('.day-panel'), bin = panel.querySelector('.trash-bin'), list = panel.querySelector('.trash-list');
    var hid = $$(':scope > .meal-card.hidden-card', board);
    list.innerHTML = '';
    hid.forEach(function(c){
      var chip = document.createElement('span'); chip.className = 'trash-chip';
      var name = document.createElement('span'); name.textContent = c.querySelector('h3').textContent || 'ארוחה';
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'שחזרו';
      btn.addEventListener('click', function(){ c.classList.remove('hidden-card'); nChanged(board); });
      chip.appendChild(name); chip.appendChild(btn); list.appendChild(chip);
    });
    bin.hidden = hid.length === 0;
  }
  function nRead(board){
    var order = [], opts = {}, water = {}, hidden = [], custom = [];
    $$(':scope > .meal-card', board).forEach(function(c){
      var id = c.dataset.id; order.push(id);
      var active = c.querySelector('.opt-btn.active'); if(active) opts[id] = active.dataset.opt;
      water[id] = parseInt(c.querySelector('.water-count').textContent, 10) || 0;
      if(c.classList.contains('hidden-card')) hidden.push(id);
      if(!MEAL_BY_ID[id]){
        var pa = c.querySelector('p[data-k="a"]'), pb = c.querySelector('p[data-k="b"]');
        custom.push({id:id, title:c.querySelector('h3').textContent, time:c.querySelector('.meal-time').textContent, a:pa ? pa.textContent : '', b:pb ? pb.textContent : ''});
      }
    });
    state.nutri[board.dataset.day] = {order:order, opts:opts, water:water, hidden:hidden, custom:custom};
  }
  function nChanged(board){ nRenumber(board); nRead(board); commit(); todaySoon(); }
  function nActivate(id){
    $$('.day-tab', nTabs).forEach(function(t){ t.classList.toggle('active', t.dataset.day === id); });
    $$('.day-panel', nPanels).forEach(function(p){ p.classList.toggle('active', p.dataset.day === id); });
  }
  function nSetup(){
    DAYS.forEach(function(day, idx){
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'day-tab' + (idx === todayIdx() ? ' active is-today' : '');
      tab.textContent = day.label;
      tab.dataset.day = day.id;
      nTabs.appendChild(tab);
      var panel = document.createElement('div');
      panel.className = 'day-panel' + (idx === todayIdx() ? ' active' : '');
      panel.dataset.day = day.id;
      panel.innerHTML =
        '<div class="meal-board" data-day="' + day.id + '"></div>' +
        '<div class="trash-bin" hidden><div class="trash-head"><span class="trash-title">כרטיסיות שהוסרו</span><button class="trash-restore-all" type="button">שחזרו הכל</button></div><div class="trash-list"></div></div>' +
        '<button class="add-meal-btn" type="button">+ הוסיפו כרטיסיית ארוחה</button>';
      nPanels.appendChild(panel);
      nBoards[day.id] = panel.querySelector('.meal-board');
    });
  }
  function renderNutri(){
    DAYS.forEach(function(day){
      var board = nBoards[day.id];
      board.innerHTML = '';
      nutriModel(day.id).forEach(function(x){ board.appendChild(mealCardEl(x)); });
      nRenumber(board);
    });
  }
  function setOption(card, opt){
    $$('.opt-btn', card).forEach(function(b){ b.classList.toggle('active', b.dataset.opt === opt); });
    $$('.opt-panel[data-opt]', card).forEach(function(p){ p.hidden = p.dataset.opt !== opt; });
  }
  function nBind(){
    nTabs.addEventListener('click', function(e){ var tab = e.target.closest('.day-tab'); if(tab) nActivate(tab.dataset.day); });
    nPanels.addEventListener('click', function(e){
      var t = e.target, panel = t.closest('.day-panel'); if(!panel) return;
      var board = panel.querySelector('.meal-board'), card = t.closest('.meal-card');
      if(t.closest('.add-meal-btn')){
        var x = {id:'custom-' + uid(''), custom:{title:'ארוחה חדשה', time:'הוסיפו זמן הכנה', a:'', b:''}, water:1, hidden:false};
        var nc = mealCardEl(x); board.appendChild(nc); nChanged(board);
        nc.scrollIntoView({behavior:'smooth', block:'center'});
        var h3 = nc.querySelector('h3'); if(h3){ h3.focus(); window.getSelection().selectAllChildren(h3); }
        return;
      }
      if(t.closest('.trash-restore-all')){ $$('.meal-card.hidden-card', board).forEach(function(c){ c.classList.remove('hidden-card'); }); nChanged(board); return; }
      if(!card) return;
      if(t.closest('.card-del')){ card.classList.add('hidden-card'); nChanged(board); return; }
      var wbtn = t.closest('.wbtn');
      if(wbtn){
        var countEl = card.querySelector('.water-count'), val = parseInt(countEl.textContent, 10) || 0;
        countEl.textContent = wbtn.dataset.act === 'inc' ? Math.min(8, val + 1) : Math.max(0, val - 1);
        nChanged(board); return;
      }
      var obtn = t.closest('.opt-btn');
      if(obtn){ setOption(card, obtn.dataset.opt); nChanged(board); return; }
      var mv = t.closest('.mv');
      if(mv){
        if(mv.dataset.dir === 'up' && card.previousElementSibling) board.insertBefore(card, card.previousElementSibling);
        else if(mv.dataset.dir === 'down' && card.nextElementSibling) board.insertBefore(card.nextElementSibling, card);
        nChanged(board);
      }
    });
    var typing = debounce(function(){ nBoards && DAYS.forEach(function(d){ nRead(nBoards[d.id]); }); commit(); todaySoon(); }, 500);
    nPanels.addEventListener('input', function(e){ if(e.target.isContentEditable) typing(); });
    nPanels.addEventListener('blur', function(e){
      if(e.target && e.target.isContentEditable){ var b = e.target.closest('.meal-board'); if(b) nChanged(b); }
    }, true);
    pointerDrag(nPanels, nChanged);
  }

  // =====================================================================
  //  Today view: checklist (resets weekly) + weight/reps log
  // =====================================================================
  function doneMap(p){ var d = state.done[p]; return d && d.week === curWeek() && isObj(d.items) ? d.items : {}; }
  function setDone(p, key, on){
    var d = state.done[p];
    if(!d || d.week !== curWeek() || !isObj(d.items)) d = state.done[p] = {week:curWeek(), items:{}};
    if(on) d.items[key] = 1; else delete d.items[key];
    commit();
  }
  function logKey(name){ return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80); }
  function logList(p, key){ var l = state.logs[p] && state.logs[p][key]; return Array.isArray(l) ? l : []; }
  function setLog(p, key, date, w, r){
    var logs = state.logs[p] || (state.logs[p] = {});
    var list = logList(p, key).filter(function(e){ return e.d !== date; });
    if(w || r) list.push({d:date, w:w, r:r});
    list.sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if(list.length > 30) list = list.slice(-30);
    if(list.length) logs[key] = list; else delete logs[key];
    commit();
  }
  function fmtDate(iso){ var p = iso.split('-'); return +p[2] + '.' + +p[1]; }

  function renderNames(){
    $$('.pname').forEach(function(el){ el.textContent = pname(el.dataset.p); });
    $$('#personSeg [data-p]').forEach(function(b){ b.textContent = pname(b.dataset.p); b.classList.toggle('active', b.dataset.p === viewP); });
    $$('[data-me]').forEach(function(b){ b.textContent = pname(b.dataset.me); });
    $$('#meSeg [data-me]').forEach(function(b){ b.classList.toggle('active', b.dataset.me === me); });
  }

  function renderToday(){
    var day = DAYS[viewDay], date = dateOfDay(viewDay), iso = ymd(date), isToday = viewDay === todayIdx();
    if(onlyMine && me) viewP = me;
    $('#todayDate').textContent = (isToday ? 'היום · ' : '') + date.toLocaleDateString('he-IL', {day:'numeric', month:'long'});
    var cards = state.plan[day.id].filter(function(c){ return !c.hidden; });
    $('#todayTitle').textContent = day.full + (cards.length ? ' · ' + cards.map(function(c){ return c.title; }).filter(Boolean).join(' + ') : '');
    $('#dayPrev').disabled = viewDay === 0;
    $('#dayNext').disabled = viewDay === 6;
    $('#dayNow').disabled = isToday;
    $('#whoami').hidden = !!me;
    $('#personSeg').hidden = !!(onlyMine && me);
    $('#onlyMine').checked = onlyMine;
    renderNames();

    var done = doneMap(viewP), total = 0, checked = 0;
    function item(key, nameHtml, meta, desc, extra){
      var on = !!done[key]; total++; if(on) checked++;
      return '<li class="t-item' + (on ? ' done' : '') + '" data-key="' + esc(key) + '">' +
        '<input type="checkbox" class="t-check"' + (on ? ' checked' : '') + ' aria-label="בוצע">' +
        '<div><div class="t-name">' + nameHtml + '</div>' + (meta ? '<div class="t-meta">' + esc(meta) + '</div>' : '') + '</div>' +
        (desc ? '<div class="t-desc">' + esc(desc) + '</div>' : '') + (extra || '') + '</li>';
    }

    // workout
    var wh = '<h3>אימון</h3><p class="t-sub">סמנו תרגיל שביצעתם ורשמו משקל/חזרות · מתאפס כל שבוע</p>', anyRow = false;
    cards.forEach(function(c){
      var rows = c.rows.filter(function(r){ return r.name.trim(); });
      wh += '<div class="t-card-title">' + esc(c.title || 'כרטיסייה') + (c.meta && c.meta !== '—' ? ' · ' + esc(c.meta) : '') + '</div>';
      if(!rows.length){ wh += '<div class="t-empty">' + esc(c.focus || 'אין תרגילים בכרטיסייה') + '</div>'; return; }
      anyRow = true;
      wh += '<ul class="t-list">' + rows.map(function(r){
        var meta = [r.sets ? r.sets + ' סטים' : '', r.reps].filter(Boolean).join(' × ');
        var extra = '';
        if(r.sets.trim()){
          var k = logKey(r.name), list = logList(viewP, k), cur = null, prev = null;
          list.forEach(function(e){ if(e.d === iso) cur = e; else if(e.d < iso) prev = e; });
          extra = '<div class="t-log" data-log="' + esc(k) + '">' +
            '<label><input inputmode="decimal" enterkeyhint="next" data-f="w" value="' + esc(cur ? cur.w : '') + '" placeholder="' + esc(prev ? prev.w : '') + '" aria-label="משקל בק״ג"> ק״ג</label>' +
            '<label><input inputmode="numeric" enterkeyhint="done" data-f="r" value="' + esc(cur ? cur.r : '') + '" placeholder="' + esc(prev ? prev.r : '') + '" aria-label="חזרות"> חזרות</label>' +
            (prev ? '<span class="t-prev">קודם: <b>' + esc(prev.w || '–') + '</b> ק״ג × <b>' + esc(prev.r || '–') + '</b> · ' + fmtDate(prev.d) + '</span>' : '') +
            '</div>';
        }
        return item('w:' + r.id, esc(r.name), meta, r.note, extra);
      }).join('') + '</ul>';
    });
    if(!cards.length) wh += '<div class="t-empty">אין אימון מתוכנן ליום הזה 🙂</div>';
    else if(!anyRow && cards.every(function(c){ return /מנוחה/.test(c.title); })) wh += '<div class="t-empty">יום מנוחה — שינה, מים ותזונה טובה 💤</div>';
    $('#todayWorkout').innerHTML = wh;

    // meals
    var mh = '<h3>ארוחות · ' + '<span class="pname" data-p="' + viewP + '">' + esc(pname(viewP)) + '</span></h3><p class="t-sub">מה על הצלחת היום</p><ul class="t-list">';
    var meals = nutriModel(day.id).filter(function(x){ return !x.hidden; });
    meals.forEach(function(x){
      var parts = x.whos.filter(function(w){ return !w.p || w.p === viewP; }).map(function(w){ return w.text; }).filter(Boolean);
      var g = (x.whos.filter(function(w){ return w.p === viewP && w.g; })[0] || {}).g;
      mh += item('m:' + day.id + ':' + x.id, esc(x.title || 'ארוחה'), [g, x.spec && x.spec.toggle ? x.spec.options[x.opt].label : ''].filter(Boolean).join(' · '), parts.join(' · '));
    });
    if(!meals.length) mh += '<li class="t-empty">אין ארוחות ליום הזה</li>';
    $('#todayMeals').innerHTML = mh + '</ul>';
    updateProgress(checked, total);
  }
  function updateProgress(checked, total){
    if(checked == null){ checked = $$('#today .t-check:checked').length; total = $$('#today .t-check').length; }
    $('#progFill').style.width = (total ? Math.round(checked / total * 100) : 0) + '%';
    $('#progText').textContent = checked + '/' + total + ' בוצעו';
  }

  function todayBind(){
    var sec = $('#today');
    sec.addEventListener('change', function(e){
      var cb = e.target.closest('.t-check');
      if(cb){
        var li = cb.closest('.t-item');
        li.classList.toggle('done', cb.checked);
        setDone(viewP, li.dataset.key, cb.checked);
        updateProgress();
      }
    });
    sec.addEventListener('input', function(e){
      var inp = e.target.closest('.t-log input'); if(!inp) return;
      var box = inp.closest('.t-log');
      var w = box.querySelector('[data-f="w"]').value.trim().slice(0, 12), r = box.querySelector('[data-f="r"]').value.trim().slice(0, 16);
      setLog(viewP, box.dataset.log, ymd(dateOfDay(viewDay)), w, r);
    });
    sec.addEventListener('keydown', function(e){
      if(e.key !== 'Enter') return;
      var inp = e.target.closest('.t-log input'); if(!inp) return;
      e.preventDefault();
      var all = $$('#today .t-log input'), i = all.indexOf(inp);
      if(all[i + 1]) all[i + 1].focus(); else inp.blur();
    });
    $('#personSeg').addEventListener('click', function(e){ var b = e.target.closest('[data-p]'); if(b){ viewP = b.dataset.p; renderToday(); } });
    $('#dayPrev').addEventListener('click', function(){ if(viewDay > 0){ viewDay--; renderToday(); } });
    $('#dayNext').addEventListener('click', function(){ if(viewDay < 6){ viewDay++; renderToday(); } });
    $('#dayNow').addEventListener('click', function(){ viewDay = todayIdx(); renderToday(); });
    $('#onlyMine').addEventListener('change', function(e){
      if(e.target.checked && !me){ e.target.checked = false; toast('קודם בחרו מי משתמש/ת בטלפון הזה'); $('#whoami').hidden = false; return; }
      onlyMine = e.target.checked; lsSet(LS.only, onlyMine ? '1' : null);
      if(!onlyMine) viewP = me || viewP;
      applyBodyClasses(); renderToday();
    });
    $('#whoami').addEventListener('click', function(e){ var b = e.target.closest('[data-me]'); if(b) setMe(b.dataset.me); });
    // a new day may start while the app stays open in the background
    var lastDay = ymd(new Date());
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState !== 'visible') return;
      var now = ymd(new Date());
      if(now !== lastDay){ lastDay = now; viewDay = todayIdx(); renderSafe(sec, renderToday); wkUpdateTabs(); }
    });
  }
  function setMe(p){
    me = p; viewP = p; lsSet(LS.me, p);
    applyBodyClasses(); renderToday();
  }

  // =====================================================================
  //  Theme
  // =====================================================================
  function applyTheme(t){
    var root = document.documentElement;
    if(t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    lsSet(LS.theme, t === 'light' || t === 'dark' ? t : null);
    $$('meta[name="theme-color"]').forEach(function(m){
      var light = '#F6F7F4', dark = '#0F1A22';
      m.content = t === 'light' ? light : t === 'dark' ? dark : (m.media.indexOf('dark') >= 0 ? dark : light);
    });
    $$('#themeSeg [data-theme]').forEach(function(b){ b.classList.toggle('active', b.dataset.theme === (t || 'auto')); });
  }

  // =====================================================================
  //  Share link: whole state, deflate-compressed, base64url in the #hash
  // =====================================================================
  function toB64u(bytes){
    var s = '';
    for(var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64u(str){
    str = str.replace(/-/g, '+').replace(/_/g, '/'); while(str.length % 4) str += '=';
    var bin = atob(str), u = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function pipeBytes(bytes, stream){ return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function(b){ return new Uint8Array(b); }); }
  function encodeState(){
    var json = JSON.stringify({v:1, profiles:state.profiles, plan:state.plan, nutri:state.nutri, done:state.done, logs:state.logs});
    var bytes = new TextEncoder().encode(json);
    if(typeof CompressionStream === 'function') return pipeBytes(bytes, new CompressionStream('deflate-raw')).then(function(z){ return 'z' + toB64u(z); });
    return Promise.resolve('j' + toB64u(bytes));
  }
  function decodeState(s){
    var kind = s.charAt(0), bytes = fromB64u(s.slice(1));
    var p = kind === 'z' ? pipeBytes(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
    return p.then(function(b){ return JSON.parse(new TextDecoder().decode(b)); });
  }
  function baseUrl(){ return location.href.split('#')[0].split('?')[0]; }
  function shareUrl(url, title){
    if(navigator.share){
      return navigator.share({title:title, url:url}).catch(function(err){ if(err && err.name !== 'AbortError') return copyText(url); });
    }
    return copyText(url);
  }
  function copyText(text){
    var ok = function(){ toast('הקישור הועתק — הדביקו בוואטסאפ'); };
    if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(ok, function(){ window.prompt('העתיקו את הקישור:', text); });
    window.prompt('העתיקו את הקישור:', text);
    return Promise.resolve();
  }
  function importState(obj){
    state = normalize(obj);
    commit(); renderAll();
    toast('התוכנית מהקישור נטענה ✔');
  }
  function banner(html, actions){
    var el = document.createElement('div');
    el.className = 'banner';
    el.innerHTML = '<span>' + html + '</span><div class="row-gap"></div>';
    actions.forEach(function(a){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn small' + (a.primary ? ' primary' : ''); b.textContent = a.label;
      b.addEventListener('click', function(){ el.remove(); if(a.fn) a.fn(); });
      el.lastChild.appendChild(b);
    });
    $('#banners').appendChild(el);
    return el;
  }
  function handleHash(){
    var h = location.hash.slice(1);
    if(!h) return;
    var params = {};
    h.split('&').forEach(function(kv){ var i = kv.indexOf('='); if(i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    if(!params.s && !params.pair) return;
    history.replaceState(null, '', baseUrl());
    if(params.s){
      decodeState(params.s).then(function(obj){
        if(freshDevice) return importState(obj);
        banner('<b>נפתח קישור עם תוכנית משותפת.</b> לטעון אותו? הנתונים במכשיר הזה יוחלפו.', [
          {label:'טען את התוכנית', primary:true, fn:function(){ importState(obj); }},
          {label:'השאר את שלי'}
        ]);
      }).catch(function(){ toast('הקישור פגום או חתוך — בקשו קישור חדש'); });
    }
    if(params.pair){
      var code = Sync.normCode(params.pair);
      if(!Sync.configured()) toast('קישור ההצטרפות דורש הגדרת Firebase באתר');
      else if(code && code !== Sync.code){
        banner('<b>הזמנה לסנכרון זוגי</b> · הטלפונים יסונכרנו בזמן אמת.', [
          {label:'הצטרפות', primary:true, fn:function(){ Sync.start(code, 'join'); }},
          {label:'לא עכשיו'}
        ]);
      }
    }
  }

  // =====================================================================
  //  Firebase sync (optional). Loaded lazily from js/sync.js
  // =====================================================================
  var Sync = {
    code: lsGet(LS.pair) || null, conn: null, status: 'off', mode: null, gen: 0, pushT: null, err: '',
    configured: function(){
      var c = window.FIREBASE_CONFIG;
      return !!(c && c.apiKey && c.projectId && !/PASTE|YOUR_|xxx/i.test(c.apiKey + c.projectId));
    },
    normCode: function(s){
      s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(!/^[A-HJ-NP-Z2-9]{16}$/.test(s)) return null;
      return s.match(/.{4}/g).join('-');
    },
    newCode: function(){
      var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(16), s = '';
      crypto.getRandomValues(b);
      for(var i = 0; i < 16; i++) s += A[b[i] & 31];
      return s.match(/.{4}/g).join('-');
    },
    setStatus: function(s, err){
      this.status = s; this.err = err || '';
      var dot = $('#syncDot');
      dot.hidden = s === 'off';
      dot.dataset.s = s === 'ok' ? 'ok' : s === 'err' ? 'err' : 'busy';
      if($('#settings').open) renderSyncBox();
    },
    start: function(code, mode){
      var self = this;
      if(!this.configured()) return;
      this.stop();
      this.code = code; this.mode = mode; lsSet(LS.pair, code);
      if(mode === 'join'){ dirty = {}; lsSet(LS.dirty, '{}'); }
      if(mode === 'create'){ FIELD_NAMES.forEach(function(f){ dirty[f] = (dirty[f] || 0) + 1; }); lsSet(LS.dirty, JSON.stringify(dirty)); }
      var gen = ++this.gen;
      this.setStatus('connecting');
      import(new URL('js/sync.js', document.baseURI).href).then(function(mod){
        return mod.connect(window.FIREBASE_CONFIG, code, {
          onData: function(data, fromCache){ if(gen === self.gen) self.onData(data, fromCache); },
          onError: function(err){ if(gen === self.gen) self.setStatus('err', (err && (err.code || err.message)) || 'שגיאה'); }
        });
      }).then(function(conn){
        if(gen !== self.gen){ conn.close(); return; }
        self.conn = conn;
      }).catch(function(err){
        if(gen !== self.gen) return;
        self.setStatus(navigator.onLine ? 'err' : 'offline', (err && (err.code || err.message)) || '');
      });
    },
    stop: function(){
      this.gen++;
      if(this.conn){ try{ this.conn.close(); }catch(e){} }
      this.conn = null; clearTimeout(this.pushT);
      this.setStatus('off');
    },
    leave: function(){ this.stop(); this.code = null; lsSet(LS.pair, null); },
    onData: function(data, fromCache){
      if(!data){
        if(fromCache) return;
        if(this.mode === 'join'){
          var bad = this.code; this.leave();
          toast('לא נמצא זוג עם הקוד ' + bad + '. בדקו את הקוד ונסו שוב.');
          return;
        }
        FIELD_NAMES.forEach(function(f){ dirty[f] = dirty[f] || 1; });
      } else {
        var changed = {};
        FIELD_NAMES.forEach(function(f){
          var v = data[f];
          if(typeof v !== 'string'){ if(!dirty[f]) dirty[f] = 1; return; }   // remote never had it → send ours
          if(v === lastStr[f] || dirty[f]) return;                          // same, or our newer edit is on its way
          try{ FIELDS[f].set(JSON.parse(v)); lastStr[f] = v; changed[f] = 1; }catch(e){}
        });
        if(Object.keys(changed).length){
          var n = normalize(state); state.profiles = n.profiles; state.plan = n.plan; state.nutri = n.nutri; state.done = n.done; state.logs = n.logs;
          saveLocal();
          if(changed.plan) renderSafe(wkPanels, renderPlan);
          if(changed.nutri || changed.profiles) renderSafe(nPanels, renderNutri);
          if(changed.profiles) renderNames();
          renderSafe($('#today'), renderToday);
        }
      }
      this.mode = 'resume';
      lsSet(LS.dirty, JSON.stringify(dirty));
      this.setStatus('ok');
      if(Object.keys(dirty).length) this.pushNow();
    },
    schedulePush: function(){
      var self = this;
      if(!this.conn) return;
      clearTimeout(this.pushT);
      this.pushT = setTimeout(function(){ self.pushNow(); }, 700);
    },
    pushNow: function(){
      var self = this, conn = this.conn;
      if(!conn) return;
      var fields = {}, vers = {};
      Object.keys(dirty).forEach(function(f){ if(FIELDS[f]){ fields[f] = lastStr[f]; vers[f] = dirty[f]; } });
      if(!Object.keys(fields).length) return;
      this.setStatus('busy');
      conn.push(fields).then(function(){
        Object.keys(vers).forEach(function(f){ if(dirty[f] === vers[f]) delete dirty[f]; });
        lsSet(LS.dirty, JSON.stringify(dirty));
        if(self.conn === conn) self.setStatus(Object.keys(dirty).length ? 'busy' : 'ok');
      }, function(err){
        if(self.conn === conn) self.setStatus('err', (err && (err.code || err.message)) || '');
      });
    }
  };
  window.addEventListener('online', function(){ if(Sync.code && (Sync.status === 'offline' || Sync.status === 'err')) Sync.start(Sync.code, 'resume'); });

  function renderSyncBox(){
    var box = $('#syncBox');
    if(!Sync.configured()){
      box.innerHTML = '<p class="help">הסנכרון בזמן אמת עוד לא הופעל באתר (צריך להדביק הגדרות Firebase בקובץ <code>js/firebase-config.js</code>). בינתיים אפשר להעביר את כל התוכנית עם "שתף קישור".</p>';
      return;
    }
    if(!Sync.code){
      box.innerHTML = '<p class="help">צרו קוד זוג בטלפון אחד ושלחו קישור הצטרפות לטלפון השני. כל שינוי יופיע אצל שניכם תוך שניות.</p>' +
        '<div class="row-gap"><button class="btn primary" type="button" data-sync="create">צור קוד זוג חדש</button></div>' +
        '<div class="join-row"><input id="joinCode" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="קוד זוג"><button class="btn" type="button" data-sync="join">הצטרפות</button></div>';
      return;
    }
    var st = {off:'מנותק', connecting:'מתחבר…', ok:'מסונכרן ✔', busy:'שומר…', offline:'אין חיבור — השינויים יישלחו כשיחזור', err:'שגיאה'}[Sync.status] || Sync.status;
    box.innerHTML = '<p class="sync-status">מצב: <b>' + esc(st) + '</b>' + (Sync.status === 'err' && Sync.err ? ' <span dir="ltr">(' + esc(Sync.err) + ')</span>' : '') + '</p>' +
      '<div class="row-gap" style="margin-bottom:10px;"><span class="pair-code">' + esc(Sync.code) + '</span></div>' +
      '<div class="row-gap"><button class="btn primary small" type="button" data-sync="invite">📨 שלח קישור הצטרפות</button><button class="btn small" type="button" data-sync="copy">העתק קוד</button>' +
      (Sync.status === 'err' || Sync.status === 'offline' ? '<button class="btn small" type="button" data-sync="retry">נסה שוב</button>' : '') +
      '<button class="btn small danger" type="button" data-sync="leave">התנתק</button></div>' +
      '<p class="help" style="margin-top:10px;">מי שמחזיק בקוד יכול לראות ולערוך — שתפו אותו רק ביניכם.</p>';
  }

  // =====================================================================
  //  Settings dialog
  // =====================================================================
  function settingsBind(){
    var dlg = $('#settings');
    $('#openSettings').addEventListener('click', function(){
      $('#nameA').value = state.profiles.a; $('#nameB').value = state.profiles.b;
      renderNames(); renderSyncBox(); applyTheme(lsGet(LS.theme));
      $('#shareInfo').textContent = '';
      if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
    dlg.addEventListener('click', function(e){
      if(e.target === dlg || e.target.closest('[data-close]')){ dlg.close ? dlg.close() : dlg.removeAttribute('open'); }
    });
    function onName(){
      state.profiles = {a:$('#nameA').value.trim() || DEFAULT_NAMES.a, b:$('#nameB').value.trim() || DEFAULT_NAMES.b};
      commit(); renderNames();
    }
    $('#nameA').addEventListener('input', onName); $('#nameB').addEventListener('input', onName);
    $('#meSeg').addEventListener('click', function(e){ var b = e.target.closest('[data-me]'); if(b){ setMe(b.dataset.me); renderNames(); } });
    $('#themeSeg').addEventListener('click', function(e){ var b = e.target.closest('[data-theme]'); if(b) applyTheme(b.dataset.theme); });
    $('#shareLink').addEventListener('click', function(){
      encodeState().then(function(s){
        var url = baseUrl() + '#s=' + s;
        $('#shareInfo').textContent = 'אורך הקישור: ' + url.length.toLocaleString('he-IL') + ' תווים';
        return shareUrl(url, 'תוכנית האימונים שלנו');
      });
    });
    $('#syncBox').addEventListener('click', function(e){
      var b = e.target.closest('[data-sync]'); if(!b) return;
      var a = b.dataset.sync;
      if(a === 'create') Sync.start(Sync.newCode(), 'create');
      else if(a === 'join'){
        var code = Sync.normCode($('#joinCode').value);
        if(!code){ toast('הקוד צריך להיות 16 תווים, למשל ABCD-EFGH-JKLM-NPQR'); return; }
        Sync.start(code, 'join');
      }
      else if(a === 'invite') shareUrl(baseUrl() + '#pair=' + Sync.code, 'הצטרפות לתוכנית האימונים שלנו');
      else if(a === 'copy') copyText(Sync.code);
      else if(a === 'retry') Sync.start(Sync.code, 'resume');
      else if(a === 'leave'){ Sync.leave(); toast('הסנכרון הופסק. הנתונים נשארו במכשיר.'); }
      renderSyncBox();
    });
    $('#syncBox').addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target.id === 'joinCode'){ var j = $('[data-sync="join"]'); if(j) j.click(); } });
  }

  // =====================================================================
  //  Service worker (offline)
  // =====================================================================
  function registerSW(){
    if(!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(function(){});
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(!hadController){ hadController = true; return; }
      toast('גרסה חדשה של האתר מוכנה', 'רענון', function(){ location.reload(); }, 15000);
    });
  }

  // =====================================================================
  function renderAll(){ renderPlan(); renderNutri(); renderToday(); renderNames(); }

  applyTheme(lsGet(LS.theme));
  applyBodyClasses();
  wkSetup(); nSetup();
  renderAll();
  wkBind(); nBind(); todayBind(); settingsBind();
  if(!hadLocalState) saveLocal();
  handleHash();
  window.addEventListener('hashchange', handleHash);
  if(Sync.code && Sync.configured()) Sync.start(Sync.code, 'resume');
  registerSW();
})();
