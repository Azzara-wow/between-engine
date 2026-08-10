/* ============================================================
   BETWEEN — движок каталога (between-catalog.js)
   Части 1+2+3: загрузка, карточки, сетка, адаптив, фильтры,
   ПОПАП, кнопка «Хочу этот», подсветка по семействам.

   Куда класть:  between-engine → /catalog/between-catalog.js
   Как звать:    https://between-engine.pages.dev/catalog/between-catalog.js

   Настройка КОНКРЕТНОЙ страницы — в блоке T123 (window.BT_CATALOG).
   Всё, что в БЛОКЕ 1, — общий стиль; настройка страницы перебивает.
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     БЛОК 1. ОБЩИЕ НАСТРОЙКИ
     ============================================================ */

  var DEFAULTS = {

    /* -- откуда берём данные -- */
    api:   'https://between-quiz.eaburdenko.workers.dev/catalog',
    kind:  'perfume',
    mount: '#bt-catalog',

    /* -- палитра -- */
    colorText:   '#2C2420',
    colorMuted:  '#6A5E56',
    colorAccent: '#6B4F4F',
    colorCard:   '#F3EFEB',
    colorBg:     'transparent',

    /* -- шрифты -- */
    fontTitle: "'Cormorant Garamond', Georgia, serif",
    fontBody:  "'Jost', 'Helvetica Neue', sans-serif",
    fontsUrl:  'https://fonts.googleapis.com/css2'
             + '?family=Cormorant+Garamond:wght@400;500;600'
             + '&family=Jost:wght@300;400'
             + '&display=swap',

    /* -- размеры -- */
    titleSize:   20,
    bodySize:    14,
    metaSize:    11,
    titleWeight: 500,
    bodyWeight:  400,

    /* -- форма -- */
    cardRadius:  20,
    imageRadius: 16,
    imagePad:    14,
    cardPadding: 18,
    gap:         20,

    /* -- сетка -- */
    minCardWidth: 300,   // шире карточки -> меньше в ряд, текст в меньше строк
    maxWidth:     1180,
    maxColumns:   3,     // не больше 3 в ряд даже на широком экране

    /* -- картинка -- */
    imageFit:   'cover',
    eagerCount: 4,

    /* -- поведение карточки -- */
    hoverLift:   3,
    bottomShade: 0.16,   // затемнение низа карточки (вместо тени тумана). 0 — выключить

    /* -- что показываем -- */
    attrsOnCard: [],
    showPrice:   false,
    note:        '',
    tapHint:     'нажмите, чтобы узнать историю',   // подсказка на карточке; '' — убрать

    /* ============================================================
       КНОПКА «ХОЧУ ЭТОТ» → телеграм с готовым сообщением
       ============================================================ */
    ctaText:     'Хочу этот',
    ctaTelegram: 'Elena_Burdenko',                  // ник без @
    ctaMessage:  'Хочу аромат «{title}»',           // {title} подставится
    ctaEnabled:  true,

    /* ============================================================
       ПОДСВЕТКА ПО СЕМЕЙСТВАМ
       familyKey — по какой характеристике красим.
       familyColors — «спокойный ключ» → цвет. Ключ приводится к
       нижнему регистру без пробелов, ё→е — чтобы «Цветочный»,
       «цветочный», «Цветочный » попали в один цвет.
       Добавить семейство — допишите строку сюда, код трогать не надо.
       ============================================================ */
    familyKey:    'Семья',
    familyColors: {
      floral:    '#D89AA6',   // цветочный
      woody:     '#96694A',   // древесный
      amber:     '#CD9B5A',   // амбровый
      fresh:     '#8CB9CD',   // свежий
      gourmand:  '#D7A578',   // гурманский
      chypre:    '#8C9B82',   // шипр-фужер
      // синонимы русскими ключами — на случай, если в данных по-русски:
      'цветочный':  '#D89AA6',
      'древесный':  '#96694A',
      'амбровый':   '#CD9B5A',
      'свежий':     '#8CB9CD',
      'гурманский': '#D7A578',
      'шипрфужер':  '#8C9B82',
      'шипр':       '#8C9B82',
    },
    veilEnabled:  true,        // притемнять соседей при наведении/тапе
    haloEnabled:  true,        // цветной ореол вокруг картинки
    haloAlways:   0.35,        // яркость ореола в покое (0..1)
    haloActive:   0.85,        // яркость ореола при наведении/тапе

    /* -- ФИЛЬТРЫ -- */
    filters:      [],
    genderKey:    'Пол',
    genderValues: { female: 'женский', male: 'мужской', unisex: 'унисекс' },
    genderLabels: { all: 'Все', female: 'Для неё', male: 'Для него' },
    filtersEnabled: true,

    /* -- тексты -- */
    errorText:   'Каталог не загрузился.',
    retryText:   'Попробовать снова',
    emptyText:   'Пока пусто.',
    emptyFilter: 'Под выбранные фильтры ничего не подошло.',
    resetText:   'Сбросить',
    countText:   'Показано',
    doneText:    'Готово',
    closeLabel:  'Закрыть',
  };

  var cfg = merge(DEFAULTS, window.BT_CATALOG || {});


  /* ============================================================
     БЛОК 2. СОСТОЯНИЕ И ЗАПУСК
     ============================================================ */

  var root   = null;
  var ALL    = [];
  var facets = {};
  var byId   = {};               // id -> item, чтобы попап нашёл товар
  var gender = 'all';
  var picked = {};
  var openKey = null;            // раскрытая выпадашка-фильтр

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function start() {
    root = document.querySelector(cfg.mount);
    if (!root) return;

    loadFonts();
    injectStyles();

    root.className = 'bt-catalog';
    renderSkeleton();
    load(0);

    // клик мимо раскрытой выпадашки — закрыть
    document.addEventListener('click', function (e) {
      if (!openKey) return;
      if (root.contains(e.target) && e.target.closest &&
          e.target.closest('.bt-drop')) return;
      closeDrop();
    });

    // Esc закрывает попап или выпадашку
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (isPopupOpen()) closePopup();
      else if (openKey) closeDrop();
    });
  }


  /* ============================================================
     БЛОК 3. ЗАГРУЗКА ДАННЫХ
     ============================================================ */

  var RETRY_DELAYS = [500, 1000, 1500];

  function load(attempt) {
    var url = cfg.api + (cfg.kind ? '?kind=' + encodeURIComponent(cfg.kind) : '');

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = (data && data.items) || [];
        if (!items.length) throw new Error('пусто');
        ALL    = items;
        facets = (data && data.facets) || {};
        byId   = {};
        for (var i = 0; i < items.length; i++) byId[items[i].id] = items[i];
        window.BT_CATALOG_DATA = data;
        renderAll();
      })
      .catch(function () {
        if (attempt < RETRY_DELAYS.length) {
          setTimeout(function () { load(attempt + 1); }, RETRY_DELAYS[attempt]);
        } else {
          renderError();
        }
      });
  }


  /* ============================================================
     БЛОК 4. ФИЛЬТРАЦИЯ
     ============================================================ */

  function hasGender() {
    return cfg.filtersEnabled && cfg.genderKey
        && facets[cfg.genderKey] && facets[cfg.genderKey].length;
  }

  function activeFilterKeys() {
    if (!cfg.filtersEnabled) return [];
    var out = [];
    for (var i = 0; i < cfg.filters.length; i++) {
      var key = cfg.filters[i];
      if (key === cfg.genderKey) continue;
      if (facets[key] && facets[key].length) out.push(key);
    }
    return out;
  }

  function passesGender(item) {
    if (gender === 'all') return true;
    var values = (item.attrs && item.attrs[cfg.genderKey]) || [];
    var want = cfg.genderValues[gender], uni = cfg.genderValues.unisex;
    for (var i = 0; i < values.length; i++) {
      if (values[i] === want || values[i] === uni) return true;
    }
    return false;
  }

  function passesPicked(item) {
    for (var key in picked) {
      var chosen = picked[key];
      if (!chosen || !chosen.length) continue;
      var values = (item.attrs && item.attrs[key]) || [];
      var hit = false;
      for (var i = 0; i < chosen.length; i++) {
        if (values.indexOf(chosen[i]) !== -1) { hit = true; break; }
      }
      if (!hit) return false;
    }
    return true;
  }

  function filtered() {
    var out = [];
    for (var i = 0; i < ALL.length; i++) {
      if (passesGender(ALL[i]) && passesPicked(ALL[i])) out.push(ALL[i]);
    }
    return out;
  }

  function countFor(key) { return (picked[key] && picked[key].length) || 0; }

  function toggleValue(key, value) {
    if (!picked[key]) picked[key] = [];
    var idx = picked[key].indexOf(value);
    if (idx === -1) picked[key].push(value);
    else            picked[key].splice(idx, 1);
    if (!picked[key].length) delete picked[key];
    updateView();
  }

  function setGender(g) { gender = g; updateView(); }
  function resetAll() { gender = 'all'; picked = {}; closeDrop(); updateView(); }

  function anyPicked() {
    if (gender !== 'all') return true;
    for (var k in picked) if (picked[k] && picked[k].length) return true;
    return false;
  }


  /* ============================================================
     БЛОК 5. ВЫПАДАШКИ-ФИЛЬТРЫ
     ============================================================ */

  function openDrop(key) { openKey = key; syncDrops(); lockScroll(true); }
  function closeDrop()   { openKey = null; syncDrops(); if (!isPopupOpen()) lockScroll(false); }
  function toggleDrop(key) { if (openKey === key) closeDrop(); else openDrop(key); }

  function lockScroll(on) {
    if (!matchMedia('(max-width: 560px)').matches) return;
    document.body.style.overflow = on ? 'hidden' : '';
  }

  function syncDrops() {
    var wraps = root.querySelectorAll('.bt-drop');
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      w.className = 'bt-drop' + (w.dataset.key === openKey ? ' bt-drop--open' : '');
    }
  }


  /* ============================================================
     БЛОК 6. ПОДСВЕТКА ПО СЕМЕЙСТВАМ
     ============================================================ */

  // «спокойный ключ»: нижний регистр, без пробелов/дефисов, ё→е
  function calmKey(s) {
    return String(s || '').toLowerCase()
      .replace(/\u0451/g, '\u0435')      // ё -> е
      .replace(/[\s\-]+/g, '');
  }

  function familyColor(item) {
    if (!cfg.familyKey) return '';
    var values = (item.attrs && item.attrs[cfg.familyKey]) || [];
    for (var i = 0; i < values.length; i++) {
      var c = cfg.familyColors[calmKey(values[i])];
      if (c) return c;
    }
    return '';
  }

  function hexToRgb(hex) {
    var m = String(hex).replace('#', '');
    if (m.length === 3) m = m[0]+m[0]+m[1]+m[1]+m[2]+m[2];
    var n = parseInt(m, 16);
    return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255);
  }


  /* ============================================================
     БЛОК 7. РИСОВАНИЕ КАТАЛОГА
     ============================================================ */

  function renderSkeleton() {
    var cells = '';
    for (var i = 0; i < 6; i++) {
      cells += '<div class="bt-card bt-card--ghost">'
             +   '<div class="bt-card__media"></div>'
             +   '<div class="bt-card__body">'
             +     '<div class="bt-ghost-line bt-ghost-line--title"></div>'
             +     '<div class="bt-ghost-line"></div>'
             +     '<div class="bt-ghost-line bt-ghost-line--short"></div>'
             +   '</div>'
             + '</div>';
    }
    root.innerHTML = noteHtml() + '<div class="bt-grid">' + cells + '</div>';
  }

  function renderAll() {
    var html = noteHtml()
             + filtersHtml()
             + '<div class="bt-bar"><span class="bt-count"></span>'
             +   '<button class="bt-reset" type="button">' + esc(cfg.resetText) + '</button></div>'
             + '<div class="bt-grid" id="bt-grid"></div>';
    root.innerHTML = html;

    ensurePopup();        // попап живёт в <body>, а не внутри каталога
    bindFilters();
    bindGrid();
    updateView();
  }

  function updateView() {
    var items = filtered();

    var grid = root.querySelector('#bt-grid');
    if (grid) {
      if (!items.length) {
        grid.className = 'bt-grid bt-grid--empty';
        grid.innerHTML = '<div class="bt-msg">' + esc(cfg.emptyFilter) + '</div>';
      } else {
        grid.className = 'bt-grid';
        var html = '';
        for (var i = 0; i < items.length; i++) html += cardHtml(items[i], i);
        grid.innerHTML = html;
      }
    }

    var count = root.querySelector('.bt-count');
    if (count) count.textContent = cfg.countText + ' ' + items.length;

    var reset = root.querySelector('.bt-reset');
    if (reset) reset.style.display = anyPicked() ? 'inline-block' : 'none';

    var gchips = root.querySelectorAll('.bt-gchip');
    for (var g = 0; g < gchips.length; g++) {
      var gc = gchips[g];
      gc.className = 'bt-gchip' + (gc.dataset.gender === gender ? ' bt-gchip--on' : '');
    }

    var toggles = root.querySelectorAll('.bt-drop__toggle');
    for (var t = 0; t < toggles.length; t++) {
      var tg = toggles[t];
      var n = countFor(tg.dataset.key);
      var badge = tg.querySelector('.bt-drop__badge');
      if (badge) badge.textContent = n ? String(n) : '';
      tg.className = 'bt-drop__toggle' + (n ? ' bt-drop__toggle--on' : '');
    }

    var opts = root.querySelectorAll('.bt-opt');
    for (var o = 0; o < opts.length; o++) {
      var op = opts[o];
      var on = !!(picked[op.dataset.key] && picked[op.dataset.key].indexOf(op.dataset.value) !== -1);
      op.className = 'bt-opt' + (on ? ' bt-opt--on' : '');
    }
  }

  function cardHtml(item, index) {
    var eager = index < cfg.eagerCount;
    var color = familyColor(item);

    // ореол и вуаль задаём переменными на самой карточке
    var styleVars = '';
    if (color) {
      styleVars = ' style="--fam:' + color + '; --fam-rgb:' + hexToRgb(color) + ';"';
    }

    var halo = (cfg.haloEnabled && color) ? '<span class="bt-card__halo" aria-hidden="true"></span>' : '';

    var media = item.image
      ? '<img class="bt-card__img" src="' + esc(item.image) + '" alt="' + esc(item.title) + '"'
        + ' loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async"'
        + (eager ? ' fetchpriority="high"' : '') + '>'
      : '';

    var meta = '';
    if (cfg.attrsOnCard && cfg.attrsOnCard.length) {
      var parts = [];
      for (var i = 0; i < cfg.attrsOnCard.length; i++) {
        var values = item.attrs && item.attrs[cfg.attrsOnCard[i]];
        if (values && values.length) parts.push(values.join(', '));
      }
      if (parts.length) meta = '<div class="bt-card__meta">' + esc(parts.join('  \u00B7  ')) + '</div>';
    }

    var cta = ctaButtonHtml(item, 'card');
    var hint = cfg.tapHint ? '<span class="bt-card__hint">' + esc(cfg.tapHint) + '</span>' : '';

    return '<article class="bt-card" data-id="' + esc(item.id) + '"' + styleVars + '>'
         +   '<button class="bt-card__open" type="button" aria-label="' + esc(item.title) + '">'
         +     '<span class="bt-card__media">' + halo + media + '</span>'
         +     '<span class="bt-card__body">'
         +       '<span class="bt-card__title">' + esc(item.title) + '</span>'
         +       (item.descr ? '<span class="bt-card__descr">' + esc(item.descr) + '</span>' : '')
         +       meta + hint
         +     '</span>'
         +   '</button>'
         +   cta
         + '</article>';
  }

  // ссылка-кнопка «Хочу этот» → t.me с префиллом
  function ctaButtonHtml(item, where) {
    if (!cfg.ctaEnabled || !cfg.ctaTelegram) return '';
    var msg = cfg.ctaMessage.replace('{title}', item.title);
    var href = 'https://t.me/' + encodeURIComponent(cfg.ctaTelegram)
             + '?text=' + encodeURIComponent(msg);
    var cls = (where === 'popup') ? 'bt-cta bt-cta--popup' : 'bt-cta bt-cta--card';
    return '<a class="' + cls + '" href="' + href + '" target="_blank" rel="noopener">'
         +    esc(cfg.ctaText) + '</a>';
  }

  function renderError() {
    root.innerHTML = noteHtml()
      + '<div class="bt-msg bt-msg--error">' + esc(cfg.errorText)
      +   '<button class="bt-retry" type="button">' + esc(cfg.retryText) + '</button></div>';
    var btn = root.querySelector('.bt-retry');
    if (btn) btn.addEventListener('click', function () { renderSkeleton(); load(0); });
  }

  function noteHtml() {
    return cfg.note ? '<div class="bt-note">' + esc(cfg.note) + '</div>' : '';
  }


  /* ============================================================
     БЛОК 8. ФИЛЬТРЫ — HTML И СОБЫТИЯ
     ============================================================ */

  function filtersHtml() {
    if (!cfg.filtersEnabled) return '';
    var out = '';

    if (hasGender()) {
      out += '<div class="bt-gender">'
           +   '<button class="bt-gchip" type="button" data-gender="all">'    + esc(cfg.genderLabels.all)    + '</button>'
           +   '<button class="bt-gchip" type="button" data-gender="female">' + esc(cfg.genderLabels.female) + '</button>'
           +   '<button class="bt-gchip" type="button" data-gender="male">'   + esc(cfg.genderLabels.male)   + '</button>'
           + '</div>';
    }

    var keys = activeFilterKeys();
    if (keys.length) {
      var drops = '';
      for (var i = 0; i < keys.length; i++) drops += dropHtml(keys[i]);
      out += '<div class="bt-drops">' + drops + '</div>';
    }

    return out ? '<div class="bt-filters">' + out + '</div>' : '';
  }

  function dropHtml(key) {
    var values = facets[key];
    var opts = '';
    for (var j = 0; j < values.length; j++) {
      var v = values[j].value;
      opts += '<button class="bt-opt" type="button"'
            + ' data-key="' + esc(key) + '" data-value="' + esc(v) + '">'
            + '<span class="bt-opt__box"></span>'
            + '<span class="bt-opt__label">' + esc(v) + '</span>'
            + '</button>';
    }
    return '<div class="bt-drop" data-key="' + esc(key) + '">'
         +   '<button class="bt-drop__toggle" type="button" data-key="' + esc(key) + '">'
         +     '<span class="bt-drop__name">' + esc(key) + '</span>'
         +     '<span class="bt-drop__badge"></span>'
         +     '<span class="bt-drop__arrow" aria-hidden="true"></span>'
         +   '</button>'
         +   '<div class="bt-drop__panel">'
         +     '<div class="bt-drop__head">'
         +       '<span class="bt-drop__title">' + esc(key) + '</span>'
         +       '<button class="bt-drop__close" type="button" aria-label="' + esc(cfg.closeLabel) + '">\u00D7</button>'
         +     '</div>'
         +     '<div class="bt-drop__opts">' + opts + '</div>'
         +     '<button class="bt-drop__done" type="button">' + esc(cfg.doneText) + '</button>'
         +   '</div>'
         + '</div>';
  }

  function bindFilters() {
    var filters = root.querySelector('.bt-filters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var t = e.target;
        var gchip = t.closest && t.closest('.bt-gchip');
        if (gchip) { setGender(gchip.dataset.gender); return; }
        var toggle = t.closest && t.closest('.bt-drop__toggle');
        if (toggle) { toggleDrop(toggle.dataset.key); return; }
        var opt = t.closest && t.closest('.bt-opt');
        if (opt) { toggleValue(opt.dataset.key, opt.dataset.value); return; }
        if (t.closest && (t.closest('.bt-drop__done') || t.closest('.bt-drop__close'))) { closeDrop(); return; }
      });
    }
    var reset = root.querySelector('.bt-reset');
    if (reset) reset.addEventListener('click', resetAll);
  }


  /* ============================================================
     БЛОК 9. КАРТОЧКИ — СОБЫТИЯ (открыть попап)
     ============================================================ */

  function bindGrid() {
    var grid = root.querySelector('#bt-grid');
    if (!grid) return;

    grid.addEventListener('click', function (e) {
      // клик по «Хочу этот» — не открывать попап, пусть ссылка работает
      if (e.target.closest && e.target.closest('.bt-cta')) return;
      var opener = e.target.closest && e.target.closest('.bt-card__open');
      if (!opener) return;
      var card = opener.closest('.bt-card');
      if (card) openPopup(card.dataset.id);
    });

    // на телефоне нет наведения — подсветку (ореол ярче + приподнятие)
    // включаем на касание. Класс снимается, когда палец уходит.
    grid.addEventListener('touchstart', function (e) {
      var card = e.target.closest && e.target.closest('.bt-card');
      var all = grid.querySelectorAll('.bt-card--active');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('bt-card--active');
      if (card) card.classList.add('bt-card--active');
    }, { passive: true });

    grid.addEventListener('touchend', function () {
      // небольшая задержка, чтобы подсветка успела «мигнуть» перед открытием попапа
      setTimeout(function () {
        var all = grid.querySelectorAll('.bt-card--active');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('bt-card--active');
      }, 220);
    }, { passive: true });
  }


  /* ============================================================
     БЛОК 10. ПОПАП
     ============================================================ */

  var popupEl = null;   // ссылка на узел попапа в <body>

  // создаём попап ОДИН раз и кладём прямо в <body>.
  // почему в body: Tilda вешает transform на родителей блока T123, из-за чего
  // position:fixed внутри каталога привязывается не к экрану — попап уезжает.
  // В body он привязан к экрану и на телефоне, и на компе.
  function ensurePopup() {
    if (popupEl && document.body.contains(popupEl)) return popupEl;
    popupEl = document.createElement('div');
    popupEl.className = 'bt-popup';
    popupEl.id = 'bt-popup';
    popupEl.setAttribute('aria-hidden', 'true');
    popupEl.innerHTML =
        '<div class="bt-popup__overlay"></div>'
      + '<div class="bt-popup__box" role="dialog" aria-modal="true">'
      +   '<button class="bt-popup__close" type="button" aria-label="' + esc(cfg.closeLabel) + '">\u00D7</button>'
      +   '<div class="bt-popup__content"></div>'
      + '</div>';
    document.body.appendChild(popupEl);
    bindPopup();
    return popupEl;
  }

  function isPopupOpen() {
    return popupEl && popupEl.classList.contains('bt-popup--open');
  }

  function openPopup(id) {
    var item = byId[id];
    var p = ensurePopup();
    if (!item || !p) return;

    var color = familyColor(item);
    var box = p.querySelector('.bt-popup__box');
    if (color) {
      box.style.setProperty('--fam', color);
      box.style.setProperty('--fam-rgb', hexToRgb(color));
      box.setAttribute('data-fam', '1');
    } else {
      box.removeAttribute('data-fam');
    }

    var img = item.image
      ? '<div class="bt-popup__media"><img src="' + esc(item.image) + '" alt="' + esc(item.title) + '"></div>'
      : '';

    // характеристики строкой (все, что есть у товара)
    var chips = '';
    if (item.attrs) {
      var line = [];
      for (var k in item.attrs) {
        if (k === cfg.genderKey) continue;
        var vals = item.attrs[k];
        if (vals && vals.length) line.push(vals.join(', '));
      }
      if (line.length) chips = '<div class="bt-popup__attrs">' + esc(line.join('  \u00B7  ')) + '</div>';
    }

    var textBlock = item.text
      ? '<div class="bt-popup__text">' + paragraphs(item.text) + '</div>' : '';
    var notesBlock = item.descr
      ? '<div class="bt-popup__notes"><span class="bt-popup__notes-label">Ноты</span>'
        + '<span class="bt-popup__notes-val">' + esc(item.descr) + '</span></div>' : '';

    p.querySelector('.bt-popup__content').innerHTML =
        img
      + '<div class="bt-popup__body">'
      +   '<h3 class="bt-popup__title">' + esc(item.title) + '</h3>'
      +   chips
      +   textBlock
      +   notesBlock
      +   ctaButtonHtml(item, 'popup')
      + '</div>';

    p.setAttribute('aria-hidden', 'false');
    p.classList.add('bt-popup--open');
    document.body.style.overflow = 'hidden';
    // фокус на крестик — для клавиатуры
    var close = p.querySelector('.bt-popup__close');
    if (close) close.focus();
  }

  function closePopup() {
    var p = popupEl;
    if (!p) return;
    p.classList.remove('bt-popup--open');
    p.setAttribute('aria-hidden', 'true');
    // прокрутку возвращаем, только если не открыта мобильная шторка-фильтр
    if (!openKey) document.body.style.overflow = '';
    // содержимое чистим чуть позже, чтобы не мигало при закрытии
    setTimeout(function () {
      if (!isPopupOpen()) {
        var c = p.querySelector('.bt-popup__content');
        if (c) c.innerHTML = '';
      }
    }, 250);
  }

  function bindPopup() {
    var p = popupEl;
    if (!p) return;
    p.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.bt-cta')) return;   // ссылка работает
      if (e.target.closest && e.target.closest('.bt-popup__close')) { closePopup(); return; }
      if (e.target.classList && e.target.classList.contains('bt-popup__overlay')) { closePopup(); return; }
    });
  }


  /* ============================================================
     БЛОК 11. СТИЛИ
     ============================================================ */

  function injectStyles() {
    if (document.getElementById('bt-catalog-styles')) return;

    var shade = cfg.bottomShade > 0
      ? 'linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(44,36,32,' + cfg.bottomShade + ') 100%)'
      : 'none';

    var lift = cfg.hoverLift > 0
      ? '@media (hover:hover){ .bt-card:hover { transform: translateY(-' + cfg.hoverLift + 'px);'
        + ' box-shadow: 0 16px 36px rgba(90,65,65,0.12); } }'
        + ' .bt-card--active { transform: translateY(-' + cfg.hoverLift + 'px);'
        + ' box-shadow: 0 16px 36px rgba(90,65,65,0.12); }'
      : '';

    var css = [
      '.bt-catalog { box-sizing:border-box; width:100%; max-width:' + cfg.maxWidth + 'px;',
      '  margin:0 auto; padding:0 16px; background:' + cfg.colorBg + '; font-family:' + cfg.fontBody + '; }',
      '.bt-catalog *, .bt-catalog *::before, .bt-catalog *::after { box-sizing:border-box; }',

      '.bt-note { text-align:center; font-size:' + cfg.bodySize + 'px; font-weight:' + cfg.bodyWeight + ';',
      '  color:' + cfg.colorMuted + '; letter-spacing:.3px; margin:0 0 24px; }',

      /* -- фильтры -- */
      '.bt-filters { margin:0 0 16px; }',
      '.bt-gender { display:inline-flex; gap:4px; padding:4px; background:rgba(255,255,255,0.45);',
      '  border-radius:100px; border:1px solid rgba(107,79,79,0.15); margin-bottom:12px; }',
      '.bt-gchip { font-family:' + cfg.fontBody + '; font-size:13px; color:' + cfg.colorText + ';',
      '  background:transparent; border:none; border-radius:100px; padding:7px 16px; cursor:pointer;',
      '  line-height:1.2; transition:background .2s,color .2s; }',
      '.bt-gchip--on { background:' + cfg.colorAccent + '; color:#F3EDE8; }',
      '.bt-drops { display:flex; flex-wrap:wrap; gap:8px; }',
      '.bt-drop { position:relative; }',
      '.bt-drop__toggle { display:inline-flex; align-items:center; gap:7px; font-family:' + cfg.fontBody + ';',
      '  font-size:13px; color:' + cfg.colorText + '; background:rgba(255,255,255,0.55);',
      '  border:1px solid rgba(107,79,79,0.18); border-radius:100px; padding:8px 15px; cursor:pointer;',
      '  line-height:1.2; transition:background .2s,border-color .2s; }',
      '.bt-drop__toggle--on { border-color:' + cfg.colorAccent + '; }',
      '.bt-drop__name { white-space:nowrap; }',
      '.bt-drop__badge:not(:empty) { display:inline-flex; align-items:center; justify-content:center;',
      '  min-width:18px; height:18px; padding:0 5px; border-radius:100px; background:' + cfg.colorAccent + ';',
      '  color:#F3EDE8; font-size:11px; }',
      '.bt-drop__arrow { width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent;',
      '  border-top:5px solid ' + cfg.colorMuted + '; transition:transform .25s; }',
      '.bt-drop--open .bt-drop__arrow { transform:rotate(180deg); }',
      '.bt-drop__panel { position:absolute; top:calc(100% + 6px); left:0; z-index:40; min-width:180px; max-width:260px;',
      '  padding:8px; background:#FBF8F5; border:1px solid rgba(107,79,79,0.15); border-radius:16px;',
      '  box-shadow:0 16px 40px rgba(90,65,65,0.16); opacity:0; visibility:hidden; transform:translateY(-6px);',
      '  transition:opacity .2s,transform .2s,visibility .2s; }',
      '.bt-drop--open .bt-drop__panel { opacity:1; visibility:visible; transform:translateY(0); }',
      '.bt-drop__head { display:none; align-items:center; justify-content:space-between; padding:2px 4px 12px;',
      '  margin-bottom:6px; border-bottom:1px solid rgba(107,79,79,0.12); }',
      '.bt-drop__title { font-family:' + cfg.fontTitle + '; font-size:22px; color:' + cfg.colorText + '; }',
      '.bt-drop__close { font-size:28px; line-height:1; color:' + cfg.colorMuted + '; background:none; border:none;',
      '  cursor:pointer; padding:0 6px; }',
      '.bt-drop__opts { display:flex; flex-direction:column; gap:2px; max-height:260px; overflow-y:auto; }',
      '.bt-opt { display:flex; align-items:center; gap:10px; width:100%; font-family:' + cfg.fontBody + ';',
      '  font-size:14px; color:' + cfg.colorText + '; background:none; border:none; border-radius:10px;',
      '  padding:9px 10px; cursor:pointer; text-align:left; transition:background .15s; }',
      '@media (hover:hover){ .bt-opt:hover { background:rgba(107,79,79,0.06); } }',
      '.bt-opt__box { flex:0 0 auto; width:18px; height:18px; border-radius:5px; border:1.5px solid rgba(107,79,79,0.4);',
      '  position:relative; transition:background .15s,border-color .15s; }',
      '.bt-opt--on .bt-opt__box { background:' + cfg.colorAccent + '; border-color:' + cfg.colorAccent + '; }',
      '.bt-opt--on .bt-opt__box::after { content:""; position:absolute; left:5px; top:1px; width:5px; height:10px;',
      '  border:solid #F3EDE8; border-width:0 2px 2px 0; transform:rotate(45deg); }',
      '.bt-drop__done { display:block; width:100%; margin-top:6px; padding:9px; font-family:' + cfg.fontBody + ';',
      '  font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#F3EDE8; background:' + cfg.colorAccent + ';',
      '  border:none; border-radius:10px; cursor:pointer; }',

      '.bt-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 20px; }',
      '.bt-count { font-size:' + cfg.metaSize + 'px; letter-spacing:1.2px; text-transform:uppercase;',
      '  color:' + cfg.colorMuted + '; opacity:.8; }',
      '.bt-reset { font-family:' + cfg.fontBody + '; font-size:' + cfg.metaSize + 'px; letter-spacing:1.2px;',
      '  text-transform:uppercase; color:' + cfg.colorAccent + '; background:none; border:none; cursor:pointer;',
      '  padding:4px 2px; text-decoration:underline; text-underline-offset:3px; }',

      /* -- сетка -- */
      '.bt-grid { display:grid; gap:' + cfg.gap + 'px; position:relative; margin:0 auto;',
      '  max-width:' + (cfg.maxColumns * (cfg.minCardWidth + cfg.gap)) + 'px;',
      '  grid-template-columns:repeat(auto-fill, minmax(' + cfg.minCardWidth + 'px, 1fr)); }',
      '.bt-grid--empty { display:block; max-width:none; }',

      /* -- карточка -- */
      '.bt-card { position:relative; display:flex; flex-direction:column; background-color:' + cfg.colorCard + ';',
      '  border-radius:' + cfg.cardRadius + 'px; overflow:hidden; box-shadow:0 8px 24px rgba(90,65,65,0.06);',
      '  transition:transform .35s cubic-bezier(0.16,1,0.3,1), box-shadow .35s ease, filter .35s ease; }',
      lift,
      /* затемнение низа — псевдоэлемент поверх, под текст и кнопку он не лезет (кнопка выше по z) */
      '.bt-card::after { content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;',
      '  background:' + shade + '; z-index:1; }',

      '.bt-card__open { display:flex; flex-direction:column; flex:1 1 auto; width:100%; text-align:left;',
      '  background:none; border:none; padding:0; cursor:pointer; position:relative; z-index:2; font:inherit; color:inherit; }',

      '.bt-card__media { display:block; position:relative; padding:' + cfg.imagePad + 'px; }',
      '.bt-card__img { display:block; width:100%; aspect-ratio:1/1; object-fit:' + cfg.imageFit + ';',
      '  border-radius:' + cfg.imageRadius + 'px; background:rgba(140,120,110,0.08); position:relative; z-index:1; }',

      /* ОРЕОЛ: цветное свечение под картинкой, виден всегда, ярче при наведении/тапе */
      '.bt-card__halo { position:absolute; left:' + cfg.imagePad + 'px; right:' + cfg.imagePad + 'px;',
      '  top:' + cfg.imagePad + 'px; bottom:' + cfg.imagePad + 'px; border-radius:' + cfg.imageRadius + 'px;',
      '  z-index:0; pointer-events:none; opacity:' + cfg.haloAlways + ';',
      '  transition:opacity .4s ease, box-shadow .4s ease;',
      '  box-shadow:0 10px 44px 6px rgba(var(--fam-rgb),0.6); }',

      '.bt-card__body { display:flex; flex-direction:column; flex:1 1 auto;',
      '  padding:0 ' + cfg.cardPadding + 'px ' + (cfg.cardPadding + 4) + 'px; position:relative; z-index:2; }',
      '.bt-card__title { display:block; margin:0 0 8px; font-family:' + cfg.fontTitle + '; font-size:' + cfg.titleSize + 'px;',
      '  font-weight:' + cfg.titleWeight + '; line-height:1.25; color:' + cfg.colorText + '; }',
      '.bt-card__descr { display:block; margin:0; font-size:' + cfg.bodySize + 'px; font-weight:' + cfg.bodyWeight + ';',
      '  line-height:1.55; color:' + cfg.colorMuted + '; }',
      '.bt-card__meta { display:block; margin-top:12px; font-size:' + cfg.metaSize + 'px; letter-spacing:1.4px;',
      '  text-transform:uppercase; color:' + cfg.colorAccent + '; opacity:.75; }',
      '.bt-card__hint { display:block; margin-top:auto; padding-top:12px; font-size:11px; letter-spacing:.4px;',
      '  color:' + cfg.colorMuted + '; opacity:.6; }',

      /* кнопка «Хочу этот» — стеклянная, поверх всего, z выше открывашки */
      '.bt-cta { position:relative; z-index:3; display:block; margin:0 ' + cfg.cardPadding + 'px ' + cfg.cardPadding + 'px;',
      '  text-align:center; text-decoration:none; font-family:' + cfg.fontBody + '; font-size:12px; letter-spacing:1.4px;',
      '  text-transform:uppercase; color:#F3EDE8; padding:13px 18px; border-radius:100px;',
      '  background:rgba(107,79,79,0.92); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);',
      '  border:1px solid rgba(255,255,255,0.18); transition:background .25s, transform .15s; }',
      '@media (hover:hover){ .bt-cta:hover { background:' + cfg.colorAccent + '; transform:translateY(-1px); } }',
      '.bt-cta--popup { margin:22px 0 0; }',

      /* ВУАЛЬ: при наведении/тапе на карточку — притемняем соседей */
      cfg.veilEnabled ? '@media (hover:hover){ .bt-grid:hover .bt-card:not(:hover) { filter:brightness(0.82) saturate(0.9); } }' : '',
      /* при наведении/тапе — ореол ярче */
      '@media (hover:hover){ .bt-card:hover .bt-card__halo { opacity:' + cfg.haloActive + ';',
      '  box-shadow:0 14px 54px 8px rgba(var(--fam-rgb),0.95); } }',
      '.bt-card--active .bt-card__halo { opacity:' + cfg.haloActive + ';',
      '  box-shadow:0 14px 54px 8px rgba(var(--fam-rgb),0.95); }',

      /* заглушки */
      '.bt-card--ghost { box-shadow:none; }',
      '.bt-card--ghost::after { display:none; }',
      '.bt-card--ghost .bt-card__media::after { content:""; display:block; width:100%; aspect-ratio:1/1;',
      '  border-radius:' + cfg.imageRadius + 'px; background:rgba(140,120,110,0.10); }',
      '.bt-ghost-line { height:10px; border-radius:6px; margin-bottom:10px; background:rgba(140,120,110,0.10); }',
      '.bt-ghost-line--title { height:16px; width:60%; }',
      '.bt-ghost-line--short { width:40%; }',
      '.bt-card--ghost { animation:bt-breathe 1.6s ease-in-out infinite; }',
      '@keyframes bt-breathe { 0%,100%{opacity:.55} 50%{opacity:1} }',

      /* сообщения */
      '.bt-msg { text-align:center; padding:48px 0; font-family:' + cfg.fontTitle + '; font-size:19px; color:' + cfg.colorMuted + '; }',
      '.bt-msg--error { font-family:' + cfg.fontBody + '; font-size:15px; }',
      '.bt-retry { display:block; margin:18px auto 0; padding:12px 26px; border:none; border-radius:100px; cursor:pointer;',
      '  font-family:' + cfg.fontBody + '; font-size:11px; letter-spacing:1.5px; text-transform:uppercase;',
      '  color:#F3EDE8; background:' + cfg.colorAccent + '; }',

      /* ============ ПОПАП ============ */
      '.bt-popup { position:fixed; inset:0; z-index:1000; display:none; }',
      '.bt-popup--open { display:block; }',
      '.bt-popup__overlay { position:absolute; inset:0; z-index:1; background:rgba(44,36,32,0.5);',
      '  -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); opacity:0; animation:bt-fade .3s forwards; }',
      '.bt-popup__box { position:absolute; z-index:2; left:50%; top:50%; transform:translate(-50%,-48%);',
      '  width:calc(100% - 40px); max-width:560px; max-height:88vh; overflow-y:auto;',
      '  background:#FBF8F5; border-radius:24px; padding:0 0 30px; box-shadow:0 30px 80px rgba(44,36,32,0.4);',
      '  opacity:0; animation:bt-pop .35s cubic-bezier(0.16,1,0.3,1) forwards; }',
      '.bt-popup__box[data-fam="1"] { box-shadow:0 30px 80px rgba(44,36,32,0.4), 0 0 0 1px rgba(var(--fam-rgb),0.3); }',
      '.bt-popup__close { position:absolute; top:14px; right:14px; z-index:2; width:38px; height:38px; border-radius:100px;',
      '  border:none; cursor:pointer; font-size:26px; line-height:1; color:' + cfg.colorText + ';',
      '  background:rgba(255,255,255,0.75); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }',
      '.bt-popup__media { padding:14px 14px 0; }',
      '.bt-popup__media img { display:block; width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:' + cfg.imageRadius + 'px; }',
      '.bt-popup__box[data-fam="1"] .bt-popup__media img { box-shadow:0 10px 40px rgba(var(--fam-rgb),0.5); }',
      '.bt-popup__body { padding:22px 28px 0; }',
      '.bt-popup__title { margin:0 0 10px; font-family:' + cfg.fontTitle + '; font-weight:600; font-size:30px;',
      '  line-height:1.15; color:' + cfg.colorText + '; }',
      '.bt-popup__attrs { font-size:' + cfg.metaSize + 'px; letter-spacing:1.4px; text-transform:uppercase;',
      '  color:' + cfg.colorAccent + '; opacity:.8; margin-bottom:18px; }',
      '.bt-popup__text { font-size:16px; line-height:1.7; color:' + cfg.colorText + '; }',
      '.bt-popup__text p { margin:0 0 14px; }',
      '.bt-popup__notes { margin-top:18px; padding-top:16px; border-top:1px solid rgba(107,79,79,0.15); }',
      '.bt-popup__notes-label { display:block; font-size:' + cfg.metaSize + 'px; letter-spacing:1.4px;',
      '  text-transform:uppercase; color:' + cfg.colorMuted + '; opacity:.7; margin-bottom:5px; }',
      '.bt-popup__notes-val { font-size:15px; line-height:1.5; color:' + cfg.colorText + '; }',

      /* -- мобильные шторки (фильтры И попап) снизу -- */
      '@media (max-width:560px) {',
      '  .bt-drops { gap:8px; }',
      '  .bt-drop--open::before { content:""; position:fixed; inset:0; z-index:90; background:rgba(44,36,32,0.38); }',
      '  .bt-drop__panel { position:fixed; left:0; right:0; bottom:0; top:auto; z-index:100; min-width:0; max-width:none;',
      '    border-radius:22px 22px 0 0; padding:16px 16px 20px; box-shadow:0 -12px 40px rgba(44,36,32,0.22); transform:translateY(100%); }',
      '  .bt-drop--open .bt-drop__panel { transform:translateY(0); }',
      '  .bt-drop__head { display:flex; }',
      '  .bt-drop__opts { max-height:52vh; }',
      '  .bt-opt { font-size:16px; padding:12px 10px; }',
      '  .bt-opt__box { width:22px; height:22px; }',
      '  .bt-opt--on .bt-opt__box::after { left:7px; top:2px; width:6px; height:12px; }',
      '  .bt-drop__done { margin-top:10px; padding:13px; font-size:12px; }',
      /* попап как шторка снизу */
      '  .bt-popup__box { left:0; top:auto; bottom:0; transform:none; width:100%; max-width:none;',
      '    max-height:92vh; border-radius:24px 24px 0 0; opacity:1;',
      '    animation:bt-sheet .35s cubic-bezier(0.16,1,0.3,1) forwards; }',
      '  .bt-popup__body { padding:20px 20px 0; }',
      '  .bt-popup__title { font-size:26px; }',
      /* на телефоне карточки идут по одной — затемнение низа не нужно */
      '  .bt-card::after { display:none; }',
      /* iOS: blur поверх контента даёт молочную пелену — на телефоне только затемнение, без blur */
      '  .bt-popup__overlay { -webkit-backdrop-filter:none; backdrop-filter:none; background:rgba(44,36,32,0.55); }',
      '}',

      '@keyframes bt-fade { to { opacity:1; } }',
      '@keyframes bt-pop { from { opacity:0; transform:translate(-50%,-46%) scale(0.98);} to { opacity:1; transform:translate(-50%,-50%) scale(1);} }',
      '@keyframes bt-sheet { from { transform:translateY(100%); opacity:1;} to { transform:translateY(0); opacity:1;} }',

      '@media (prefers-reduced-motion:reduce) {',
      '  .bt-card, .bt-card--ghost, .bt-drop__panel, .bt-drop__arrow, .bt-card__halo,',
      '  .bt-popup__overlay, .bt-popup__box { transition:none; animation:none; } }',
    ].join('\n');

    var tag = document.createElement('style');
    tag.id = 'bt-catalog-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function loadFonts() {
    if (!cfg.fontsUrl || document.getElementById('bt-catalog-fonts')) return;
    var pre = document.createElement('link');
    pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);
    var link = document.createElement('link');
    link.id = 'bt-catalog-fonts'; link.rel = 'stylesheet'; link.href = cfg.fontsUrl; link.media = 'print';
    link.onload = function () { this.media = 'all'; };
    document.head.appendChild(link);
  }


  /* ============================================================
     БЛОК 12. МЕЛОЧИ
     ============================================================ */

  function merge(base, extra) {
    var out = {};
    for (var k in base)  out[k] = base[k];
    for (var j in extra) if (extra[j] !== undefined) out[j] = extra[j];
    return out;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // текст со \n -> абзацы <p>
  function paragraphs(text) {
    var blocks = String(text).split(/\n{1,}/);
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
      var line = blocks[i].trim();
      if (line) out += '<p>' + esc(line) + '</p>';
    }
    return out || '<p>' + esc(text) + '</p>';
  }

})();