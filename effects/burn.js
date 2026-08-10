/**
 * ============================================================
 *  BURN EFFECT — сгорание картинки (WebGL шейдер)
 * ============================================================
 *  Картинка загорается от случайной точки, огонь расползается,
 *  остаётся пепел, потом картинка возрождается.
 *
 *  Использование:
 *    initBurn({
 *      selector: '.t-store__card__imgwrapper',  // что поджигаем
 *      firstDelay: 10000,     // через сколько мс первый поджог
 *      interval: [6000, 14000], // пауза между поджогами (случайно в диапазоне)
 *      burnTime: 2.2,         // сколько секунд горит
 *      restTime: 1.2,         // сколько лежит пеплом до возрождения
 *      intensity: 1.0         // яркость пламени
 *    });
 *
 *  Требует three.js r128 (подключить до этого файла).
 * ============================================================
 */

function initBurn(userConfig) {

  var CONFIG = Object.assign({
    selector: '.t-store__card__imgwrapper',
    firstDelay: 10000,
    interval: [6000, 14000],
    burnTime: 2.2,
    restTime: 1.2,
    intensity: 1.0
  }, userConfig || {});

  if (typeof THREE === 'undefined') { console.error('[burn] three.js не подключён'); return; }

  var VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform float uProgress;',   // 0 = целая, 1 = сгорела полностью
    'uniform float uTime;',
    'uniform vec2 uSeed;',        // точка поджога
    'uniform float uIntensity;',

    'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
    'float noise(vec2 p){',
    '  vec2 i=floor(p), f=fract(p);',
    '  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));',
    '  vec2 u=f*f*(3.-2.*f);',
    '  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;',
    '}',
    'float fbm(vec2 p){',
    '  float v=0.0, amp=0.5;',
    '  for(int i=0;i<5;i++){ v+=amp*noise(p); p*=2.07; amp*=0.5; }',
    '  return v;',
    '}',

    'void main(){',
    '  vec2 uv = vUv;',
    '  vec4 img = texture2D(uTex, uv);',

    // карта горения: расстояние от точки поджога + рваный шум = живой фронт огня
    '  float dist = length(uv - uSeed);',
    '  float n = fbm(uv * 4.5 + uSeed * 3.0);',
    '  float n2 = fbm(uv * 11.0 - uSeed * 2.0);',
    '  float burnMap = dist * 0.75 + n * 0.42 + n2 * 0.12;',

    // фронт огня движется по burnMap
    '  float front = uProgress * 1.45;',
    '  float edge = burnMap - front;',

    // зоны: сгорело (edge < 0) | кромка огня | целое
    '  float ash    = smoothstep(0.0, -0.03, edge);        // пепел',
    '  float ember  = smoothstep(0.075, 0.0, edge) * (1.0 - ash);  // угли/жар',
    '  float flame  = smoothstep(0.035, 0.0, edge) * (1.0 - ash);  // яркое пламя',
    '  float hot    = smoothstep(0.012, 0.0, edge) * (1.0 - ash);  // белое ядро',

    // мерцание пламени во времени
    '  float flick = 0.82 + 0.18 * noise(uv*22.0 + uTime*7.0);',

    // цвета огня: багровый → оранжевый → жёлтый → белое ядро
    '  vec3 cEmber = vec3(0.55, 0.09, 0.02);',
    '  vec3 cFlame = vec3(1.00, 0.42, 0.05);',
    '  vec3 cHot   = vec3(1.00, 0.86, 0.42);',
    '  vec3 cCore  = vec3(1.00, 0.98, 0.88);',

    // почернение перед фронтом (обугливание)
    '  vec3 col = img.rgb;',
    '  float char_ = smoothstep(0.12, 0.0, edge) * (1.0 - ash);',
    '  col = mix(col, vec3(0.06,0.045,0.04), char_ * 0.85);',

    // накладываем огонь
    '  col = mix(col, cEmber, ember * 0.9 * flick * uIntensity);',
    '  col = mix(col, cFlame, flame * 0.95 * flick * uIntensity);',
    '  col = mix(col, cHot,   hot   * 0.9  * flick * uIntensity);',
    '  col += cCore * hot * 0.55 * flick * uIntensity;',

    // пепел: тёмно-серые хлопья с рваными дырами
    '  float ashNoise = fbm(uv*16.0 + 3.7);',
    '  vec3 ashCol = mix(vec3(0.10,0.09,0.085), vec3(0.24,0.22,0.21), ashNoise);',
    '  col = mix(col, ashCol, ash);',

    // прозрачность: сгоревшее прогорает насквозь клочьями
    '  float holes = smoothstep(0.35, 0.75, ashNoise);',
    '  float alpha = img.a * (1.0 - ash * holes * 0.92);',

    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  // ─── создаём горелку для одного элемента ───
  function makeBurner(el) {
    var src = el.getAttribute('data-original') || '';
    if (!src) {
      var bg = getComputedStyle(el).backgroundImage || '';
      var m = bg.match(/url\(["']?(.*?)["']?\)/);
      if (m) src = m[1];
    }
    if (!src) return null;

    var rect = el.getBoundingClientRect();
    if (rect.width < 10) return null;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:5;pointer-events:none;opacity:0;transition:opacity .25s;border-radius:inherit;';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(canvas);

    var renderer, scene, camera, uniforms, tex, mesh, running = false, raf = null;

    function init(cb) {
      var loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(src, function(t){
        tex = t; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
        renderer.setPixelRatio(1);
        var r = el.getBoundingClientRect();
        renderer.setSize(Math.round(r.width), Math.round(r.height), false);
        scene = new THREE.Scene();
        camera = new THREE.Camera();
        uniforms = {
          uTex: { value: tex },
          uProgress: { value: 0 },
          uTime: { value: 0 },
          uSeed: { value: new THREE.Vector2(0.5, 0.75) },
          uIntensity: { value: CONFIG.intensity }
        };
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2),
          new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms, transparent: true }));
        scene.add(mesh);
        renderer.render(scene, camera);   // прогрев
        cb && cb();
      }, undefined, function(){ /* картинка не загрузилась — тихо выходим */ });
    }

    function burn() {
      if (running) return;
      running = true;
      canvas.style.opacity = '1';

      // случайная точка поджога — снизу, как от уголька
      uniforms.uSeed.value.set(0.25 + Math.random()*0.5, 0.72 + Math.random()*0.22);

      var t0 = performance.now();
      var phase = 'burn';

      function loop(){
        var now = performance.now();
        var dt = (now - t0) / 1000;
        uniforms.uTime.value = dt;

        if (phase === 'burn') {
          var p = dt / CONFIG.burnTime;
          uniforms.uProgress.value = Math.min(1, p);
          if (p >= 1) { phase = 'rest'; t0 = now; }
        } else if (phase === 'rest') {
          if (dt >= CONFIG.restTime) { phase = 'revive'; t0 = now; }
        } else {
          // возрождение: огонь отступает назад
          var q = dt / 0.9;
          uniforms.uProgress.value = Math.max(0, 1 - q);
          if (q >= 1) {
            canvas.style.opacity = '0';
            running = false;
            raf = null;
            return;
          }
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      }
      loop();
    }

    return { init: init, burn: burn, isRunning: function(){ return running; }, el: el };
  }

  // ─── управление: поджигаем случайные видимые карточки ───
  var burners = [];
  var ready = false;

  function collect() {
    document.querySelectorAll(CONFIG.selector).forEach(function(el){
      if (el.dataset.btBurn) return;
      el.dataset.btBurn = '1';
      var b = makeBurner(el);
      if (b) burners.push(b);
    });
  }

  function visibleBurners() {
    return burners.filter(function(b){
      var r = b.el.getBoundingClientRect();
      return r.top < window.innerHeight - 40 && r.bottom > 40 && !b.isRunning();
    });
  }

  function igniteRandom() {
    var vis = visibleBurners();
    if (vis.length === 0) return;
    var pick = vis[Math.floor(Math.random() * vis.length)];
    if (!pick.ready) {
      pick.init(function(){ pick.ready = true; pick.burn(); });
    } else {
      pick.burn();
    }
  }

  function scheduleNext() {
    var min = CONFIG.interval[0], max = CONFIG.interval[1];
    var wait = min + Math.random() * (max - min);
    setTimeout(function(){
      igniteRandom();
      scheduleNext();
    }, wait);
  }

  function start() {
    collect();
    setTimeout(function(){
      igniteRandom();
      scheduleNext();
    }, CONFIG.firstDelay);
    // ловим подгрузку новых карточек (фильтры Tilda)
    new MutationObserver(function(){ collect(); }).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
}