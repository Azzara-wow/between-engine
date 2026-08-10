/* ============================================================
   BETWEEN — движок каталога (between-catalog.js)
   Часть 1: загрузка данных, карточки, сетка, адаптив.
   Фильтры и эффекты — отдельными частями, позже.

   Куда класть:  between-engine → /catalog/between-catalog.js
   Как звать:    https://between-engine.pages.dev/catalog/between-catalog.js

   На странице (блок T123) лежит window.BT_CATALOG — там настройка
   КОНКРЕТНОЙ страницы. Всё, что тут в БЛОКЕ 1, — общий стиль для
   всех страниц, и оно перебивается настройкой страницы, если надо.
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     БЛОК 1. ОБЩИЕ НАСТРОЙКИ — стиль каталога Between
     Правится руками. Действует на все страницы сразу.
     ============================================================ */

  var DEFAULTS = {

    /* ── откуда берём данные ── */
    api:   'https://between-quiz.eaburdenko.workers.dev/catalog',
    kind:  'perfume',            // perfume | aromadesign
    mount: '#bt-catalog',        // куда рисовать

    /* ── палитра ── */
    colorText:   '#2C2420',      // названия, основной текст
    colorMuted:  '#6A5E56',      // описания, подписи
    colorAccent: '#6B4F4F',      // бордо
    colorCard:   '#F3EFEB',      // фон карточки
    colorBg:     'transparent',  // фон блока (обычно берём фон страницы)

    /* ── шрифты ── */
    fontTitle: "'Cormorant Garamond', Georgia, serif",
    fontBody:  "'Jost', 'Helvetica Neue', sans-serif",
    fontsUrl:  'https://fonts.googleapis.com/css2'
             + '?family=Cormorant+Garamond:wght@400;500'
             + '&family=Jost:wght@300;400'
             + '&display=swap',

    /* ── размеры ── */
    titleSize:   20,   // название аромата, px
    bodySize:    14,   // описание, px
    metaSize:    11,   // подписи-характеристики, px
    titleWeight: 500,  // 400 — тоньше и воздушнее, 500 — чётче на компе
    bodyWeight:  400,  // 300 — тоньше; на 1x-мониторах бледнит

    /* ── форма ── */
    cardRadius:  20,   // скругление карточки
    imageRadius: 16,   // скругление картинки
    imagePad:    14,   // воздух вокруг картинки внутри карточки
    cardPadding: 18,   // отступы текста
    gap:         20,   // расстояние между карточками

    /* ── сетка ──
       Ширина карточки задаёт всё: телефон 1 в ряд, планшет 2,
       ноутбук 3, большой экран 4. Хотите крупнее карточки —
       увеличьте minCardWidth, колонок станет меньше. */
    minCardWidth: 260,
    maxWidth:     1200,

    /* ── картинка ── */
    imageFit: 'cover',        // cover — заполняет квадрат; contain — влезает целиком
    eagerCount: 4,            // сколько первых картинок грузим сразу (остальные лениво)

    /* ── поведение карточки ── */
    hoverLift:   3,           // на сколько px приподнимается при наведении (0 — не поднимать)
    bottomShade: 0.05,        // затемнение низа карточки (0 — выключить)

    /* ── что показываем ── */
    attrsOnCard: [],          // какие характеристики подписать под описанием
    showPrice:   false,       // цены в карточках нет — это каталог, не магазин
    note:        '',          // строка над сеткой (сюда удобно писать цены и объёмы)

    /* ── тексты ── */
    loadingText: 'Собираем каталог…',
    errorText:   'Каталог не загрузился.',
    retryText:   'Попробовать снова',
    emptyText:   'Пока пусто.',
  };

  var cfg = merge(DEFAULTS, window.BT_CATALOG || {});


  /* ============================================================
     БЛОК 2. ЗАПУСК
     ============================================================ */

  var root = null;

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
        window.BT_CATALOG_DATA = data;      // пригодится фильтрам в части 2
        renderGrid(items);
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
     БЛОК 4. РИСОВАНИЕ
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

  function renderGrid(items) {
    if (!items.length) {
      root.innerHTML = noteHtml() + '<div class="bt-msg">' + esc(cfg.emptyText) + '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < items.length; i++) {
      html += cardHtml(items[i], i);
    }
    root.innerHTML = noteHtml() + '<div class="bt-grid">' + html + '</div>';
  }

  function cardHtml(item, index) {
    var eager = index < cfg.eagerCount;

    var media = item.image
      ? '<img class="bt-card__img" src="' + esc(item.image) + '" alt="' + esc(item.title) + '"'
        + ' loading="' + (eager ? 'eager' : 'lazy') + '"'
        + ' decoding="async"'
        + (eager ? ' fetchpriority="high"' : '')
        + '>'
      : '';

    var meta = '';
    if (cfg.attrsOnCard && cfg.attrsOnCard.length) {
      var parts = [];
      for (var i = 0; i < cfg.attrsOnCard.length; i++) {
        var values = item.attrs && item.attrs[cfg.attrsOnCard[i]];
        if (values && values.length) parts.push(values.join(', '));
      }
      if (parts.length) {
        meta = '<div class="bt-card__meta">' + esc(parts.join('  ·  ')) + '</div>';
      }
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
         +     meta
         +     price
         +   '</div>'
         + '</article>';
  }

  function renderError() {
    root.innerHTML = noteHtml()
      + '<div class="bt-msg bt-msg--error">'
      +   esc(cfg.errorText)
      +   '<button class="bt-retry" type="button">' + esc(cfg.retryText) + '</button>'
      + '</div>';

    var btn = root.querySelector('.bt-retry');
    if (btn) {
      btn.addEventListener('click', function () {
        renderSkeleton();
        load(0);
      });
    }
  }

  function noteHtml() {
    return cfg.note ? '<div class="bt-note">' + esc(cfg.note) + '</div>' : '';
  }


  /* ============================================================
     БЛОК 5. СТИЛИ
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

      '.bt-note { text-align: center; font-family: ' + cfg.fontBody + ';',
      '  font-size: ' + cfg.bodySize + 'px; font-weight: ' + cfg.bodyWeight + ';',
      '  color: ' + cfg.colorMuted + '; letter-spacing: .3px; margin: 0 0 28px; }',

      '.bt-grid { display: grid; gap: ' + cfg.gap + 'px;',
      '  grid-template-columns: repeat(auto-fill, minmax(' + cfg.minCardWidth + 'px, 1fr)); }',

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

      '.bt-card__descr { margin: 0; font-family: ' + cfg.fontBody + ';',
      '  font-size: ' + cfg.bodySize + 'px; font-weight: ' + cfg.bodyWeight + ';',
      '  line-height: 1.55; color: ' + cfg.colorMuted + '; }',

      '.bt-card__meta { margin-top: 12px; font-size: ' + cfg.metaSize + 'px;',
      '  letter-spacing: 1.4px; text-transform: uppercase; color: ' + cfg.colorAccent + ';',
      '  opacity: .75; }',

      '.bt-card__price { margin-top: 12px; font-size: ' + cfg.bodySize + 'px;',
      '  color: ' + cfg.colorText + '; }',

      /* заглушки, пока грузится */
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
      '.bt-retry { display: block; margin: 18px auto 0; padding: 12px 26px;',
      '  border: none; border-radius: 100px; cursor: pointer;',
      '  font-family: ' + cfg.fontBody + '; font-size: 11px; letter-spacing: 1.5px;',
      '  text-transform: uppercase; color: #F3EDE8; background: ' + cfg.colorAccent + '; }',

      '@media (prefers-reduced-motion: reduce) {',
      '  .bt-card, .bt-card--ghost { transition: none; animation: none; } }',
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

    /* media="print" + onload — шрифты не блокируют отрисовку страницы */
    var link = document.createElement('link');
    link.id = 'bt-catalog-fonts';
    link.rel = 'stylesheet';
    link.href = cfg.fontsUrl;
    link.media = 'print';
    link.onload = function () { this.media = 'all'; };
    document.head.appendChild(link);
  }


  /* ============================================================
     БЛОК 6. МЕЛОЧИ
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