/**
 * ============================================================
 *  LETTER REVEAL — появление текста по буквам с блюром
 * ============================================================
 *  Как использовать:
 *
 *  1. Подключить после разметки:
 *     <script src="letter-reveal.js"></script>
 *
 *  2. В HTML пометить нужный текст классом .letters:
 *     <h1 class="letters">Between.</h1>
 *
 *     Пробелы можно писать как обычно — они сохранятся.
 *     Можно ставить класс на несколько элементов сразу
 *     (например, на заголовок и на слоган) — каждый анимируется
 *     отдельно, с задержкой между блоками.
 *
 *  3. Вызвать:
 *     revealLetters('.letters', {
 *       startDelay: 350,   // через сколько мс начать (мс от загрузки страницы)
 *       stagger: 45,       // задержка между буквами внутри блока (мс)
 *       blockGap: 300,     // доп. задержка между разными .letters-блоками (мс)
 *       duration: 900      // длительность анимации одной буквы (мс)
 *     });
 *
 *  Единственное, что меняете — вызов revealLetters() и, при желании,
 *  CSS-переменные --letter-blur / --letter-shift ниже в стилях.
 * ============================================================
 */

function _wrapLetters(el) {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((ch) => {
    const span = document.createElement('span');
    span.className = 'tl';
    if (ch === ' ') {
      span.classList.add('tl-space');
      span.innerHTML = '&nbsp;';
    } else {
      span.textContent = ch;
    }
    el.appendChild(span);
  });
}

function revealLetters(selector, userConfig = {}) {
  const defaults = {
    startDelay: 350,
    stagger: 45,
    blockGap: 300,
    duration: 900,
  };
  const config = { ...defaults, ...userConfig };

  // подключаем базовые стили один раз
  if (!document.getElementById('letter-reveal-style')) {
    const style = document.createElement('style');
    style.id = 'letter-reveal-style';
    style.textContent = `
      .tl {
        display: inline-block;
        opacity: 0;
        filter: blur(14px);
        transform: translateY(16px);
        transition:
          opacity ${config.duration}ms cubic-bezier(0.16,1,0.3,1),
          filter ${config.duration}ms cubic-bezier(0.16,1,0.3,1),
          transform ${config.duration}ms cubic-bezier(0.16,1,0.3,1);
      }
      .tl.on { opacity: 1; filter: blur(0); transform: translateY(0); }
      .tl-space { width: 0.3em; opacity: 1 !important; filter: none !important; transform: none !important; }
    `;
    document.head.appendChild(style);
  }

  const blocks = document.querySelectorAll(selector);
  blocks.forEach((block, blockIndex) => {
    _wrapLetters(block);
    const letters = block.querySelectorAll('.tl:not(.tl-space)');
    const blockStart = config.startDelay + blockIndex * config.blockGap;
    letters.forEach((letter, i) => {
      setTimeout(() => letter.classList.add('on'), blockStart + i * config.stagger);
    });
  });
}
