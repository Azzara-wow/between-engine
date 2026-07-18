/**
 * ============================================================
 *  GLASS BUTTON — стеклянная кнопка "толщины флакона"
 * ============================================================
 *  Как использовать:
 *
 *  1. Подключить:
 *     <link rel="stylesheet" ...> не нужен — стили инжектятся сами
 *     <script src="glass-button.js"></script>
 *
 *  2. В HTML — обычная ссылка/кнопка с классом .glass-btn:
 *     <a href="#" class="glass-btn">
 *       <span class="glass-btn-text">Смотреть коллекцию</span>
 *     </a>
 *
 *  3. Вызвать (один раз на странице, настраивает ВСЕ .glass-btn сразу):
 *     initGlassButtons('.glass-btn', {
 *       radius: 100,          // скругление углов, px. 100 = полная "таблетка"
 *       thickness: 2,         // толщина стекла: 1 (тонкое) .. 3 (очень толстое)
 *       tint: '255,255,255',  // цвет тонировки стекла, формат "R,G,B"
 *       tintOpacity: 0.10,    // насколько тонировка заметна в покое
 *       rimColor: '90,65,65', // цвет кромки/грани (обычно тёмный оттенок акцента бренда)
 *       textColor: '#2C2420',
 *     });
 *
 *  Хотите сделать кнопку под другого мастера — меняете только tint,
 *  rimColor, textColor и, если нужно, radius. Остальное (блики,
 *  преломление) само пересчитается через thickness.
 * ============================================================
 */

function initGlassButtons(selector, userConfig = {}) {
  const defaults = {
    radius: 100,
    thickness: 2,        // 1..3
    tint: '255,255,255',
    tintOpacity: 0.10,
    rimColor: '90,65,65',
    textColor: '#2C2420',
  };
  const config = { ...defaults, ...userConfig };

  // ---- пересчёт "толщины" в реальные CSS-величины ----
  // чем выше thickness, тем: сильнее blur, больше saturate,
  // глубже внутренние тени, заметнее нижний блик и кромка
  const t = config.thickness;
  const blur      = 10 + t * 6;          // 16 / 22 / 28 px
  const saturate  = 1.2 + t * 0.2;       // 1.4 / 1.6 / 1.8
  const brightness = 1.0 + t * 0.03;     // 1.03 / 1.06 / 1.09
  const shadowDepth = 6 + t * 6;         // глубина внешней тени
  const rimAlphaOuter = 0.18 + t * 0.06;
  const rimAlphaInner = 0.08 + t * 0.04;
  const bottomGlareOpacity = 0.05 + t * 0.05;

  // ---- инжектируем SVG-фильтр преломления (один раз) ----
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

  // ---- инжектируем стили ----
  const styleId = 'glass-btn-style-' + Math.round(t * 10);
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .glass-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 15px 30px;
        border-radius: ${config.radius}px;
        text-decoration: none;
        border: none;
        cursor: pointer;
        overflow: hidden;
        isolation: isolate;
        background: rgba(${config.tint}, ${config.tintOpacity});
        backdrop-filter: blur(${blur}px) saturate(${saturate}) brightness(${brightness});
        -webkit-backdrop-filter: blur(${blur}px) saturate(${saturate}) brightness(${brightness});
        box-shadow:
          0 ${shadowDepth}px ${shadowDepth * 3.5}px rgba(${config.rimColor}, 0.14),
          inset 0 1px 0 rgba(255,255,255,0.6),
          inset 0 -${1 + t}px ${2 + t * 2}px rgba(${config.rimColor}, ${0.05 + t * 0.03}),
          inset 1px 0 0 rgba(255,255,255,${rimAlphaInner}),
          inset -1px 0 0 rgba(255,255,255,${rimAlphaInner}),
          0 0 0 1px rgba(${config.rimColor}, ${rimAlphaOuter * 0.5}),
          0 0 0 ${1 + Math.round(t/2)}px rgba(255,255,255,${rimAlphaOuter});
        transition: transform .45s cubic-bezier(0.16,1,0.3,1), box-shadow .45s cubic-bezier(0.16,1,0.3,1), background .45s ease;
      }

      /* верхний блик — "свет падает сверху" */
      .glass-btn::before {
        content: "";
        position: absolute;
        top: 0; left: -20%;
        width: 60%; height: ${40 + t * 6}%;
        border-radius: 0 0 100% 100%;
        background: linear-gradient(155deg, rgba(255,255,255,${0.55 + t*0.05}) 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
        filter: blur(1.5px);
        pointer-events: none;
        z-index: 1;
        transition: transform .45s cubic-bezier(0.16,1,0.3,1);
      }

      /* нижний блик — "отражение от дна флакона", появляется только при thickness >= 2 */
      .glass-btn::after {
        content: "";
        position: absolute;
        bottom: 0; left: 25%;
        width: 45%; height: ${20 + t * 5}%;
        border-radius: 100% 100% 0 0;
        background: linear-gradient(to top, rgba(255,255,255,${bottomGlareOpacity}) 0%, transparent 100%);
        filter: blur(2px);
        pointer-events: none;
        z-index: 1;
        opacity: ${t >= 2 ? 1 : 0};
      }

      .glass-btn-text {
        position: relative;
        z-index: 3;
        font-family: 'Jost', sans-serif;
        font-size: 12px;
        font-weight: 300;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: ${config.textColor};
        white-space: nowrap;
        text-shadow: 0 1px 3px rgba(255,255,255,0.4);
      }

      .glass-btn:hover {
        transform: translateY(-2px);
        background: rgba(${config.tint}, ${config.tintOpacity + 0.06});
        box-shadow:
          0 ${shadowDepth * 1.6}px ${shadowDepth * 4.5}px rgba(${config.rimColor}, 0.18),
          inset 0 1px 0 rgba(255,255,255,0.75),
          inset 0 -${1 + t}px ${2 + t * 2}px rgba(${config.rimColor}, ${0.06 + t * 0.03}),
          0 0 0 1px rgba(${config.rimColor}, ${rimAlphaOuter * 0.6}),
          0 0 0 ${1 + Math.round(t/2)}px rgba(255,255,255,${rimAlphaOuter + 0.1});
      }
      .glass-btn:hover::before { transform: translateX(15%); }

      .glass-btn:active {
        transform: translateY(0) scale(0.97);
        transition-duration: .12s;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- живой блик за курсором (мышь двигает верхний блик) ----
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      btn.style.setProperty('--gx', dx.toFixed(2));
      const before = btn;
      before.style.setProperty('filter', `brightness(${1 + (0.5 - dy) * 0.06})`);
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.filter = '';
    });
  });
}
