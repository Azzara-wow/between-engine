2. Подключение в проект
<div id="ether" style="width:100%;height:100vh;"></div>

<script type="module">
import { LiquidEther } from './LiquidEther.js';

new LiquidEther(document.getElementById('ether'), {
    color1: 0xF3EDE8,
    color2: 0x6B4F4F,
    speed: 0.08,
    intensity: 3.0,
    contrast: 1.05
});
</script>

3. Пресеты (в комментариях)
Ты можешь просто копировать эти настройки.

⭐ Золотой металл
js
{
  color1: 0xF7DFA6, // светлое золото
  color2: 0x8C6B2F, // тёплая бронза
  speed: 0.06,
  intensity: 2.5,
  contrast: 1.12
}
⭐ Молочное стекло
js
{
  color1: 0xFFFFFF,
  color2: 0xD9D9D9,
  speed: 0.03,
  intensity: 1.8,
  contrast: 1.02
}
⭐ Тёмный эфир
js
{
  color1: 0x1A1A1A,
  color2: 0x3A2F2F,
  speed: 0.05,
  intensity: 3.5,
  contrast: 1.08
}
⭐ Пастельный эфир (для нежных брендов)
js
{
  color1: 0xFBEFF5,
  color2: 0xE3D7F4,
  speed: 0.04,
  intensity: 2.2,
  contrast: 1.03
}
⭐ Холодный технологичный эфир
js
{
  color1: 0xDDE7F7,
  color2: 0x6A7FA3,
  speed: 0.07,
  intensity: 3.0,
  contrast: 1.1
}