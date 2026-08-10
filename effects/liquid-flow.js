// ============================================================
// BETWEEN ENGINE — Liquid Flow (жидкий поток)
// Настоящая жидкостная симуляция на three.js: эфир течёт, вихрится,
// реагирует на мышь, есть авто-режим движения. Опенсорсный эффект.
// Отличается от liquid-ether.js (там — светящийся след за курсором).
//
// Настройки через data-* на контейнере .liquid-flow-container:
//   data-colors="#6B4F4F,#B5A9A0,#E8E2DC"  палитра (2-3 цвета)
//   data-mouse-force="20"      сила реакции на мышь
//   data-cursor-size="100"     размер "мазка"
//   data-resolution="0.5"      качество/нагрузка (0.3 легче, 0.7 чётче)
//   data-is-viscous="false"    включить вязкость (густой эфир)
//   data-viscous="30"          степень вязкости
//   data-auto-demo="true"      сам двигается без мыши
//   data-auto-speed="0.5"      скорость авто-движения
//   data-auto-intensity="2.2"  сила потока в авто-режиме
// ============================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js';

function makePaletteTexture(stops) {
  let arr;
  if (Array.isArray(stops) && stops.length > 0) arr = stops.length === 1 ? [stops[0], stops[0]] : stops;
  else arr = ['#141313', '#383131'];
  const w = arr.length;
  const data = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const c = new THREE.Color(arr[i]);
    data[i*4] = Math.round(c.r*255); data[i*4+1] = Math.round(c.g*255);
    data[i*4+2] = Math.round(c.b*255); data[i*4+3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

class CommonClass {
  constructor(){ this.width=0;this.height=0;this.aspect=1;this.pixelRatio=1;this.time=0;this.delta=0;this.container=null;this.renderer=null;this.clock=null; }
  init(container){
    this.container=container; this.pixelRatio=Math.min(window.devicePixelRatio||1,2); this.resize();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.autoClear=false; this.renderer.setClearColor(new THREE.Color(0x000000),0);
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(this.width,this.height);
    this.renderer.domElement.style.width='100%'; this.renderer.domElement.style.height='100%'; this.renderer.domElement.style.display='block';
    this.clock=new THREE.Clock(); this.clock.start();
  }
  resize(){ if(!this.container)return; const r=this.container.getBoundingClientRect();
    this.width=Math.max(1,Math.floor(r.width)); this.height=Math.max(1,Math.floor(r.height));
    this.aspect=this.width/this.height; if(this.renderer)this.renderer.setSize(this.width,this.height,false); }
  update(){ this.delta=this.clock.getDelta(); this.time+=this.delta; }
}

class MouseClass {
  constructor(){
    this.mouseMoved=false; this.coords=new THREE.Vector2(); this.coords_old=new THREE.Vector2(); this.diff=new THREE.Vector2();
    this.timer=null; this.container=null; this.docTarget=null; this.listenerTarget=null;
    this.isHoverInside=false; this.hasUserControl=false; this.isAutoActive=false; this.autoIntensity=2.0;
    this.takeoverActive=false; this.takeoverStartTime=0; this.takeoverDuration=0.25;
    this.takeoverFrom=new THREE.Vector2(); this.takeoverTo=new THREE.Vector2(); this.onInteract=null;
    this._onMouseMove=this.onDocumentMouseMove.bind(this); this._onTouchStart=this.onDocumentTouchStart.bind(this);
    this._onTouchMove=this.onDocumentTouchMove.bind(this); this._onTouchEnd=this.onTouchEnd.bind(this); this._onDocumentLeave=this.onDocumentLeave.bind(this);
  }
  init(container){
    this.container=container; this.docTarget=container.ownerDocument||null;
    const dv=(this.docTarget&&this.docTarget.defaultView)||(typeof window!=='undefined'?window:null); if(!dv)return;
    this.listenerTarget=dv;
    dv.addEventListener('mousemove',this._onMouseMove);
    dv.addEventListener('touchstart',this._onTouchStart,{passive:true});
    dv.addEventListener('touchmove',this._onTouchMove,{passive:true});
    dv.addEventListener('touchend',this._onTouchEnd);
    if(this.docTarget)this.docTarget.addEventListener('mouseleave',this._onDocumentLeave);
  }
  dispose(){
    if(this.listenerTarget){ this.listenerTarget.removeEventListener('mousemove',this._onMouseMove);
      this.listenerTarget.removeEventListener('touchstart',this._onTouchStart);
      this.listenerTarget.removeEventListener('touchmove',this._onTouchMove);
      this.listenerTarget.removeEventListener('touchend',this._onTouchEnd); }
    if(this.docTarget)this.docTarget.removeEventListener('mouseleave',this._onDocumentLeave);
    this.listenerTarget=null;this.docTarget=null;this.container=null;
  }
  checkHover(e){ if(!this.container)return false; const t=e.target;
    if(t===this.container||this.container.contains(t))return true;
    const r=this.container.getBoundingClientRect();
    const x=e.clientX!==undefined?e.clientX:e.touches[0].clientX;
    const y=e.clientY!==undefined?e.clientY:e.touches[0].clientY;
    return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom; }
  setCoords(cx,cy){ if(!this.container)return; if(this.timer)window.clearTimeout(this.timer);
    const r=this.container.getBoundingClientRect(); if(r.width===0||r.height===0)return;
    let nx=(cx-r.left)/r.width, ny=(cy-r.top)/r.height; nx=Math.max(0,Math.min(1,nx)); ny=Math.max(0,Math.min(1,ny));
    this.coords.set(nx*2-1,-(ny*2-1)); this.mouseMoved=true;
    this.timer=window.setTimeout(()=>{this.mouseMoved=false;},100); }
  setNormalized(nx,ny){ this.coords.set(nx,ny); this.mouseMoved=true; }
  onDocumentMouseMove(e){ const inside=this.checkHover(e); this.isHoverInside=inside; if(!inside)return;
    if(this.onInteract)this.onInteract();
    if(this.isAutoActive&&!this.hasUserControl&&!this.takeoverActive){
      const r=this.container.getBoundingClientRect(); if(r.width===0||r.height===0)return;
      let nx=(e.clientX-r.left)/r.width, ny=(e.clientY-r.top)/r.height; nx=Math.max(0,Math.min(1,nx)); ny=Math.max(0,Math.min(1,ny));
      this.takeoverFrom.copy(this.coords); this.takeoverTo.set(nx*2-1,-(ny*2-1));
      this.takeoverStartTime=performance.now(); this.takeoverActive=true; this.hasUserControl=true; this.isAutoActive=false; return; }
    this.setCoords(e.clientX,e.clientY); this.hasUserControl=true; }
  onDocumentTouchStart(e){ if(e.touches.length!==1)return; const t=e.touches[0];
    this.isHoverInside=this.checkHover(e); if(!this.isHoverInside)return;
    if(this.onInteract)this.onInteract(); this.setCoords(t.clientX,t.clientY); this.hasUserControl=true; }
  onDocumentTouchMove(e){ if(e.touches.length!==1)return; const t=e.touches[0];
    this.isHoverInside=this.checkHover(e); if(!this.isHoverInside)return;
    if(this.onInteract)this.onInteract(); this.setCoords(t.clientX,t.clientY); }
  onTouchEnd(){ this.isHoverInside=false; }
  onDocumentLeave(){ this.isHoverInside=false; }
  update(){
    if(this.takeoverActive){ const t=(performance.now()-this.takeoverStartTime)/(this.takeoverDuration*1000);
      if(t>=1){ this.takeoverActive=false; this.coords.copy(this.takeoverTo); this.coords_old.copy(this.coords); this.diff.set(0,0); }
      else{ const k=t*t*(3-2*t); this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo,k); } }
    this.diff.subVectors(this.coords,this.coords_old); this.coords_old.copy(this.coords);
    if(this.coords_old.x===0&&this.coords_old.y===0)this.diff.set(0,0);
    if(this.isAutoActive&&!this.takeoverActive)this.diff.multiplyScalar(this.autoIntensity);
  }
}

class AutoDriver {
  constructor(mouse,manager,opts){ this.mouse=mouse;this.manager=manager;this.enabled=opts.enabled;
    this.speed=opts.speed;this.resumeDelay=opts.resumeDelay||3000;this.rampDurationMs=(opts.rampDuration||0)*1000;
    this.active=false;this.current=new THREE.Vector2(0,0);this.target=new THREE.Vector2();
    this.lastTime=performance.now();this.activationTime=0;this.margin=0.2;this._tmpDir=new THREE.Vector2();this.pickNewTarget(); }
  pickNewTarget(){ const r=Math.random; this.target.set((r()*2-1)*(1-this.margin),(r()*2-1)*(1-this.margin)); }
  forceStop(){ this.active=false; this.mouse.isAutoActive=false; }
  update(){ if(!this.enabled)return; const now=performance.now(); const idle=now-this.manager.lastUserInteraction;
    if(idle<this.resumeDelay){ if(this.active)this.forceStop(); return; }
    if(this.mouse.isHoverInside){ if(this.active)this.forceStop(); return; }
    if(!this.active){ this.active=true; this.current.copy(this.mouse.coords); this.lastTime=now; this.activationTime=now; }
    this.mouse.isAutoActive=true; let dt=(now-this.lastTime)/1000; this.lastTime=now; if(dt>0.2)dt=0.016;
    const dir=this._tmpDir.subVectors(this.target,this.current); const dist=dir.length();
    if(dist<0.01){ this.pickNewTarget(); return; } dir.normalize();
    let ramp=1; if(this.rampDurationMs>0){ const t=Math.min(1,(now-this.activationTime)/this.rampDurationMs); ramp=t*t*(3-2*t); }
    const step=this.speed*dt*ramp; const move=Math.min(step,dist);
    this.current.addScaledVector(dir,move); this.mouse.setNormalized(this.current.x,this.current.y); }
}

const face_vert=`attribute vec3 position;uniform vec2 px;uniform vec2 boundarySpace;varying vec2 uv;precision highp float;void main(){vec3 pos=position;vec2 scale=1.0-boundarySpace*2.0;pos.xy=pos.xy*scale;uv=vec2(0.5)+(pos.xy)*0.5;gl_Position=vec4(pos,1.0);}`;
const line_vert=`attribute vec3 position;uniform vec2 px;precision highp float;varying vec2 uv;void main(){vec3 pos=position;uv=0.5+pos.xy*0.5;vec2 n=sign(pos.xy);pos.xy=abs(pos.xy)-px*1.0;pos.xy*=n;gl_Position=vec4(pos,1.0);}`;
const mouse_vert=`precision highp float;attribute vec3 position;attribute vec2 uv;uniform vec2 center;uniform vec2 scale;uniform vec2 px;varying vec2 vUv;void main(){vec2 pos=position.xy*scale*2.0*px+center;vUv=uv;gl_Position=vec4(pos,0.0,1.0);}`;
const advection_frag=`precision highp float;uniform sampler2D velocity;uniform float dt;uniform bool isBFECC;uniform vec2 fboSize;uniform vec2 px;varying vec2 uv;void main(){vec2 ratio=max(fboSize.x,fboSize.y)/fboSize;if(isBFECC==false){vec2 vel=texture2D(velocity,uv).xy;vec2 uv2=uv-vel*dt*ratio;vec2 nv=texture2D(velocity,uv2).xy;gl_FragColor=vec4(nv,0.0,0.0);}else{vec2 sn=uv;vec2 vo=texture2D(velocity,uv).xy;vec2 so=sn-vo*dt*ratio;vec2 vn1=texture2D(velocity,so).xy;vec2 sn2=so+vn1*dt*ratio;vec2 err=sn2-sn;vec2 sn3=sn-err/2.0;vec2 v2=texture2D(velocity,sn3).xy;vec2 so2=sn3-v2*dt*ratio;vec2 nv2=texture2D(velocity,so2).xy;gl_FragColor=vec4(nv2,0.0,0.0);}}`;
const color_frag=`precision highp float;uniform sampler2D velocity;uniform sampler2D palette;uniform vec4 bgColor;varying vec2 uv;void main(){vec2 vel=texture2D(velocity,uv).xy;float lenv=clamp(length(vel),0.0,1.0);vec3 c=texture2D(palette,vec2(lenv,0.5)).rgb;vec3 o=mix(bgColor.rgb,c,lenv);float a=mix(bgColor.a,1.0,lenv);gl_FragColor=vec4(o,a);}`;
const divergence_frag=`precision highp float;uniform sampler2D velocity;uniform float dt;uniform vec2 px;varying vec2 uv;void main(){float x0=texture2D(velocity,uv-vec2(px.x,0.0)).x;float x1=texture2D(velocity,uv+vec2(px.x,0.0)).x;float y0=texture2D(velocity,uv-vec2(0.0,px.y)).y;float y1=texture2D(velocity,uv+vec2(0.0,px.y)).y;float d=(x1-x0+y1-y0)/2.0;gl_FragColor=vec4(d/dt);}`;
const externalForce_frag=`precision highp float;uniform vec2 force;uniform vec2 center;uniform vec2 scale;uniform vec2 px;varying vec2 vUv;void main(){vec2 circle=(vUv-0.5)*2.0;float d=1.0-min(length(circle),1.0);d*=d;gl_FragColor=vec4(force*d,0.0,1.0);}`;
const poisson_frag=`precision highp float;uniform sampler2D pressure;uniform sampler2D divergence;uniform vec2 px;varying vec2 uv;void main(){float p0=texture2D(pressure,uv+vec2(px.x*2.0,0.0)).r;float p1=texture2D(pressure,uv-vec2(px.x*2.0,0.0)).r;float p2=texture2D(pressure,uv+vec2(0.0,px.y*2.0)).r;float p3=texture2D(pressure,uv-vec2(0.0,px.y*2.0)).r;float div=texture2D(divergence,uv).r;float np=(p0+p1+p2+p3)/4.0-div;gl_FragColor=vec4(np);}`;
const pressure_frag=`precision highp float;uniform sampler2D pressure;uniform sampler2D velocity;uniform vec2 px;uniform float dt;varying vec2 uv;void main(){float s=1.0;float p0=texture2D(pressure,uv+vec2(px.x*s,0.0)).r;float p1=texture2D(pressure,uv-vec2(px.x*s,0.0)).r;float p2=texture2D(pressure,uv+vec2(0.0,px.y*s)).r;float p3=texture2D(pressure,uv-vec2(0.0,px.y*s)).r;vec2 v=texture2D(velocity,uv).xy;vec2 gp=vec2(p0-p1,p2-p3)*0.5;v=v-gp*dt;gl_FragColor=vec4(v,0.0,1.0);}`;
const viscous_frag=`precision highp float;uniform sampler2D velocity;uniform sampler2D velocity_new;uniform float v;uniform vec2 px;uniform float dt;varying vec2 uv;void main(){vec2 old=texture2D(velocity,uv).xy;vec2 n0=texture2D(velocity_new,uv+vec2(px.x*2.0,0.0)).xy;vec2 n1=texture2D(velocity_new,uv-vec2(px.x*2.0,0.0)).xy;vec2 n2=texture2D(velocity_new,uv+vec2(0.0,px.y*2.0)).xy;vec2 n3=texture2D(velocity_new,uv-vec2(0.0,px.y*2.0)).xy;vec2 nv=4.0*old+v*dt*(n0+n1+n2+n3);nv/=4.0*(1.0+v*dt);gl_FragColor=vec4(nv,0.0,0.0);}`;

class ShaderPass {
  constructor(props){ this.props=props||{}; this.uniforms=this.props.material?.uniforms; this.scene=null;this.camera=null;this.material=null;this.geometry=null;this.plane=null; }
  init(){ this.scene=new THREE.Scene(); this.camera=new THREE.Camera();
    if(this.uniforms){ this.material=new THREE.RawShaderMaterial(this.props.material);
      this.geometry=new THREE.PlaneGeometry(2,2); this.plane=new THREE.Mesh(this.geometry,this.material); this.scene.add(this.plane); } }
  update(){ this.props.Common.renderer.setRenderTarget(this.props.output||null);
    this.props.Common.renderer.render(this.scene,this.camera); this.props.Common.renderer.setRenderTarget(null); }
}

class Advection extends ShaderPass {
  constructor(s){ super({material:{vertexShader:face_vert,fragmentShader:advection_frag,uniforms:{
    boundarySpace:{value:s.cellScale},px:{value:s.cellScale},fboSize:{value:s.fboSize},
    velocity:{value:s.src.texture},dt:{value:s.dt},isBFECC:{value:true}}},output:s.dst,Common:s.Common});
    this.uniforms=this.props.material.uniforms; this.init(); }
  init(){ super.init(); this.createBoundary(); }
  createBoundary(){ const g=new THREE.BufferGeometry();
    const vb=new Float32Array([-1,-1,0,-1,1,0,-1,1,0,1,1,0,1,1,0,1,-1,0,1,-1,0,-1,-1,0]);
    g.setAttribute('position',new THREE.BufferAttribute(vb,3));
    const m=new THREE.RawShaderMaterial({vertexShader:line_vert,fragmentShader:advection_frag,uniforms:this.uniforms});
    this.line=new THREE.LineSegments(g,m); this.scene.add(this.line); }
  update({dt,isBounce,BFECC}){ this.uniforms.dt.value=dt; this.line.visible=isBounce; this.uniforms.isBFECC.value=BFECC; super.update(); }
}

class ExternalForce extends ShaderPass {
  constructor(s){ super({output:s.dst,Common:s.Common}); this.init(s); }
  init(s){ super.init(); this.Mouse=s.Mouse;
    const g=new THREE.PlaneGeometry(1,1);
    const m=new THREE.RawShaderMaterial({vertexShader:mouse_vert,fragmentShader:externalForce_frag,
      blending:THREE.AdditiveBlending,depthWrite:false,uniforms:{px:{value:s.cellScale},
      force:{value:new THREE.Vector2(0,0)},center:{value:new THREE.Vector2(0,0)},
      scale:{value:new THREE.Vector2(s.cursor_size,s.cursor_size)}}});
    this.mouse=new THREE.Mesh(g,m); this.scene.add(this.mouse); }
  update(props){ const fx=(this.Mouse.diff.x/2)*props.mouse_force; const fy=(this.Mouse.diff.y/2)*props.mouse_force;
    const csx=props.cursor_size*props.cellScale.x, csy=props.cursor_size*props.cellScale.y;
    const cx=Math.min(Math.max(this.Mouse.coords.x,-1+csx+props.cellScale.x*2),1-csx-props.cellScale.x*2);
    const cy=Math.min(Math.max(this.Mouse.coords.y,-1+csy+props.cellScale.y*2),1-csy-props.cellScale.y*2);
    const u=this.mouse.material.uniforms; u.force.value.set(fx,fy); u.center.value.set(cx,cy); u.scale.value.set(props.cursor_size,props.cursor_size); super.update(); }
}

class Viscous extends ShaderPass {
  constructor(s){ super({material:{vertexShader:face_vert,fragmentShader:viscous_frag,uniforms:{
    boundarySpace:{value:s.boundarySpace},velocity:{value:s.src.texture},velocity_new:{value:s.dst_.texture},
    v:{value:s.viscous},px:{value:s.cellScale},dt:{value:s.dt}}},output:s.dst,output0:s.dst_,output1:s.dst,Common:s.Common}); this.init(); }
  update({viscous,iterations,dt}){ let fi,fo; this.uniforms.v.value=viscous;
    for(let i=0;i<iterations;i++){ if(i%2===0){fi=this.props.output0;fo=this.props.output1;}else{fi=this.props.output1;fo=this.props.output0;}
      this.uniforms.velocity_new.value=fi.texture; this.props.output=fo; this.uniforms.dt.value=dt; super.update(); } return fo; }
}

class Divergence extends ShaderPass {
  constructor(s){ super({material:{vertexShader:face_vert,fragmentShader:divergence_frag,uniforms:{
    boundarySpace:{value:s.boundarySpace},velocity:{value:s.src.texture},px:{value:s.cellScale},dt:{value:s.dt}}},output:s.dst,Common:s.Common}); this.init(); }
  update({vel}){ this.uniforms.velocity.value=vel.texture; super.update(); }
}

class Poisson extends ShaderPass {
  constructor(s){ super({material:{vertexShader:face_vert,fragmentShader:poisson_frag,uniforms:{
    boundarySpace:{value:s.boundarySpace},pressure:{value:s.dst_.texture},divergence:{value:s.src.texture},px:{value:s.cellScale}}},
    output:s.dst,output0:s.dst_,output1:s.dst,Common:s.Common}); this.init(); }
  update({iterations}){ let pi,po; for(let i=0;i<iterations;i++){ if(i%2===0){pi=this.props.output0;po=this.props.output1;}else{pi=this.props.output1;po=this.props.output0;}
    this.uniforms.pressure.value=pi.texture; this.props.output=po; super.update(); } return po; }
}

class Pressure extends ShaderPass {
  constructor(s){ super({material:{vertexShader:face_vert,fragmentShader:pressure_frag,uniforms:{
    boundarySpace:{value:s.boundarySpace},pressure:{value:s.src_p.texture},velocity:{value:s.src_v.texture},px:{value:s.cellScale},dt:{value:s.dt}}},output:s.dst,Common:s.Common}); this.init(); }
  update({vel,pressure}){ this.uniforms.velocity.value=vel.texture; this.uniforms.pressure.value=pressure.texture; super.update(); }
}

class Simulation {
  constructor(options,Common,Mouse){
    this.options={iterations_poisson:32,iterations_viscous:32,mouse_force:20,resolution:0.5,cursor_size:100,
      viscous:30,isBounce:false,dt:0.014,isViscous:false,BFECC:true,...options};
    this.fbos={vel_0:null,vel_1:null,vel_viscous0:null,vel_viscous1:null,div:null,pressure_0:null,pressure_1:null};
    this.fboSize=new THREE.Vector2(); this.cellScale=new THREE.Vector2(); this.boundarySpace=new THREE.Vector2();
    this.Common=Common; this.Mouse=Mouse; this.init(); }
  init(){ this.calcSize(); this.createAllFBO(); this.createShaderPass(); }
  getFloatType(){ const ios=/(iPad|iPhone|iPod)/i.test(navigator.userAgent); return ios?THREE.HalfFloatType:THREE.FloatType; }
  createAllFBO(){ const type=this.getFloatType();
    const o={type,depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,wrapS:THREE.ClampToEdgeWrapping,wrapT:THREE.ClampToEdgeWrapping};
    for(let k in this.fbos)this.fbos[k]=new THREE.WebGLRenderTarget(this.fboSize.x,this.fboSize.y,o); }
  createShaderPass(){
    this.advection=new Advection({cellScale:this.cellScale,fboSize:this.fboSize,dt:this.options.dt,src:this.fbos.vel_0,dst:this.fbos.vel_1,Common:this.Common});
    this.externalForce=new ExternalForce({cellScale:this.cellScale,cursor_size:this.options.cursor_size,dst:this.fbos.vel_1,Common:this.Common,Mouse:this.Mouse});
    this.viscous=new Viscous({cellScale:this.cellScale,boundarySpace:this.boundarySpace,viscous:this.options.viscous,src:this.fbos.vel_1,dst:this.fbos.vel_viscous1,dst_:this.fbos.vel_viscous0,dt:this.options.dt,Common:this.Common});
    this.divergence=new Divergence({cellScale:this.cellScale,boundarySpace:this.boundarySpace,src:this.fbos.vel_viscous0,dst:this.fbos.div,dt:this.options.dt,Common:this.Common});
    this.poisson=new Poisson({cellScale:this.cellScale,boundarySpace:this.boundarySpace,src:this.fbos.div,dst:this.fbos.pressure_1,dst_:this.fbos.pressure_0,Common:this.Common});
    this.pressure=new Pressure({cellScale:this.cellScale,boundarySpace:this.boundarySpace,src_p:this.fbos.pressure_0,src_v:this.fbos.vel_viscous0,dst:this.fbos.vel_0,dt:this.options.dt,Common:this.Common}); }
  calcSize(){ const w=Math.max(1,Math.round(this.options.resolution*this.Common.width));
    const h=Math.max(1,Math.round(this.options.resolution*this.Common.height));
    this.cellScale.set(1/w,1/h); this.fboSize.set(w,h); }
  resize(){ this.calcSize(); for(let k in this.fbos)this.fbos[k].setSize(this.fboSize.x,this.fboSize.y); }
  update(){
    if(this.options.isBounce)this.boundarySpace.set(0,0); else this.boundarySpace.copy(this.cellScale);
    this.advection.update({dt:this.options.dt,isBounce:this.options.isBounce,BFECC:this.options.BFECC});
    this.externalForce.update({cursor_size:this.options.cursor_size,mouse_force:this.options.mouse_force,cellScale:this.cellScale});
    let vel=this.fbos.vel_1;
    if(this.options.isViscous)vel=this.viscous.update({viscous:this.options.viscous,iterations:this.options.iterations_viscous,dt:this.options.dt});
    this.divergence.update({vel}); const p=this.poisson.update({iterations:this.options.iterations_poisson}); this.pressure.update({vel,pressure:p}); }
}

class Output {
  constructor(pt,bg,Common,Mouse){ this.init(pt,bg,Common,Mouse); }
  init(pt,bg,Common,Mouse){ this.simulation=new Simulation(undefined,Common,Mouse);
    this.scene=new THREE.Scene(); this.camera=new THREE.Camera();
    this.output=new THREE.Mesh(new THREE.PlaneGeometry(2,2),
      new THREE.RawShaderMaterial({vertexShader:face_vert,fragmentShader:color_frag,transparent:true,depthWrite:false,uniforms:{
        velocity:{value:this.simulation.fbos.vel_0.texture},boundarySpace:{value:new THREE.Vector2()},palette:{value:pt},bgColor:{value:bg}}}));
    this.scene.add(this.output); this.Common=Common; }
  resize(){ this.simulation.resize(); }
  render(){ this.Common.renderer.setRenderTarget(null); this.Common.renderer.render(this.scene,this.camera); }
  update(){ this.simulation.update(); this.render(); }
}

class WebGLManager {
  constructor(props){ this.props=props; props.Common.init(props.$wrapper); this.props.Mouse.init(props.$wrapper);
    this.props.Mouse.autoIntensity=props.autoIntensity; this.props.Mouse.takeoverDuration=props.takeoverDuration;
    this.lastUserInteraction=performance.now();
    this.props.Mouse.onInteract=()=>{ this.lastUserInteraction=performance.now(); if(this.autoDriver)this.autoDriver.forceStop(); };
    this.autoDriver=new AutoDriver(this.props.Mouse,this,{enabled:props.autoDemo,speed:props.autoSpeed,resumeDelay:props.autoResumeDelay,rampDuration:props.autoRampDuration});
    this.init(); this._loop=this.loop.bind(this); this._resize=this.resize.bind(this);
    window.addEventListener('resize',this._resize);
    this._onVis=()=>{ if(document.hidden)this.pause(); else if(this.props.isVisibleRef)this.start(); };
    document.addEventListener('visibilitychange',this._onVis); this.running=false; }
  init(){ this.props.$wrapper.prepend(this.props.Common.renderer.domElement);
    this.output=new Output(this.props.paletteTex,this.props.bgVec4,this.props.Common,this.props.Mouse); }
  resize(){ this.props.Common.resize(); this.output.resize(); }
  render(){ if(this.autoDriver)this.autoDriver.update(); this.props.Mouse.update(); this.props.Common.update(); this.output.update(); }
  loop(){ if(!this.running)return; this.render(); this.rafId=requestAnimationFrame(this._loop); }
  start(){ if(this.running)return; this.running=true; this._loop(); }
  pause(){ this.running=false; if(this.rafId){cancelAnimationFrame(this.rafId); this.rafId=null;} }
  dispose(){ try{ window.removeEventListener('resize',this._resize); document.removeEventListener('visibilitychange',this._onVis);
    this.props.Mouse.dispose(); if(this.props.Common.renderer){ const c=this.props.Common.renderer.domElement;
      if(c&&c.parentNode)c.parentNode.removeChild(c); this.props.Common.renderer.dispose(); } }catch(e){void 0;} }
}

export class LiquidFlow {
  constructor(container,props){
    const d={mouseForce:20,cursorSize:100,isViscous:false,viscous:30,iterationsViscous:32,iterationsPoisson:32,
      dt:0.014,BFECC:true,resolution:0.5,isBounce:false,colors:'#6B4F4F,#B5A9A0,#E8E2DC',
      autoDemo:true,autoSpeed:0.5,autoIntensity:2.2,takeoverDuration:0.25,autoResumeDelay:1000,autoRampDuration:0.6};
    this.props={...d,...props};
    this.props.colors=Array.isArray(this.props.colors)?this.props.colors:this.props.colors.split(',');
    this.paletteTex=makePaletteTexture(this.props.colors);
    this.bgVec4=new THREE.Vector4(0,0,0,0); this.container=container;
    this.container.style.position=container.style.position||'relative';
    this.container.style.overflow=container.style.overflow||'hidden';
    this.Common=new CommonClass(); this.Mouse=new MouseClass(); this.isVisibleRef=true; this.init(); }
  init(){ this.webglRef=new WebGLManager({$wrapper:this.container,...this.props,isVisibleRef:this.isVisibleRef,
      paletteTex:this.paletteTex,bgVec4:this.bgVec4,Common:this.Common,Mouse:this.Mouse});
    const sim=this.webglRef.output?.simulation;
    if(sim)Object.assign(sim.options,{mouse_force:this.props.mouseForce,cursor_size:this.props.cursorSize,
      isViscous:this.props.isViscous,viscous:this.props.viscous,iterations_viscous:this.props.iterationsViscous,
      iterations_poisson:this.props.iterationsPoisson,dt:this.props.dt,BFECC:this.props.BFECC,resolution:this.props.resolution,isBounce:this.props.isBounce});
    this.webglRef.start();
    const io=new IntersectionObserver(es=>{ const e=es[0]; const vis=e.isIntersecting&&e.intersectionRatio>0;
      this.isVisibleRef=vis; if(!this.webglRef)return; if(vis&&!document.hidden)this.webglRef.start(); else this.webglRef.pause(); },{threshold:[0,0.01,0.1]});
    io.observe(this.container); this.intersectionObserverRef=io;
    const ro=new ResizeObserver(()=>{ if(this.resizeRafRef)cancelAnimationFrame(this.resizeRafRef);
      this.resizeRafRef=requestAnimationFrame(()=>{ if(this.webglRef)this.webglRef.resize(); }); });
    ro.observe(this.container); this.resizeObserverRef=ro; }
  dispose(){ if(this.webglRef)this.webglRef.dispose(); }
}

function getSettings(el){ if(!(el instanceof HTMLElement)||!el.dataset)return {}; const s={}; const d=el.dataset;
  for(const k in d){ if(Object.hasOwnProperty.call(d,k)){ let v=d[k];
    if(v==='true'){s[k]=true;continue;} if(v==='false'){s[k]=false;continue;}
    const p=parseFloat(v); if(!isNaN(p)&&isFinite(p))s[k]=(v.indexOf('.')===-1&&p===Math.floor(p))?parseInt(v,10):p; else s[k]=v; } } return s; }

function initAll(){
  document.querySelectorAll('.liquid-flow-container').forEach(container=>{
    if(container._flowInstance&&container._flowInstance.dispose)container._flowInstance.dispose();
    const parent=container.parentElement;
    if(parent){ parent.style.position='absolute'; parent.style.top='0'; parent.style.bottom='0';
      parent.style.left='0'; parent.style.right='0'; parent.style.height='100%'; parent.style.minHeight='100%'; }
    const settings=getSettings(container);
    container._flowInstance=new LiquidFlow(container,settings);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAll); else initAll();