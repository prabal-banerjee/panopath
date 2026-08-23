(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const TAU = Math.PI * 2;

  const elements = {
    canvas: $('#glCanvas'), viewer: $('#viewer'), empty: $('#emptyState'), file: $('#fileInput'),
    choose: $('#chooseButton'), demo: $('#demoButton'), drop: $('#dropOverlay'), hud: $('#viewerHud'),
    transport: $('#transport'), play: $('#playButton'), start: $('#jumpStartButton'), scrubber: $('#scrubber'),
    fill: $('#timelineFill'), markers: $('#waypointMarkers'), currentTime: $('#currentTime'), totalTime: $('#totalTime'),
    waypointList: $('#waypointList'), addWaypoint: $('#addWaypointButton'), duration: $('#durationInput'),
    globalEase: $('#globalEase'), reverse: $('#reverseButton'), blur: $('#motionBlurToggle'),
    resolution: $('#resolutionSelect'), fps: $('#fpsSelect'), export: $('#exportButton'), exportTop: $('#exportTopButton'),
    estimate: $('#exportEstimate'), resolutionBadge: $('#resolutionBadge'), yaw: $('#yawReadout'), pitch: $('#pitchReadout'), fov: $('#fovReadout'),
    resetView: $('#resetViewButton'), fullscreen: $('#fullscreenButton'), newProject: $('#newProjectButton'),
    dialog: $('#exportDialog'), dialogTitle: $('#exportDialogTitle'), closeDialog: $('#closeDialogButton'), cancelExport: $('#cancelExportButton'),
    exportPreview: $('#exportPreview'), progress: $('#exportProgress'), percent: $('#exportPercent'), exportStatus: $('#exportStatus'),
    renderFrame: $('#renderFrameLabel'), renderNote: $('#renderNote'), download: $('#downloadButton'), toast: $('#toast')
  };

  const state = {
    loaded: false, duration: 8, time: 0, playing: false, playStartedAt: 0, playStartedTime: 0,
    view: { yaw: 0, pitch: 0, fov: 75 }, waypoints: [], selected: -1, aspect: '16:9',
    imageName: '', imageWidth: 0, imageHeight: 0, exporting: false, cancelExport: false, exportUrl: null
  };

  class PanoramaRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
      if (!this.gl) throw new Error('WebGL 2 is required for the panorama renderer.');
      const gl = this.gl;
      const vertex = `#version 300 es
        in vec2 p;
        out vec2 uv;
        void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
      const fragment = `#version 300 es
        precision highp float;
        uniform sampler2D pano;
        uniform float yaw;
        uniform float pitch;
        uniform float fov;
        uniform float aspect;
        in vec2 uv;
        out vec4 color;
        mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        void main(){
          vec2 q = uv * 2. - 1.;
          float t = tan(radians(fov) * .5);
          vec3 ray = normalize(vec3(q.x * aspect * t, q.y * t, -1.));
          ray = rotY(yaw) * rotX(pitch) * ray;
          float u = atan(ray.x, -ray.z) / 6.28318530718 + .5;
          float v = acos(clamp(ray.y, -1., 1.)) / 3.14159265359;
          color = texture(pano, vec2(fract(u), v));
        }`;
      this.program = this.createProgram(vertex, fragment);
      this.uniforms = Object.fromEntries(['pano','yaw','pitch','fov','aspect'].map(n => [n, gl.getUniformLocation(this.program, n)]));
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.program, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.clearColor(.03,.04,.035,1);
    }
    createProgram(vs, fs) {
      const gl = this.gl;
      const compile = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p=gl.createProgram(); gl.attachShader(p,compile(gl.VERTEX_SHADER,vs)); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
    }
    load(source) {
      const gl=this.gl; gl.bindTexture(gl.TEXTURE_2D,this.texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source); gl.generateMipmap(gl.TEXTURE_2D);
    }
    resize(width, height) { this.canvas.width=width; this.canvas.height=height; }
    resizeToDisplay(scale=1) {
      const r=this.canvas.getBoundingClientRect(); const d=Math.min(devicePixelRatio || 1, 2) * scale;
      const w=Math.max(1,Math.round(r.width*d)), h=Math.max(1,Math.round(r.height*d)); if(this.canvas.width!==w||this.canvas.height!==h) this.resize(w,h);
    }
    render(view) {
      const gl=this.gl; gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.texture); gl.uniform1i(this.uniforms.pano,0);
      gl.uniform1f(this.uniforms.yaw, view.yaw*Math.PI/180); gl.uniform1f(this.uniforms.pitch, view.pitch*Math.PI/180);
      gl.uniform1f(this.uniforms.fov,view.fov); gl.uniform1f(this.uniforms.aspect,this.canvas.width/this.canvas.height); gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }

  let renderer;
  try { renderer = new PanoramaRenderer(elements.canvas); }
  catch (error) { toast(error.message); elements.choose.disabled = true; elements.demo.disabled = true; }

  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}.${Math.floor((s%1)*10)}`;
  const easing = {
    linear: t => t,
    smooth: t => t*t*(3-2*t),
    easeInOut: t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2,
    hold: t => t<.3 ? 0 : ((t-.3)/.7)**2*(3-2*((t-.3)/.7))
  };

  function samplePath(time) {
    const w=state.waypoints;
    if(!w.length) return {...state.view};
    if(time<=w[0].time) return pickView(w[0]);
    if(time>=w[w.length-1].time) return pickView(w[w.length-1]);
    let i=0; while(i<w.length-2 && time>w[i+1].time) i++;
    const a=w[i], b=w[i+1], span=Math.max(.001,b.time-a.time), t=clamp((time-a.time)/span,0,1), e=(easing[b.ease]||easing.smooth)(t);
    return { yaw:a.yaw+(b.yaw-a.yaw)*e, pitch:a.pitch+(b.pitch-a.pitch)*e, fov:a.fov+(b.fov-a.fov)*e };
  }
  function pickView(w) { return {yaw:w.yaw,pitch:w.pitch,fov:w.fov}; }
  function setView(view, render=true) {
    state.view={yaw:view.yaw,pitch:clamp(view.pitch,-88,88),fov:clamp(view.fov,30,110)};
    elements.yaw.textContent=`${Math.round((((state.view.yaw+180)%360)+360)%360-180)}°`;
    elements.pitch.textContent=`${Math.round(state.view.pitch)}°`;
    elements.fov.textContent=`${Math.round(state.view.fov)}° FOV`;
    if(render && state.loaded) renderer.render(state.view);
  }
  function setTime(time, updateView=true) {
    state.time=clamp(time,0,state.duration); elements.scrubber.value=state.time; elements.currentTime.textContent=formatTime(state.time);
    elements.fill.style.width=`${state.time/state.duration*100}%`;
    if(updateView) setView(samplePath(state.time));
    const nearest=state.waypoints.findIndex(w=>Math.abs(w.time-state.time)<.035); if(nearest>=0) { state.selected=nearest; renderWaypoints(); }
  }

  function enableEditor() {
    state.loaded=true; elements.empty.classList.add('hidden'); elements.hud.classList.remove('hidden'); elements.transport.classList.remove('disabled');
    [elements.addWaypoint,elements.duration,elements.globalEase,elements.reverse,elements.blur,elements.resolution,elements.fps,elements.export,elements.exportTop].forEach(e=>e.disabled=false);
    $$('#aspectControl button').forEach(e=>e.disabled=false); updateEstimate();
  }

  async function loadFile(file) {
    if(!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Choose a JPG, PNG, or WebP panorama.');
    if(file.size>100*1024*1024) return toast('That file is over 100 MB. Please use a smaller panorama.');
    try {
      const bitmap=await createImageBitmap(file); await loadBitmap(bitmap,file.name); bitmap.close();
      if(Math.abs(state.imageWidth/state.imageHeight-2)>.12) toast('Loaded, but this image is not close to the recommended 2:1 panorama ratio.');
    } catch { toast('The browser could not decode that image.'); }
  }

  async function loadBitmap(bitmap,name) {
    state.imageWidth=bitmap.width; state.imageHeight=bitmap.height; state.imageName=name; renderer.load(bitmap); enableEditor();
    $('.project-name').textContent=name.replace(/\.[^.]+$/,''); elements.resolutionBadge.textContent=`${bitmap.width} × ${bitmap.height} · LOCAL`;
    state.waypoints=[
      {time:0,yaw:0,pitch:0,fov:76,ease:'smooth'},
      {time:state.duration*.5,yaw:80,pitch:-5,fov:64,ease:'smooth'},
      {time:state.duration,yaw:175,pitch:3,fov:76,ease:'smooth'}
    ]; state.selected=0; setTime(0); renderWaypoints(); renderMarkers();
  }

  function makeDemo() {
    const c=document.createElement('canvas'); c.width=4096; c.height=2048; const x=c.getContext('2d');
    const sky=x.createLinearGradient(0,0,0,1300); sky.addColorStop(0,'#10252e'); sky.addColorStop(.35,'#b0613f'); sky.addColorStop(.56,'#e9b26c'); sky.addColorStop(1,'#3b4033'); x.fillStyle=sky; x.fillRect(0,0,c.width,c.height);
    x.globalAlpha=.65; x.fillStyle='#f3d98a'; x.beginPath(); x.arc(890,630,145,0,TAU); x.fill(); x.globalAlpha=1;
    const mountains=(base,amp,color,phase)=>{x.fillStyle=color;x.beginPath();x.moveTo(0,2048);for(let i=0;i<=128;i++){const px=i/128*c.width,py=base+Math.sin(i*.31+phase)*amp+Math.sin(i*.91+phase)*amp*.25;x.lineTo(px,py)}x.lineTo(c.width,2048);x.fill();};
    mountains(1160,130,'#343a35',.2); mountains(1320,180,'#202923',1.8); mountains(1540,130,'#151c18',3.1);
    x.fillStyle='#0c1310'; for(let i=0;i<180;i++){const px=(i*193)%c.width,h=80+((i*67)%260);x.fillRect(px,1530-h,8,h);x.beginPath();x.moveTo(px-42,1550-h);x.lineTo(px+4,1430-h);x.lineTo(px+50,1550-h);x.fill();}
    x.fillStyle='#18211b';x.fillRect(0,1580,c.width,468); const ground=x.createLinearGradient(0,1580,0,2048);ground.addColorStop(0,'rgba(88,102,76,.6)');ground.addColorStop(1,'#0a0e0b');x.fillStyle=ground;x.fillRect(0,1580,c.width,468);
    x.strokeStyle='rgba(222,197,134,.18)';x.lineWidth=4;for(let i=0;i<46;i++){x.beginPath();x.moveTo(i*97,2048);x.quadraticCurveTo(i*92+120,1810,i*91+30,1600);x.stroke();}
    loadBitmap(c,'Highland dusk — demo');
  }

  function addWaypoint() {
    if(!state.loaded) return;
    let time=state.time;
    if(state.waypoints.some(w=>Math.abs(w.time-time)<.08)) time=clamp(time+.25,0,state.duration);
    state.waypoints.push({time,yaw:state.view.yaw,pitch:state.view.pitch,fov:state.view.fov,ease:elements.globalEase.value});
    state.waypoints.sort((a,b)=>a.time-b.time); state.selected=state.waypoints.findIndex(w=>w.time===time); renderWaypoints();renderMarkers();toast('Waypoint captured');
  }

  function renderWaypoints() {
    elements.waypointList.innerHTML='';
    state.waypoints.forEach((w,i)=>{
      const card=document.createElement('div');card.className=`waypoint-card${i===state.selected?' active':''}`;card.dataset.index=i;
      card.innerHTML=`<span class="waypoint-index">${String(i+1).padStart(2,'0')}</span><div><strong>${i===0?'Opening frame':i===state.waypoints.length-1?'Closing frame':`Waypoint ${i+1}`}</strong><p>${Math.round(w.yaw)}° pan · ${Math.round(w.pitch)}° tilt · ${Math.round(w.fov)}° FOV</p></div><span class="waypoint-time">${w.time.toFixed(1)} sec</span><div class="waypoint-actions"><label>Time<input data-key="time" type="number" min="0" max="${state.duration}" step="0.1" value="${w.time.toFixed(1)}"></label><label>Pan<input data-key="yaw" type="number" step="1" value="${Math.round(w.yaw)}"></label><label>FOV<input data-key="fov" type="number" min="30" max="110" value="${Math.round(w.fov)}"></label><button class="waypoint-delete" type="button" title="Delete waypoint">×</button></div>`;
      card.addEventListener('click',e=>{if(e.target.matches('input,button'))return;state.selected=i;setTime(w.time);renderWaypoints();renderMarkers();});
      $$('input',card).forEach(input=>input.addEventListener('change',()=>{const key=input.dataset.key;w[key]=Number(input.value);if(key==='time'){w.time=clamp(w.time,0,state.duration);state.waypoints.sort((a,b)=>a.time-b.time);state.selected=state.waypoints.indexOf(w);} if(key==='fov')w.fov=clamp(w.fov,30,110);renderWaypoints();renderMarkers();setView(pickView(w));}));
      $('.waypoint-delete',card).addEventListener('click',()=>{if(state.waypoints.length<=2)return toast('Keep at least two waypoints.');state.waypoints.splice(i,1);state.selected=clamp(state.selected,0,state.waypoints.length-1);renderWaypoints();renderMarkers();});
      elements.waypointList.appendChild(card);
    });
  }
  function renderMarkers(){elements.markers.innerHTML='';state.waypoints.forEach((w,i)=>{const m=document.createElement('i');m.className=`timeline-marker${i===state.selected?' active':''}`;m.style.left=`${w.time/state.duration*100}%`;elements.markers.appendChild(m);});}

  function togglePlayback() {
    if(!state.loaded)return;
    if(state.playing){state.playing=false;elements.play.classList.remove('playing');return;}
    if(state.time>=state.duration-.01)setTime(0); state.playing=true;state.playStartedAt=performance.now();state.playStartedTime=state.time;elements.play.classList.add('playing');requestAnimationFrame(playLoop);
  }
  function playLoop(now){if(!state.playing)return;const t=state.playStartedTime+(now-state.playStartedAt)/1000;if(t>=state.duration){setTime(state.duration);state.playing=false;elements.play.classList.remove('playing');return;}setTime(t);requestAnimationFrame(playLoop);}

  let drag=null;
  elements.canvas.addEventListener('pointerdown',e=>{if(!state.loaded)return;state.playing=false;elements.play.classList.remove('playing');elements.canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,yaw:state.view.yaw,pitch:state.view.pitch};});
  elements.canvas.addEventListener('pointermove',e=>{if(!drag)return;setView({yaw:drag.yaw-(e.clientX-drag.x)*.16,pitch:drag.pitch+(e.clientY-drag.y)*.14,fov:state.view.fov});});
  elements.canvas.addEventListener('pointerup',()=>drag=null);
  elements.canvas.addEventListener('wheel',e=>{if(!state.loaded)return;e.preventDefault();setView({...state.view,fov:state.view.fov+e.deltaY*.035});},{passive:false});
  elements.canvas.addEventListener('dblclick',addWaypoint);

  function bindUI(){
    elements.choose.onclick=()=>elements.file.click(); elements.file.onchange=()=>loadFile(elements.file.files[0]); elements.demo.onclick=makeDemo;
    let dragDepth=0; document.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;elements.drop.classList.add('visible');});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;elements.drop.classList.remove('visible');}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;elements.drop.classList.remove('visible');loadFile(e.dataTransfer.files[0]);});
    elements.addWaypoint.onclick=addWaypoint; elements.play.onclick=togglePlayback; elements.start.onclick=()=>{state.playing=false;elements.play.classList.remove('playing');setTime(0);};
    elements.scrubber.oninput=()=>{state.playing=false;elements.play.classList.remove('playing');setTime(Number(elements.scrubber.value));};
    elements.duration.onchange=()=>{const old=state.duration;state.duration=clamp(Number(elements.duration.value)||8,2,60);state.waypoints.forEach(w=>w.time=clamp(w.time/old*state.duration,0,state.duration));elements.scrubber.max=state.duration;elements.totalTime.textContent=formatTime(state.duration);$$('.timeline-ruler span').forEach((el,i,list)=>el.textContent=`${(state.duration*i/(list.length-1)).toFixed(state.duration<5?1:0)}s`);renderWaypoints();renderMarkers();updateEstimate();};
    elements.reverse.onclick=()=>{state.waypoints=state.waypoints.map(w=>({...w,time:state.duration-w.time})).reverse();state.selected=0;renderWaypoints();renderMarkers();setTime(0);};
    elements.resetView.onclick=()=>setView({yaw:0,pitch:0,fov:75}); elements.fullscreen.onclick=()=>elements.viewer.requestFullscreen?.();
    elements.newProject.onclick=()=>location.reload(); elements.export.onclick=startExport;elements.exportTop.onclick=startExport;
    elements.closeDialog.onclick=closeExportDialog;elements.cancelExport.onclick=()=>{state.cancelExport=true;if(!state.exporting)closeExportDialog();};
    elements.resolution.onchange=updateEstimate;elements.fps.onchange=updateEstimate;elements.blur.onchange=updateEstimate;
    $$('#aspectControl button').forEach(b=>b.onclick=()=>{$$('#aspectControl button').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});state.aspect=b.dataset.aspect;updateEstimate();});
    window.addEventListener('resize',()=>{if(state.loaded&&!state.exporting){renderer.resizeToDisplay();renderer.render(state.view);}});
  }

  function dimensions(){const p=Number(elements.resolution.value),a=state.aspect;if(a==='16:9')return [Math.round(p*16/9),p];if(a==='9:16')return [p,Math.round(p*16/9)];return[p,p];}
  function updateEstimate(){const [w,h]=dimensions(),fps=Number(elements.fps.value),rate=bitrateFor(w,h,fps);elements.estimate.textContent=`WebM · ${w}×${h} · ${fps} fps · ${Math.round(rate/1e6)} Mbps`;}
  function bitrateFor(w,h,fps){return clamp(Math.round(w*h*fps*.115),8e6,80e6);}

  async function startExport(){
    if(state.waypoints.length<2)return toast('Add at least two waypoints.');
    if(state.exportUrl){URL.revokeObjectURL(state.exportUrl);state.exportUrl=null;}
    state.exporting=true;state.cancelExport=false;elements.download.classList.add('hidden');elements.cancelExport.classList.remove('hidden');elements.closeDialog.disabled=true;elements.dialogTitle.textContent='Rendering your path';elements.progress.style.width='0%';elements.percent.textContent='0%';elements.dialog.showModal();
    const [width,height]=dimensions(),fps=Number(elements.fps.value),frames=Math.ceil(state.duration*fps),old=[renderer.canvas.width,renderer.canvas.height];
    const preview=elements.exportPreview,px=preview.getContext('2d');preview.width=Math.min(width,960);preview.height=Math.round(preview.width*height/width);renderer.resize(width,height);
    try{
      if('VideoEncoder' in window && 'VideoFrame' in window) await exportWebCodecs(width,height,fps,frames,px);
      else await exportMediaRecorder(width,height,fps,frames,px);
    }catch(error){if(!state.cancelExport){elements.exportStatus.textContent='Export failed';elements.renderNote.textContent=error.message||'The encoder stopped unexpectedly.';toast('Export failed. Try 1080p or 30 fps.');}}
    finally{renderer.resize(old[0],old[1]);renderer.render(state.view);state.exporting=false;elements.closeDialog.disabled=false;}
  }

  async function exportWebCodecs(width,height,fps,total,previewContext){
    const codec='vp09.00.10.08', bitrate=bitrateFor(width,height,fps), config={codec,width,height,bitrate,framerate:fps,latencyMode:'quality'};
    const support=await VideoEncoder.isConfigSupported(config);if(!support.supported)throw new Error('This browser cannot encode VP9 at the selected size. Try 1080p.');
    const chunks=[];let encoderError=null;const encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);chunks.push({data,timestamp:chunk.timestamp,key:chunk.type==='key'});},error:e=>encoderError=e});encoder.configure(config);
    const blurEnabled=elements.blur.checked, blurCanvas=blurEnabled?document.createElement('canvas'):null, blurContext=blurEnabled?blurCanvas.getContext('2d'):null;
    if(blurCanvas){blurCanvas.width=width;blurCanvas.height=height;}
    elements.exportStatus.textContent='Frame-locked VP9 encode';
    for(let i=0;i<total;i++){
      if(state.cancelExport){encoder.close();throw new Error('Export cancelled');}
      const time=i/fps;
      let frameSource=renderer.canvas;
      if(blurEnabled){
        const samples=4;
        for(let s=0;s<samples;s++){
          renderer.render(samplePath(clamp(time+(s/(samples-1)-.5)/fps,0,state.duration)));
          blurContext.globalCompositeOperation=s===0?'copy':'source-over';blurContext.globalAlpha=s===0?1:1/(s+1);blurContext.drawImage(renderer.canvas,0,0);
        }
        blurContext.globalAlpha=1;frameSource=blurCanvas;
      }else renderer.render(samplePath(time));
      const frame=new VideoFrame(frameSource,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});encoder.encode(frame,{keyFrame:i%(fps*2)===0});frame.close();
      if(encoder.encodeQueueSize>8)await encoder.flush();if(encoderError)throw encoderError;
      if(i%3===0||i===total-1){previewContext.drawImage(frameSource,0,0,elements.exportPreview.width,elements.exportPreview.height);updateExportProgress(i+1,total,`Frame ${i+1} of ${total}`);await nextPaint();}
    }
    await encoder.flush();encoder.close();elements.exportStatus.textContent='Packaging WebM';await nextPaint();
    chunks.sort((a,b)=>a.timestamp-b.timestamp);finishExport(makeWebM(chunks,width,height,fps,state.duration),'panopath-video.webm',`VP9 WebM · frame-accurate${blurEnabled?' · motion blur':''}`);
  }

  async function exportMediaRecorder(width,height,fps,total,previewContext){
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(MediaRecorder.isTypeSupported.bind(MediaRecorder));if(!mime)throw new Error('This browser has no compatible video encoder.');
    elements.exportStatus.textContent='Compatibility encode (real time)';elements.renderNote.textContent='This browser does not expose frame-locked WebCodecs, so the compatibility encoder runs in real time.';
    const stream=renderer.canvas.captureStream(0),track=stream.getVideoTracks()[0],parts=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrateFor(width,height,fps)});recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.start();
    const start=performance.now();
    for(let i=0;i<total;i++){if(state.cancelExport){recorder.stop();throw new Error('Export cancelled');}const target=start+i*1000/fps;while(performance.now()<target)await new Promise(r=>setTimeout(r,Math.min(8,target-performance.now())));renderer.render(samplePath(i/fps));track.requestFrame?.();if(i%3===0){previewContext.drawImage(renderer.canvas,0,0,elements.exportPreview.width,elements.exportPreview.height);updateExportProgress(i+1,total,`Frame ${i+1} of ${total}`);}}
    await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(t=>t.stop());finishExport(new Blob(parts,{type:mime}),'panopath-video.webm','WebM · compatibility encode');
  }

  function updateExportProgress(done,total,label){const p=Math.round(done/total*100);elements.progress.style.width=`${p}%`;elements.percent.textContent=`${p}%`;elements.renderFrame.textContent=label;}
  function finishExport(blob,name,note){state.exportUrl=URL.createObjectURL(blob);elements.download.href=state.exportUrl;elements.download.download=name;elements.download.textContent=`Download video · ${formatBytes(blob.size)}`;elements.download.classList.remove('hidden');elements.cancelExport.classList.add('hidden');elements.dialogTitle.textContent='Your video is ready';elements.exportStatus.textContent=note;elements.renderNote.textContent='The file was created locally. It has not been uploaded or stored anywhere.';elements.progress.style.width='100%';elements.percent.textContent='100%';elements.renderFrame.textContent='Render complete';}
  function closeExportDialog(){if(state.exporting)return;elements.dialog.close();}
  const nextPaint=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  const formatBytes=n=>n>1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;

  // Minimal WebM muxer. Encoding is completed before muxing so timestamps and segment size are deterministic.
  function makeWebM(chunks,width,height,fps,duration){
    const E=(id,data)=>concat(idBytes(id),vint(data.length),data), U=n=>{let a=[];do{a.unshift(n&255);n=Math.floor(n/256)}while(n);return new Uint8Array(a)}, S=s=>new TextEncoder().encode(s), F=n=>{const b=new ArrayBuffer(8);new DataView(b).setFloat64(0,n);return new Uint8Array(b)};
    const header=E(0x1a45dfa3,concat(E(0x4286,U(1)),E(0x42f7,U(1)),E(0x42f2,U(4)),E(0x42f3,U(8)),E(0x4282,S('webm')),E(0x4287,U(4)),E(0x4285,U(2))));
    const info=E(0x1549a966,concat(E(0x2ad7b1,U(1000000)),E(0x4d80,S('PanoPath')),E(0x5741,S('PanoPath')),E(0x4489,F(duration*1000))));
    const video=E(0xe0,concat(E(0xb0,U(width)),E(0xba,U(height))));
    const track=E(0x1654ae6b,E(0xae,concat(E(0xd7,U(1)),E(0x73c5,U(1)),E(0x83,U(1)),E(0x86,S('V_VP9')),E(0x23e383,U(Math.round(1e9/fps))),video)));
    const clusters=[];let group=[],base=0;
    chunks.forEach((c,i)=>{const ms=Math.round(c.timestamp/1000);if(!group.length)base=ms;if(ms-base>30000){clusters.push(cluster(base,group,E,U));group=[];base=ms;}const rel=ms-base,payload=new Uint8Array(4+c.data.length);payload[0]=0x81;payload[1]=(rel>>8)&255;payload[2]=rel&255;payload[3]=c.key?0x80:0;payload.set(c.data,4);group.push(E(0xa3,payload));});if(group.length)clusters.push(cluster(base,group,E,U));
    const segment=E(0x18538067,concat(info,track,...clusters));return new Blob([header,segment],{type:'video/webm'});
  }
  function cluster(base,blocks,E,U){return E(0x1f43b675,concat(E(0xe7,U(base)),...blocks));}
  function idBytes(id){const a=[];while(id){a.unshift(id&255);id=Math.floor(id/256)}return new Uint8Array(a);}
  function vint(n){for(let len=1;len<=8;len++){const max=Math.pow(2,7*len)-1;if(n<max){const a=new Uint8Array(len);let v=n;for(let i=len-1;i>=0;i--){a[i]=v&255;v=Math.floor(v/256)}a[0]|=1<<(8-len);return a;}}throw new Error('EBML element too large');}
  function concat(...arrays){const size=arrays.reduce((n,a)=>n+a.length,0),out=new Uint8Array(size);let p=0;arrays.forEach(a=>{out.set(a,p);p+=a.length});return out;}

  let toastTimer;function toast(message){elements.toast.textContent=message;elements.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>elements.toast.classList.remove('show'),3300);}

  bindUI();
  const ro=new ResizeObserver(()=>{if(renderer&&!state.exporting){renderer.resizeToDisplay();if(state.loaded)renderer.render(state.view);}});ro.observe(elements.viewer);
})();
