/* ============================================================
   BETWEEN — движок каталога (between-catalog.js)
   Часть 1 + 2: загрузка, карточки, сетка, адаптив, ФИЛЬТРЫ.
   Эффекты и попап — часть 3, позже.

   Куда класть:  between-engine → /catalog/between-catalog.js
   Как звать:    https://between-engine.pages.dev/catalog/between-catalog.js

   Настройка КОНКРЕТНОЙ страницы — в блоке T123 (window.BT_CATALOG).
   Всё, что в БЛОКЕ 1, — общий стиль для всех страниц; настройка
   страницы это перебивает.
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     БЛОК 1. ОБЩИЕ НАСТРОЙКИ — стиль каталога Between
     Правится руками. Действует на все страницы сразу.
     ============================================================ */

  var DEFAULTS = {

    /* -- откуда берём данные -- */
    api:   'https://between-quiz.eaburdenko.workers.dev/catalog',
    kind:  'perfume',            // perfume | aromadesign
    mount: '#bt-catalog',        // куда рисовать

    /* -- палитра -- */
    colorText:   '#2C2420',      // названия, основной текст
    colorMuted:  '#6A5E56',      // описания, подписи
    colorAccent: '#6B4F4F',      // бордо
    colorCard:   '#F3EFEB',      // фон карточки
    colorBg:     'transparent',  // фон блока (обычно берём фон страницы)

    /* -- шрифты -- */
    fontTitle: "'Cormorant Garamond', Georgia, serif",
    fontBody:  "'Jost', 'Helvetica Neue', sans-serif",
    fontsUrl:  'https://fonts.googleapis.com/css2'
             + '?family=Cormorant+Garamond:wght@400;500'
             + '&family=Jost:wght@300;400'
             + '&display=swap',

    /* -- размеры -- */
    titleSize:   20,   // название аромата, px
    bodySize:    14,   // описание, px
    metaSize:    11,   // подписи-характеристики, px
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
       filters — список характеристик, по которым можно фильтровать,
       В ТОМ ПОРЯДКЕ, как их показать. Пусто [] — фильтров нет.
       Значения внутри каждой характеристики движок берёт сам из данных.

       genderKey — характеристика «Пол». Она особая: жёсткий фильтр
       Она/Он/Все (унисекс попадает в оба). НЕ дублируйте её в filters. */
    filters:      [],            // напр. ['Семья', 'Настроение', 'Сезон']
    genderKey:    'Пол',
    genderValues: {              // как значения в данных зовут женское/мужское/унисекс
      female: 'женский',
      male:   'мужской',
      unisex: 'унисекс',
    },
    genderLabels: { all: 'Все', female: 'Для неё', male: 'Для него' },
    filtersEnabled: true,        // выключатель всей панели фильтров

    /* -- тексты -- */
    loadingText: 'Собираем каталог…',
    errorText:   'Каталог не загрузился.',
    retryText:   'Попробовать снова',
    emptyText:   'Пока пусто.',
    emptyFilter: 'Под выбранные фильтры ничего не подошло.',
    resetText:   'Сбросить',
    countText:   'Показано',     // «Показано 12»
  };

  var cfg = merge(DEFAULTS, window.BT_CATALOG || {});


  /* ============================================================
     БЛОК 2. СОСТОЯНИЕ И ЗАПУСК
     ============================================================ */

  var root   = null;
  var ALL    = [];               // все ароматы, как пришли
  var facets = {};               // сводка характеристик из данных
  var gender = 'all';            // 'all' | 'female' | 'male'
  var picked = {};               // { 'Семья': ['цветочный', ...], ... }

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
    return cfg.filtersEnabled
        && cfg.genderKey
        && facets[cfg.genderKey]
        && facets[cfg.genderKey].length;
  }

  /* какие характеристики реально показываем как фильтры */
  function activeFilterKeys() {
    if (!cfg.filtersEnabled) return [];
    var out = [];
    for (var i = 0; i < cfg.filters.length; i++) {
      var key = cfg.filters[i];
      if (key === cfg.genderKey) continue;          // пол отдельно
      if (facets[key] && facets[key].length) out.push(key);
    }
    return out;
  }

  function passesGender(item) {
    if (gender === 'all') return true;
    var values = (item.attrs && item.attrs[cfg.genderKey]) || [];
    var want   = cfg.genderValues[gender];
    var uni    = cfg.genderValues.unisex;
    for (var i = 0; i < values.length; i++) {
      if (values[i] === want || values[i] === uni) return true;
    }
    return false;
  }

  /* внутри характеристики — ИЛИ (любое из выбранного),
     между характеристиками — И (должны совпасть все группы) */
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

  function toggleValue(key, value) {
    if (!picked[key]) picked[key] = [];
    var idx = picked[key].indexOf(value);
    if (idx === -1) picked[key].push(value);
    else            picked[key].splice(idx, 1);
    if (!picked[key].length) delete picked[key];
    updateView();
  }

  function setGender(g) {
    gender = g;
    updateView();
  }

  function resetAll() {
    gender = 'all';
    picked = {};
    updateView();
  }

  function anyPicked() {
    if (gender !== 'all') return true;
    for (var k in picked) if (picked[k] && picked[k].length) return true;
    return false;
  }


  /* ============================================================
     БЛОК 5. РИСОВАНИЕ
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

  /* полная перерисовка (после загрузки): фильтры + панель + сетка */
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

  /* лёгкая перерисовка (после клика по фильтру): только сетка, счётчик, активные теги */
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

    // подсветить активные теги
    var chips = root.querySelectorAll('.bt-chip');
    for (var c = 0; c < chips.length; c++) {
      var ch = chips[c];
      var on;
      if (ch.dataset.gender) {
        on = (ch.dataset.gender === gender);
      } else {
        var k = ch.dataset.key, v = ch.dataset.value;
        on = !!(picked[k] && picked[k].indexOf(v) !== -1);
      }
      ch.className = 'bt-chip' + (on ? ' bt-chip--on' : '');
    }
  }

  function filtersHtml() {
    if (!cfg.filtersEnabled) return '';

    var groups = '';

    // пол — отдельным сегментом
    if (hasGender()) {
      groups += '<div class="bt-fgroup bt-fgroup--gender">'
              +   '<button class="bt-chip" type="button" data-gender="all">'    + esc(cfg.genderLabels.all)    + '</button>'
              +   '<button class="bt-chip" type="button" data-gender="female">' + esc(cfg.genderLabels.female) + '</button>'
              +   '<button class="bt-chip" type="button" data-gender="male">'   + esc(cfg.genderLabels.male)   + '</button>'
              + '</div>';
    }

    // остальные характеристики
    var keys = activeFilterKeys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var chips = '';
      var values = facets[key];
      for (var j = 0; j < values.length; j++) {
        var v = values[j].value;
        chips += '<button class="bt-chip" type="button"'
               + ' data-key="' + esc(key) + '" data-value="' + esc(v) + '">'
               + esc(v) + '</button>';
      }
      groups += '<div class="bt-fgroup">'
              +   '<span class="bt-flabel">' + esc(key) + '</span>'
              +   '<span class="bt-fchips">' + chips + '</span>'
              + '</div>';
    }

    if (!groups) return '';
    return '<div class="bt-filters">' + groups + '</div>';
  }

  function bindFilters() {
    // делегирование: один обработчик на всю панель
    var panel = root.querySelector('.bt-filters');
    if (panel) {
      panel.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.bt-chip') : null;
        if (!chip) return;
        if (chip.dataset.gender) setGender(chip.dataset.gender);
        else toggleValue(chip.dataset.key, chip.dataset.value);
      });
    }
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
     БЛОК 6. СТИЛИ
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

      /* -- фильтры -- */
      '.bt-filters { display: flex; flex-direction: column; gap: 14px; margin: 0 0 18px; }',
      '.bt-fgroup { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }',
      '.bt-flabel { font-size: ' + cfg.metaSize + 'px; letter-spacing: 1.4px;',
      '  text-transform: uppercase; color: ' + cfg.colorMuted + '; opacity: .7;',
      '  margin-right: 4px; min-width: 92px; }',
      '.bt-fchips { display: flex; flex-wrap: wrap; gap: 8px; }',

      '.bt-chip { font-family: ' + cfg.fontBody + '; font-size: 13px; font-weight: 400;',
      '  color: ' + cfg.colorText + '; background: rgba(255,255,255,0.5);',
      '  border: 1px solid rgba(107,79,79,0.18); border-radius: 100px;',
      '  padding: 7px 15px; cursor: pointer; line-height: 1.2;',
      '  transition: background .25s, color .25s, border-color .25s, transform .15s; }',
      '.bt-chip:hover { background: rgba(255,255,255,0.85); transform: translateY(-1px); }',
      '.bt-chip--on { background: ' + cfg.colorAccent + '; color: #F3EDE8;',
      '  border-color: ' + cfg.colorAccent + '; }',
      '.bt-fgroup--gender { gap: 6px; margin-bottom: 2px; }',

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

      /* на узком экране подпись характеристики встаёт над тегами */
      '@media (max-width: 560px) {',
      '  .bt-flabel { min-width: 100%; margin-bottom: 2px; } }',

      '@media (prefers-reduced-motion: reduce) {',
      '  .bt-card, .bt-card--ghost, .bt-chip { transition: none; animation: none; } }',
    ].join('\n');

    var tag = document.createElement('style');
    tag.id = 'bt-catalog-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function loadFonts() {
    if (!cfg.fontsUrl || document.getElementById('bt-catalog-fonts')) return;

    var pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);

    var link = document.createElement('link');
    link.id = 'bt-catalog-fonts';
    link.rel = 'stylesheet';
    link.href = cfg.fontsUrl;
    link.media = 'print';
    link.onload = function () { this.media = 'all'; };
    document.head.appendChild(link);
  }


  /* ============================================================
     БЛОК 7. МЕЛОЧИ
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