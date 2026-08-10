// LiquidEther.js — твой компонент
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class LiquidEther {
    constructor(container, settings = {}) {
        this.container = container;

        // Настройки по умолчанию
        this.settings = {
            color1: settings.color1 || 0xF3EDE8,
            color2: settings.color2 || 0x6B4F4F,
            speed: settings.speed || 0.08,
            intensity: settings.intensity || 3.0,
            contrast: settings.contrast || 1.05
        };

        this.init();
        this.animate();
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.uniforms = {
            u_time: { value: 0 },
            u_resolution: { value: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight) },
            u_color1: { value: new THREE.Color(this.settings.color1) },
            u_color2: { value: new THREE.Color(this.settings.color2) },
            u_speed: { value: this.settings.speed },
            u_intensity: { value: this.settings.intensity },
            u_contrast: { value: this.settings.contrast }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
                void main() {
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec3 u_color1;
                uniform vec3 u_color2;
                uniform float u_speed;
                uniform float u_intensity;
                uniform float u_contrast;

                float noise(vec2 p) {
                    return sin(p.x) * sin(p.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 5; i++) {
                        v += a * noise(p);
                        p *= 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                    uv -= 0.5;
                    uv.x *= u_resolution.x / u_resolution.y;

                    float t = u_time * u_speed;

                    float wave = fbm(uv * u_intensity + vec2(t * 0.7, t * 0.3));
                    float layer = fbm(uv * (u_intensity * 2.0) + vec2(-t * 0.4, t * 0.6));

                    float mixVal = smoothstep(-0.6, 0.8, wave + layer * 0.6);

                    vec3 col = mix(u_color1, u_color2, mixVal);

                    float vignette = smoothstep(0.9, 0.2, length(uv));
                    col *= mix(0.9, u_contrast, vignette);

                    gl_FragColor = vec4(col, 1.0);
                }
            `
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.scene.add(plane);

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.renderer.setSize(w, h);
        this.uniforms.u_resolution.value.set(w, h);
    }

    animate() {
        this.uniforms.u_time.value += 0.016;
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.animate());
    }
}
