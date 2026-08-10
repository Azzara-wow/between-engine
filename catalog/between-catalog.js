/* ============================================================
   BETWEEN — движок каталога (between-catalog.js)
   Часть 1 + 2: загрузка, карточки, сетка, адаптив, ФИЛЬТРЫ.
   Фильтры — выпадающие списки (Семья ▾, Настроение ▾…),
   пол — отдельный сегмент Она/Он/Все.
   Эффекты и попап — часть 3, позже.

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
             + '?family=Cormorant+Garamond:wght@400;500'
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
    minCardWidth: 260,
    maxWidth:     1200,

    /* -- картинка -- */
    imageFit:   'cover',
    eagerCount: 4,

    /* -- поведение карточки -- */
    hoverLift:   3,
    bottomShade: 0.05,

    /* -- что показываем -- */
    attrsOnCard: [],
    showPrice:   false,
    note:        '',

    /* -- ФИЛЬТРЫ --
       filters — характеристики-фильтры В ТОМ ПОРЯДКЕ, как показать.
       Каждая станет отдельной кнопкой-выпадашкой с галочками.
       Значения движок берёт из данных сам. «Пол» тут НЕ пишем. */
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
    doneText:    'Готово',        // кнопка закрытия выпадашки
  };

  var cfg = merge(DEFAULTS, window.BT_CATALOG || {});


  /* ============================================================
     БЛОК 2. СОСТОЯНИЕ И ЗАПУСК
     ============================================================ */

  var root   = null;
  var ALL    = [];
  var facets = {};
  var gender = 'all';
  var picked = {};               // { 'Семья': ['цветочный', ...] }
  var openKey = null;            // какая выпадашка сейчас раскрыта

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

    // клик мимо раскрытой выпадашки — закрыть её
    document.addEventListener('click', function (e) {
      if (!openKey) return;
      if (root.contains(e.target) && e.target.closest &&
          e.target.closest('.bt-drop')) return;
      closeDrop();
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

  function countFor(key) {
    return (picked[key] && picked[key].length) || 0;
  }

  function toggleValue(key, value) {
    if (!picked[key]) picked[key] = [];
    var idx = picked[key].indexOf(value);
    if (idx === -1) picked[key].push(value);
    else            picked[key].splice(idx, 1);
    if (!picked[key].length) delete picked[key];
    updateView();
  }

  function setGender(g) { gender = g; updateView(); }

  function resetAll() {
    gender = 'all'; picked = {}; closeDrop(); updateView();
  }

  function anyPicked() {
    if (gender !== 'all') return true;
    for (var k in picked) if (picked[k] && picked[k].length) return true;
    return false;
  }


  /* ============================================================
     БЛОК 5. ВЫПАДАШКИ
     ============================================================ */

  function openDrop(key) { openKey = key; syncDrops(); }
  function closeDrop()   { openKey = null; syncDrops(); }
  function toggleDrop(key) { if (openKey === key) closeDrop(); else openDrop(key); }

  // показать/спрятать панели и повернуть стрелки, без перерисовки всего
  function syncDrops() {
    var wraps = root.querySelectorAll('.bt-drop');
    for (var i = 0; i < wraps.length; i++) {
      var w = wraps[i];
      var on = (w.dataset.key === openKey);
      w.className = 'bt-drop' + (on ? ' bt-drop--open' : '');
    }
  }


  /* ============================================================
     БЛОК 6. РИСОВАНИЕ
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

    bindFilters();
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

    // сегмент пола
    var gchips = root.querySelectorAll('.bt-gchip');
    for (var g = 0; g < gchips.length; g++) {
      var gc = gchips[g];
      gc.className = 'bt-gchip' + (gc.dataset.gender === gender ? ' bt-gchip--on' : '');
    }

    // кнопки-выпадашки: показать счётчик выбранного и подсветить
    var toggles = root.querySelectorAll('.bt-drop__toggle');
    for (var t = 0; t < toggles.length; t++) {
      var tg = toggles[t];
      var key = tg.dataset.key;
      var n = countFor(key);
      var badge = tg.querySelector('.bt-drop__badge');
      if (badge) badge.textContent = n ? String(n) : '';
      tg.className = 'bt-drop__toggle' + (n ? ' bt-drop__toggle--on' : '');
    }

    // галочки внутри открытых панелей
    var opts = root.querySelectorAll('.bt-opt');
    for (var o = 0; o < opts.length; o++) {
      var op = opts[o];
      var k = op.dataset.key, v = op.dataset.value;
      var on = !!(picked[k] && picked[k].indexOf(v) !== -1);
      op.className = 'bt-opt' + (on ? ' bt-opt--on' : '');
    }
  }

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
      for (var i = 0; i < keys.length; i++) {
        drops += dropHtml(keys[i]);
      }
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
         +     '<div class="bt-drop__opts">' + opts + '</div>'
         +     '<button class="bt-drop__done" type="button">' + esc(cfg.doneText) + '</button>'
         +   '</div>'
         + '</div>';
  }

  function bindFilters() {
    var filters = root.querySelector('.bt-filters');
    if (!filters) return;

    filters.addEventListener('click', function (e) {
      var t = e.target;

      var gchip = t.closest && t.closest('.bt-gchip');
      if (gchip) { setGender(gchip.dataset.gender); return; }

      var toggle = t.closest && t.closest('.bt-drop__toggle');
      if (toggle) { toggleDrop(toggle.dataset.key); return; }

      var opt = t.closest && t.closest('.bt-opt');
      if (opt) { toggleValue(opt.dataset.key, opt.dataset.value); return; }

      var done = t.closest && t.closest('.bt-drop__done');
      if (done) { closeDrop(); return; }
    });

    var reset = root.querySelector('.bt-reset');
    if (reset) reset.addEventListener('click', resetAll);
  }

  function cardHtml(item, index) {
    var eager = index < cfg.eagerCount;

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
      if (parts.length) meta = '<div class="bt-card__meta">' + esc(parts.join('  ·  ')) + '</div>';
    }

    var price = '';
    if (cfg.showPrice && item.price) {
      price = '<div class="bt-card__price">' + formatPrice(item.price) + '</div>';
    }

    return '<article class="bt-card" data-id="' + esc(item.id) + '">'
         +   '<div class="bt-card__media">' + media + '</div>'
         +   '<div class="bt-card__body">'
         +     '<h3 class="bt-card__title">' + esc(item.title) + '</h3>'
         +     (item.descr ? '<p class="bt-card__descr">' + esc(item.descr) + '</p>' : '')
         +     meta + price
         +   '</div>'
         + '</article>';
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
     БЛОК 7. СТИЛИ
     ============================================================ */

  function injectStyles() {
    if (document.getElementById('bt-catalog-styles')) return;

    var shade = cfg.bottomShade > 0
      ? 'background-image: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(44,36,32,' + cfg.bottomShade + ') 100%);'
      : '';

    var lift = cfg.hoverLift > 0
      ? '.bt-card:hover { transform: translateY(-' + cfg.hoverLift + 'px);'
        + ' box-shadow: 0 16px 36px rgba(90,65,65,0.12); }'
      : '';

    var css = [
      '.bt-catalog { box-sizing: border-box; width: 100%; max-width: ' + cfg.maxWidth + 'px;',
      '  margin: 0 auto; padding: 0 16px; background: ' + cfg.colorBg + ';',
      '  font-family: ' + cfg.fontBody + '; }',
      '.bt-catalog *, .bt-catalog *::before, .bt-catalog *::after { box-sizing: border-box; }',

      '.bt-note { text-align: center; font-size: ' + cfg.bodySize + 'px;',
      '  font-weight: ' + cfg.bodyWeight + '; color: ' + cfg.colorMuted + ';',
      '  letter-spacing: .3px; margin: 0 0 24px; }',

      /* -- панель фильтров -- */
      '.bt-filters { margin: 0 0 16px; }',

      /* пол */
      '.bt-gender { display: inline-flex; gap: 4px; padding: 4px;',
      '  background: rgba(255,255,255,0.45); border-radius: 100px;',
      '  border: 1px solid rgba(107,79,79,0.15); margin-bottom: 12px; }',
      '.bt-gchip { font-family: ' + cfg.fontBody + '; font-size: 13px; color: ' + cfg.colorText + ';',
      '  background: transparent; border: none; border-radius: 100px;',
      '  padding: 7px 16px; cursor: pointer; line-height: 1.2; transition: background .2s, color .2s; }',
      '.bt-gchip--on { background: ' + cfg.colorAccent + '; color: #F3EDE8; }',

      /* ряд выпадашек */
      '.bt-drops { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.bt-drop { position: relative; }',

      '.bt-drop__toggle { display: inline-flex; align-items: center; gap: 7px;',
      '  font-family: ' + cfg.fontBody + '; font-size: 13px; color: ' + cfg.colorText + ';',
      '  background: rgba(255,255,255,0.55); border: 1px solid rgba(107,79,79,0.18);',
      '  border-radius: 100px; padding: 8px 15px; cursor: pointer; line-height: 1.2;',
      '  transition: background .2s, border-color .2s; }',
      '.bt-drop__toggle--on { border-color: ' + cfg.colorAccent + '; }',
      '.bt-drop__name { white-space: nowrap; }',
      '.bt-drop__badge:not(:empty) { display: inline-flex; align-items: center; justify-content: center;',
      '  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 100px;',
      '  background: ' + cfg.colorAccent + '; color: #F3EDE8; font-size: 11px; }',
      '.bt-drop__arrow { width: 0; height: 0; border-left: 4px solid transparent;',
      '  border-right: 4px solid transparent; border-top: 5px solid ' + cfg.colorMuted + ';',
      '  transition: transform .25s; }',
      '.bt-drop--open .bt-drop__arrow { transform: rotate(180deg); }',

      /* панель со списком */
      '.bt-drop__panel { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;',
      '  min-width: 180px; max-width: 260px; padding: 8px;',
      '  background: #FBF8F5; border: 1px solid rgba(107,79,79,0.15);',
      '  border-radius: 16px; box-shadow: 0 16px 40px rgba(90,65,65,0.16);',
      '  opacity: 0; visibility: hidden; transform: translateY(-6px);',
      '  transition: opacity .2s, transform .2s, visibility .2s; }',
      '.bt-drop--open .bt-drop__panel { opacity: 1; visibility: visible; transform: translateY(0); }',

      '.bt-drop__opts { display: flex; flex-direction: column; gap: 2px;',
      '  max-height: 260px; overflow-y: auto; }',
      '.bt-opt { display: flex; align-items: center; gap: 10px; width: 100%;',
      '  font-family: ' + cfg.fontBody + '; font-size: 14px; color: ' + cfg.colorText + ';',
      '  background: none; border: none; border-radius: 10px; padding: 9px 10px;',
      '  cursor: pointer; text-align: left; transition: background .15s; }',
      '.bt-opt:hover { background: rgba(107,79,79,0.06); }',
      '.bt-opt__box { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 5px;',
      '  border: 1.5px solid rgba(107,79,79,0.4); position: relative; transition: background .15s, border-color .15s; }',
      '.bt-opt--on .bt-opt__box { background: ' + cfg.colorAccent + '; border-color: ' + cfg.colorAccent + '; }',
      '.bt-opt--on .bt-opt__box::after { content: ""; position: absolute; left: 5px; top: 1px;',
      '  width: 5px; height: 10px; border: solid #F3EDE8; border-width: 0 2px 2px 0; transform: rotate(45deg); }',
      '.bt-opt__label { line-height: 1.2; }',

      '.bt-drop__done { display: block; width: 100%; margin-top: 6px; padding: 9px;',
      '  font-family: ' + cfg.fontBody + '; font-size: 11px; letter-spacing: 1.2px;',
      '  text-transform: uppercase; color: #F3EDE8; background: ' + cfg.colorAccent + ';',
      '  border: none; border-radius: 10px; cursor: pointer; }',

      /* строка счётчика */
      '.bt-bar { display: flex; align-items: center; justify-content: space-between;',
      '  gap: 12px; margin: 0 0 20px; }',
      '.bt-count { font-size: ' + cfg.metaSize + 'px; letter-spacing: 1.2px;',
      '  text-transform: uppercase; color: ' + cfg.colorMuted + '; opacity: .8; }',
      '.bt-reset { font-family: ' + cfg.fontBody + '; font-size: ' + cfg.metaSize + 'px;',
      '  letter-spacing: 1.2px; text-transform: uppercase; color: ' + cfg.colorAccent + ';',
      '  background: none; border: none; cursor: pointer; padding: 4px 2px;',
      '  text-decoration: underline; text-underline-offset: 3px; }',

      /* -- сетка и карточки -- */
      '.bt-grid { display: grid; gap: ' + cfg.gap + 'px;',
      '  grid-template-columns: repeat(auto-fill, minmax(' + cfg.minCardWidth + 'px, 1fr)); }',
      '.bt-grid--empty { display: block; }',

      '.bt-card { position: relative; background-color: ' + cfg.colorCard + ';',
      '  ' + shade,
      '  border-radius: ' + cfg.cardRadius + 'px; overflow: hidden;',
      '  box-shadow: 0 8px 24px rgba(90,65,65,0.06);',
      '  transition: transform .35s cubic-bezier(0.16,1,0.3,1), box-shadow .35s ease; }',
      lift,

      '.bt-card__media { padding: ' + cfg.imagePad + 'px; }',
      '.bt-card__img { display: block; width: 100%; aspect-ratio: 1 / 1;',
      '  object-fit: ' + cfg.imageFit + '; border-radius: ' + cfg.imageRadius + 'px;',
      '  background: rgba(140,120,110,0.08); }',

      '.bt-card__body { padding: 0 ' + cfg.cardPadding + 'px ' + (cfg.cardPadding + 4) + 'px; }',
      '.bt-card__title { margin: 0 0 8px; font-family: ' + cfg.fontTitle + ';',
      '  font-size: ' + cfg.titleSize + 'px; font-weight: ' + cfg.titleWeight + ';',
      '  line-height: 1.25; color: ' + cfg.colorText + '; }',
      '.bt-card__descr { margin: 0; font-size: ' + cfg.bodySize + 'px;',
      '  font-weight: ' + cfg.bodyWeight + '; line-height: 1.55; color: ' + cfg.colorMuted + '; }',
      '.bt-card__meta { margin-top: 12px; font-size: ' + cfg.metaSize + 'px;',
      '  letter-spacing: 1.4px; text-transform: uppercase; color: ' + cfg.colorAccent + '; opacity: .75; }',
      '.bt-card__price { margin-top: 12px; font-size: ' + cfg.bodySize + 'px; color: ' + cfg.colorText + '; }',

      /* заглушки */
      '.bt-card--ghost { box-shadow: none; background-image: none; }',
      '.bt-card--ghost .bt-card__media::after { content: ""; display: block;',
      '  width: 100%; aspect-ratio: 1 / 1; border-radius: ' + cfg.imageRadius + 'px;',
      '  background: rgba(140,120,110,0.10); }',
      '.bt-ghost-line { height: 10px; border-radius: 6px; margin-bottom: 10px;',
      '  background: rgba(140,120,110,0.10); }',
      '.bt-ghost-line--title { height: 16px; width: 60%; }',
      '.bt-ghost-line--short { width: 40%; }',
      '.bt-card--ghost { animation: bt-breathe 1.6s ease-in-out infinite; }',
      '@keyframes bt-breathe { 0%,100% { opacity: .55 } 50% { opacity: 1 } }',

      /* сообщения */
      '.bt-msg { text-align: center; padding: 48px 0; font-family: ' + cfg.fontTitle + ';',
      '  font-size: 19px; color: ' + cfg.colorMuted + '; }',
      '.bt-msg--error { font-family: ' + cfg.fontBody + '; font-size: 15px; }',
      '.bt-retry { display: block; margin: 18px auto 0; padding: 12px 26px; border: none;',
      '  border-radius: 100px; cursor: pointer; font-family: ' + cfg.fontBody + ';',
      '  font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;',
      '  color: #F3EDE8; background: ' + cfg.colorAccent + '; }',

      /* на телефоне выпадашка раскрывается на всю ширину строки фильтров */
      '@media (max-width: 560px) {',
      '  .bt-drop { position: static; }',
      '  .bt-drop__panel { left: 16px; right: 16px; min-width: 0; max-width: none; } }',

      /* hover-эффекты — ТОЛЬКО там, где есть настоящая мышь.',
         на телефоне это убирает застрявшую белую подсветку после тапа */
      '@media (hover: hover) {',
      '  .bt-gchip:hover { background: rgba(107,79,79,0.10); }',
      '  .bt-gchip--on:hover { background: ' + cfg.colorAccent + '; }',
      '  .bt-drop__toggle:hover { background: rgba(255,255,255,0.85); } }',

      '@media (prefers-reduced-motion: reduce) {',
      '  .bt-card, .bt-card--ghost, .bt-drop__panel, .bt-drop__arrow { transition: none; animation: none; } }',
    ].join('\n');

    var tag = document.createElement('style');
    tag.id = 'bt-catalog-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function loadFonts() {
    if (!cfg.fontsUrl || document.getElementById('bt-catalog-fonts')) return;

    var pre = document.createElement('link');
    pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);

    var link = document.createElement('link');
    link.id = 'bt-catalog-fonts'; link.rel = 'stylesheet';
    link.href = cfg.fontsUrl; link.media = 'print';
    link.onload = function () { this.media = 'all'; };
    document.head.appendChild(link);
  }


  /* ============================================================
     БЛОК 8. МЕЛОЧИ
     ============================================================ */

  function merge(base, extra) {
    var out = {};
    for (var k in base)  out[k] = base[k];
    for (var j in extra) if (extra[j] !== undefined) out[j] = extra[j];
    return out;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' \u20BD';
  }

})();