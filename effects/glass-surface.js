/**
 * ============================================================
 *  GLASS SURFACE — чистый эффект стекла, применимый к ЛЮБОЙ форме
 * ============================================================
 *  Идея: этот файл ТОЛЬКО про стекло (размытие, блики, тени, кромка).
 *  Форму — скругления, паддинги, размер, это ли кнопка, карточка
 *  или панель квиза — вы задаёте своим обычным CSS-классом.
 *  Стекло и форма больше не смешаны, как в glass-button.js.
 *
 *  Как использовать:
 *
 *  1. Пишете свою форму как обычно, любым классом:
 *     .quiz-card { padding: 44px 56px; border-radius: 28px; max-width: 760px; }
 *     .glass-pill-btn { padding: 15px 30px; border-radius: 100px; }
 *
 *  2. Подключаете скрипт:
 *     <script src="glass-surface.js"></script>
 *
 *  3. Навешиваете стекло на любой селектор (можно на несколько
 *     разных селекторов с РАЗНЫМИ настройками стекла в одном проекте):
 *
 *     applyGlass('.quiz-card', { thickness: 2, tint: '255,255,255', tintOpacity: 0.14 });
 *     applyGlass('.glass-pill-btn', { thickness: 3, tint: '255,255,255', tintOpacity: 0.10 });
 *
 *  Форма ваша (border-radius, padding, display) — трогать не нужно.
 *  Стекло полностью в конфиге applyGlass().
 * ============================================================
 */

function applyGlass(selector, userConfig = {}) {
  const defaults = {
    thickness: 2,          // 1 (тонкое) .. 3 (толстое, как у флакона)
    tint: '255,255,255',   // цвет стекла "R,G,B"
    tintOpacity: 0.12,     // тонировка в покое
    rimColor: '90,65,65',  // цвет кромки/тени (акцент бренда)
  };
  const config = { ...defaults, ...userConfig };
  const t = config.thickness;

  // ---- пересчёт толщины в реальные величины (та же логика, что в glass-button.js) ----
  const blur = 10 + t * 6;
  const saturate = 1.2 + t * 0.2;
  const brightness = 1.0 + t * 0.03;
  const shadowDepth = 6 + t * 6;
  const rimAlphaOuter = 0.18 + t * 0.06;
  const rimAlphaInner = 0.08 + t * 0.04;
  const bottomGlareOpacity = 0.05 + t * 0.05;
  const bottomGlareVisible = t >= 2 ? 1 : 0;

  // ---- SVG-фильтр преломления, один раз на страницу ----
  if (!document.getElementById('glass-distortion-svg')) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'glass-distortion-svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <filter id="glassDistort">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    `;
    document.body.appendChild(svg);
  }

  // ---- базовые стили .glass-effect — инжектятся один раз, читают CSS-переменные ----
  if (!document.getElementById('glass-surface-style')) {
    const style = document.createElement('style');
    style.id = 'glass-surface-style';
    style.textContent = `
      .glass-effect {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        background: rgba(var(--glass-tint), var(--glass-tint-opacity));
        backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
        -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness));
        box-shadow:
          0 var(--glass-shadow-depth) calc(var(--glass-shadow-depth) * 3.5) rgba(var(--glass-rim), 0.14),
          inset 0 1px 0 rgba(255,255,255,0.6),
          inset 0 calc(var(--glass-shadow-inset) * -1) calc(var(--glass-shadow-inset) * 2) rgba(var(--glass-rim), var(--glass-rim-bottom)),
          inset 1px 0 0 rgba(255,255,255, var(--glass-rim-inner)),
          inset -1px 0 0 rgba(255,255,255, var(--glass-rim-inner)),
          0 0 0 1px rgba(var(--glass-rim), calc(var(--glass-rim-outer) * 0.5)),
          0 0 0 2px rgba(255,255,255, var(--glass-rim-outer));
        transition: transform .45s cubic-bezier(0.16,1,0.3,1), box-shadow .45s cubic-bezier(0.16,1,0.3,1), background .45s ease;
      }
      .glass-effect::before {
        content: "";
        position: absolute;
        top: 0; left: -20%;
        width: 60%; height: 45%;
        border-radius: 0 0 100% 100%;
        background: linear-gradient(155deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
        filter: blur(1.5px);
        pointer-events: none;
        z-index: 1;
      }
      .glass-effect::after {
        content: "";
        position: absolute;
        bottom: 0; left: 25%;
        width: 45%; height: 22%;
        border-radius: 100% 100% 0 0;
        background: linear-gradient(to top, rgba(255,255,255, var(--glass-bottom-glare)) 0%, transparent 100%);
        filter: blur(2px);
        pointer-events: none;
        z-index: 1;
        opacity: var(--glass-bottom-visible);
      }
      .glass-effect:hover {
        transform: translateY(-2px);
      }
      /* содержимое элемента (текст/иконки) всегда должно быть выше стекла —
         достаточно обернуть контент в свой div и дать ему position:relative; z-index:3,
         как сделано в примерах ниже */
    `;
    document.head.appendChild(style);
  }

  // ---- применяем: класс + CSS-переменные на каждый элемент ----
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.add('glass-effect');
    el.style.setProperty('--glass-tint', config.tint);
    el.style.setProperty('--glass-tint-opacity', config.tintOpacity);
    el.style.setProperty('--glass-blur', blur + 'px');
    el.style.setProperty('--glass-saturate', saturate);
    el.style.setProperty('--glass-brightness', brightness);
    el.style.setProperty('--glass-shadow-depth', shadowDepth + 'px');
    el.style.setProperty('--glass-shadow-inset', (1 + t) + 'px');
    el.style.setProperty('--glass-rim', config.rimColor);
    el.style.setProperty('--glass-rim-bottom', 0.05 + t * 0.03);
    el.style.setProperty('--glass-rim-inner', rimAlphaInner);
    el.style.setProperty('--glass-rim-outer', rimAlphaOuter);
    el.style.setProperty('--glass-bottom-glare', bottomGlareOpacity);
    el.style.setProperty('--glass-bottom-visible', bottomGlareVisible);
  });
}