var H=Object.defineProperty;var z=(o,t,a)=>t in o?H(o,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):o[t]=a;var m=(o,t,a)=>z(o,typeof t!="symbol"?t+"":t,a);import{T as R,S as $,d as K,o as q,D as J,c as P,a as r,u as T,b as M,e as A,t as x,h as Q,E as k,F as Z,r as tt,f as D,v as et,U as at,q as ot,l as it,i as w,s as g,O as rt,m as I,_ as U,B as nt,P as st,n as lt}from"./index-CO_WpPhW.js";const X=`#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;      // 单位四边形 -0.5..0.5
layout(location=1) in vec4 aInstance;    // cx, cy, w, h (uv)
layout(location=2) in vec2 aTiltPalette; // tilt, paletteIdx
uniform mat4 uViewProj;
uniform int uWallKind;
uniform float uWidth;
uniform float uHeight;
uniform float uRadius;
uniform float uArcAngle;
const float PI = 3.14159265359;
${$()}
out vec3 vNormal;
out vec3 vWorld;
out vec2 vLocal;
flat out int vPaletteIdx;
flat out int vInstanceId;
void main() {
  float c = cos(aTiltPalette.x);
  float s = sin(aTiltPalette.x);
  vec2 local = aCorner * aInstance.zw;
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 uv = aInstance.xy + rotated;
  vec3 n;
  vec3 tanU;
  vec3 tanV;
  vec3 world;
  wallMap(uv, world, n, tanU, tanV);
  // 倾角法线扰动：沿解析切向按块内偏移量倾斜，幅度随倾斜角自然变化
  vec3 tileN = normalize(n + (tanU * rotated.x + tanV * rotated.y) * 2.4);
  vNormal = tileN;
  vWorld = world;
  vLocal = aCorner + 0.5;
  vPaletteIdx = int(aTiltPalette.y + 0.5);
  vInstanceId = gl_InstanceID;
  gl_Position = uViewProj * vec4(world, 1.0);
}
`,ct=`#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
in vec2 vLocal;
flat in int vPaletteIdx;
uniform sampler2D uPalette;   // 256x1: rgb 线性色, a=类别(0玻璃1金2石)
uniform sampler2D uMaterial;  // 256x1: r=opacity g=roughness b=reflectivity
uniform vec3 uEye;
uniform float uHeight;
uniform int uLightMode;       // 0 日光 1 射灯 2 蜡烛
uniform float uTime;
uniform float uIntensity;
uniform int uShowBurn;
out vec4 outColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  int pi = clamp(vPaletteIdx, 0, 255);
  vec4 tex = texelFetch(uPalette, ivec2(pi, 0), 0);
  vec4 mat = texelFetch(uMaterial, ivec2(pi, 0), 0);
  vec3 base = tex.rgb;
  float category = tex.a;
  float roughness = mat.g;
  float reflectivity = mat.b;

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);

  // 光源：方向/位置/颜色随模式切换
  vec3 L;
  vec3 lightColor;
  float atten = 1.0;
  if (uLightMode == 0) {
    // 白天自然光：大角度漫射主光 + 天光
    L = normalize(vec3(0.45, 0.75, 0.55));
    lightColor = vec3(1.0, 0.97, 0.9) * 1.1;
  } else if (uLightMode == 1) {
    // 射灯：前方高位点光
    vec3 lp = vec3(0.0, uHeight * 0.95, 3.2);
    vec3 toLight = lp - vWorld;
    float dist = length(toLight);
    L = toLight / dist;
    atten = 6.0 / (1.0 + 0.25 * dist * dist);
    lightColor = vec3(1.0, 0.98, 0.95) * 1.6;
  } else {
    // 蜡烛：暖色低位点光，带轻微闪烁
    vec3 lp = vec3(sin(uTime * 0.7) * 0.15, uHeight * 0.12, 1.1);
    vec3 toLight = lp - vWorld;
    float dist = length(toLight);
    L = toLight / dist;
    atten = 3.2 / (1.0 + 0.9 * dist * dist);
    float flicker = 0.85 + 0.15 * sin(uTime * 9.0 + vWorld.y * 7.0);
    lightColor = vec3(1.0, 0.62, 0.28) * 1.5 * flicker;
  }

  float ndl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float specPow = mix(180.0, 8.0, roughness);
  float spec = pow(max(dot(N, H), 0.0), specPow) * reflectivity * atten;

  vec3 color;
  if (category > 0.5 && category < 1.5) {
    // 金箔：各向异性强高光 + 视角相关闪烁
    float blockSeed = hash11(float(pi) * 91.7 + floor(vWorld.x * 40.0) * 3.1 + floor(vWorld.y * 40.0) * 7.7);
    float glint = pow(max(dot(N, H), 0.0), mix(120.0, 400.0, blockSeed)) * (1.4 + blockSeed);
    float sweep = 0.5 + 0.5 * sin(uTime * 1.3 + blockSeed * 31.4 + vWorld.x * 3.0);
    color = base * (0.35 + 0.75 * ndl) * lightColor * atten;
    color += vec3(1.0, 0.78, 0.36) * (glint * 2.2 + spec * 1.5) * (0.6 + 0.4 * sweep);
  } else {
    float ambient = category > 1.5 ? 0.42 : 0.5; // 石头更吸光
    vec3 sky = vec3(0.55, 0.66, 0.82) * ambient;
    color = base * ((sky + lightColor * ndl * 0.9) * atten);
    color += lightColor * spec * (category > 1.5 ? 0.5 : 1.0);
    // 玻璃半透感：边缘加一点透射亮边
    if (category < 0.5) {
      float edge = smoothstep(0.42, 0.5, abs(vLocal.x - 0.5)) + smoothstep(0.42, 0.5, abs(vLocal.y - 0.5));
      color += base * edge * 0.12 * (1.0 - mat.r);
    }
  }
  color *= uIntensity;

  // 死白报警：过曝且低饱和区域
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(color.r, max(color.g, color.b));
  float mn = min(color.r, min(color.g, color.b));
  float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
  if (uShowBurn == 1 && lum > 1.05 && sat < 0.18) {
    color = mix(color, vec3(1.0, 0.18, 0.1), 0.72);
  }
  outColor = vec4(color, 1.0);
}
`,ut=X,ht=`#version 300 es
precision highp float;
flat in int vInstanceId;
uniform int uPickBase;
out vec4 outColor;
void main() {
  // 实例 ID 由顶点阶段经 flat varying 传入（片元阶段无 gl_InstanceID）
  int id = vInstanceId + uPickBase;
  outColor = vec4(float((id + 1) & 255) / 255.0,
                  float(((id + 1) >> 8) & 255) / 255.0,
                  float(((id + 1) >> 16) & 255) / 255.0, 1.0);
}
`;function S(o,t,a){const e=o.createShader(t);if(!e)throw new Error("shader 创建失败");if(o.shaderSource(e,a),o.compileShader(e),!o.getShaderParameter(e,o.COMPILE_STATUS))throw new Error("shader 编译失败: "+o.getShaderInfoLog(e));return e}function V(o,t,a){const e=o.createProgram();if(!e)throw new Error("program 创建失败");if(o.attachShader(e,S(o,o.VERTEX_SHADER,t)),o.attachShader(e,S(o,o.FRAGMENT_SHADER,a)),o.linkProgram(e),!o.getProgramParameter(e,o.LINK_STATUS))throw new Error("program 链接失败: "+o.getProgramInfoLog(e));return e}class dt{constructor(t,a){m(this,"gl");m(this,"mainProgram");m(this,"pickProgram");m(this,"vao");m(this,"cornerVbo");m(this,"instanceVbo");m(this,"paletteTex");m(this,"materialTex");m(this,"pickFbo");m(this,"pickTex");m(this,"instanceCount",0);m(this,"wall");m(this,"camera",{yaw:0,pitch:.08,distance:5});m(this,"lightMode","daylight");m(this,"intensity",1);m(this,"showBurn",!1);m(this,"time",0);m(this,"raf",0);m(this,"uniforms",{});m(this,"pickUniforms",{});const e=t.getContext("webgl2",{antialias:!0,alpha:!1});if(!e)throw new Error("当前浏览器不支持 WebGL2");this.gl=e,this.wall=a,this.mainProgram=V(e,X,ct),this.pickProgram=V(e,ut,ht),this.vao=e.createVertexArray(),this.cornerVbo=e.createBuffer(),this.instanceVbo=e.createBuffer(),this.paletteTex=e.createTexture(),this.materialTex=e.createTexture(),this.pickFbo=e.createFramebuffer(),this.pickTex=e.createTexture(),this.initBuffers(),this.cacheUniforms(),e.enable(e.DEPTH_TEST)}cacheUniforms(){const t=this.gl;for(const a of[this.mainProgram,this.pickProgram]){const e=a===this.mainProgram?this.uniforms:this.pickUniforms,n=t.getProgramParameter(a,t.ACTIVE_UNIFORMS);for(let s=0;s<n;s++){const c=t.getActiveUniform(a,s);c&&(e[c.name]=t.getUniformLocation(a,c.name))}}}initBuffers(){const t=this.gl;t.bindVertexArray(this.vao),t.bindBuffer(t.ARRAY_BUFFER,this.cornerVbo),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,this.instanceVbo),t.enableVertexAttribArray(1),t.vertexAttribPointer(1,4,t.FLOAT,!1,R*4,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,2,t.FLOAT,!1,R*4,4*4),t.vertexAttribDivisor(2,1),t.bindVertexArray(null)}uploadTiles(t){const a=this.gl;this.instanceCount=t.count,a.bindBuffer(a.ARRAY_BUFFER,this.instanceVbo),a.bufferData(a.ARRAY_BUFFER,t.data.byteLength,a.DYNAMIC_DRAW),a.bufferSubData(a.ARRAY_BUFFER,0,t.data)}updateTileRange(t,a,e=1){const n=this.gl,s=a*R*4,c=new Float32Array(t.data.buffer,t.data.byteOffset+s,e*R);n.bindBuffer(n.ARRAY_BUFFER,this.instanceVbo),n.bufferSubData(n.ARRAY_BUFFER,s,c)}uploadMaterials(t,a){const e=this.gl,n=new Map(a.map(h=>[h.id,h])),s=new Uint8Array(256*4),c=new Uint8Array(256*4),l={glass:0,gold:1,stone:2};t.palette.forEach((h,u)=>{const v=n.get(h.materialId);s[u*4]=h.color[0],s[u*4+1]=h.color[1],s[u*4+2]=h.color[2],s[u*4+3]=v?l[v.category]:0,v&&(c[u*4]=Math.round(v.opacity*255),c[u*4+1]=Math.round(v.roughness*255),c[u*4+2]=Math.round(v.reflectivity*255))});for(const[h,u]of[[this.paletteTex,s],[this.materialTex,c]])e.bindTexture(e.TEXTURE_2D,h),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,256,1,0,e.RGBA,e.UNSIGNED_BYTE,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}setCamera(t){Object.assign(this.camera,t)}getCamera(){return{...this.camera}}setWall(t){this.wall=t}resize(){const t=this.gl.canvas,a=Math.min(2,window.devicePixelRatio||1),e=Math.max(1,Math.floor(t.clientWidth*a)),n=Math.max(1,Math.floor(t.clientHeight*a));(t.width!==e||t.height!==n)&&(t.width=e,t.height=n)}viewProj(){const{yaw:t,pitch:a,distance:e}=this.camera,n=this.gl.canvas.width/Math.max(1,this.gl.canvas.height),s=[e*Math.cos(a)*Math.sin(t),e*Math.sin(a)+this.wall.height*.4,e*Math.cos(a)*Math.cos(t)];return ft(s,[0,this.wall.height*.4,0],n)}bindWallUniforms(t){const a=this.gl;a.uniform1i(t.uWallKind,{flat:0,arc:1,dome:2}[this.wall.kind]),a.uniform1f(t.uWidth,this.wall.width),a.uniform1f(t.uHeight,this.wall.height),a.uniform1f(t.uRadius,this.wall.radius),a.uniform1f(t.uArcAngle,this.wall.arcAngle)}render(){const t=this.gl;if(this.resize(),this.time+=.016,t.viewport(0,0,t.canvas.width,t.canvas.height),t.clearColor(.055,.06,.075,1),t.clear(t.COLOR_BUFFER_BIT|t.DEPTH_BUFFER_BIT),this.instanceCount===0)return;t.useProgram(this.mainProgram),t.bindVertexArray(this.vao);const a=this.uniforms;t.uniformMatrix4fv(a.uViewProj,!1,this.viewProj()),this.bindWallUniforms(a);const{yaw:e,pitch:n,distance:s}=this.camera;t.uniform3f(a.uEye,s*Math.cos(n)*Math.sin(e),s*Math.sin(n)+this.wall.height*.4,s*Math.cos(n)*Math.cos(e)),t.uniform1i(a.uLightMode,{daylight:0,spot:1,candle:2}[this.lightMode]),t.uniform1f(a.uTime,this.time),t.uniform1f(a.uIntensity,this.intensity),t.uniform1i(a.uShowBurn,this.showBurn?1:0),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.paletteTex),t.uniform1i(a.uPalette,0),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.materialTex),t.uniform1i(a.uMaterial,1),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,this.instanceCount)}start(){const t=()=>{this.render(),this.raf=requestAnimationFrame(t)};this.raf=requestAnimationFrame(t)}stop(){cancelAnimationFrame(this.raf)}pick(t,a){const e=this.gl,n=e.canvas.width,s=e.canvas.height;if(e.bindTexture(e.TEXTURE_2D,this.pickTex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,n,s,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindFramebuffer(e.FRAMEBUFFER,this.pickFbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.pickTex,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)return-1;e.viewport(0,0,n,s),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.useProgram(this.pickProgram),e.bindVertexArray(this.vao);const c=this.pickUniforms;e.uniformMatrix4fv(c.uViewProj,!1,this.viewProj()),this.bindWallUniforms(c),e.uniform1i(c.uPickBase,0),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,this.instanceCount);const l=Math.floor(t*n),h=Math.floor((1-a)*s),u=new Uint8Array(4);e.readPixels(l,h,1,1,e.RGBA,e.UNSIGNED_BYTE,u),e.bindFramebuffer(e.FRAMEBUFFER,null);const v=u[0]+u[1]*256+u[2]*65536;return v===0?-1:v-1}dispose(){this.stop();const t=this.gl;t.deleteBuffer(this.cornerVbo),t.deleteBuffer(this.instanceVbo),t.deleteTexture(this.paletteTex),t.deleteTexture(this.materialTex),t.deleteTexture(this.pickTex),t.deleteFramebuffer(this.pickFbo),t.deleteVertexArray(this.vao),t.deleteProgram(this.mainProgram),t.deleteProgram(this.pickProgram)}}function ft(o,t,a){const e=45*Math.PI/180,n=1/Math.tan(e/2),s=.1,c=100,l=new Float32Array(16);l[0]=n/a,l[5]=n,l[10]=(c+s)/(s-c),l[11]=-1,l[14]=2*c*s/(s-c);const h=N([o[0]-t[0],o[1]-t[1],o[2]-t[2]]),u=N(W([0,1,0],h)),v=W(h,u),f=new Float32Array(16);return f[0]=u[0],f[1]=v[0],f[2]=h[0],f[3]=0,f[4]=u[1],f[5]=v[1],f[6]=h[1],f[7]=0,f[8]=u[2],f[9]=v[2],f[10]=h[2],f[11]=0,f[12]=-C(u,o),f[13]=-C(v,o),f[14]=-C(h,o),f[15]=1,mt(l,f)}function N(o){const t=Math.hypot(o[0],o[1],o[2])||1;return[o[0]/t,o[1]/t,o[2]/t]}function W(o,t){return[o[1]*t[2]-o[2]*t[1],o[2]*t[0]-o[0]*t[2],o[0]*t[1]-o[1]*t[0]]}function C(o,t){return o[0]*t[0]+o[1]*t[1]+o[2]*t[2]}function mt(o,t){const a=new Float32Array(16);for(let e=0;e<4;e++)for(let n=0;n<4;n++)a[e*4+n]=o[n]*t[e*4]+o[4+n]*t[e*4+1]+o[8+n]*t[e*4+2]+o[12+n]*t[e*4+3];return a}const vt={class:"page"},pt={class:"page-head"},gt={class:"head-left"},Tt={class:"stage-wrap"},xt={key:0,class:"card empty-state error-box"},wt={class:"icon-card"},Et={style:{color:"var(--text)"}},bt={class:"hud"},Rt={class:"hud-item"},At={class:"hud-item"},_t={class:"hud-item"},yt={class:"card control-panel"},Ft={class:"light-group"},Pt=["onClick"],Mt={class:"label"},It={class:"check-row"},Ut=K({__name:"wall_preview",setup(o){const t=ot(),a=it(),e=t.params.id,n=w(null),s=w(0),c=w("");let l=null,h=!1,u=0,v=0,f=0,_=0,B=0;const j=[{mode:"daylight",label:"白天自然光"},{mode:"spot",label:"射灯"},{mode:"candle",label:"蜡烛"}],y=w("daylight"),F=w(!1),E=w(1);function L(){f++;const p=performance.now();p-_>=1e3&&(s.value=f,f=0,_=p),B=requestAnimationFrame(L)}function G(p){p.addEventListener("mousedown",i=>{h=!0,u=i.clientX,v=i.clientY}),window.addEventListener("mouseup",()=>h=!1),window.addEventListener("mousemove",i=>{if(!h||!l)return;const d=l.getCamera();l.setCamera({yaw:d.yaw+(i.clientX-u)*.006,pitch:Math.max(-.9,Math.min(1.1,d.pitch-(i.clientY-v)*.006))}),u=i.clientX,v=i.clientY}),p.addEventListener("wheel",i=>{if(!l)return;i.preventDefault();const d=l.getCamera();l.setCamera({distance:Math.max(1.5,Math.min(30,d.distance+i.deltaY*.004))})},{passive:!1})}function b(){l&&(l.lightMode=y.value,l.showBurn=F.value,l.intensity=E.value)}q(async()=>{await nt(e),await st();const p=g.currentProject,i=n.value;if(!(!p||!i)){if(!g.currentTiles||g.currentTiles.count===0){c.value="当前墙面还没有排块，请先到排块编辑器生成";return}try{l=new dt(i,p.wall);const d=Math.max(p.wall.width,p.wall.height);l.setCamera({distance:Math.max(4,d*1.1),yaw:0,pitch:.06}),l.uploadTiles(g.currentTiles),l.uploadMaterials(g.currentTiles,g.materials),b(),l.start(),G(i),_=performance.now(),L()}catch(d){c.value=d instanceof Error?d.message:String(d)}}}),J(()=>{cancelAnimationFrame(B),l==null||l.dispose(),l=null});const O=()=>{var p;return((p=g.currentTiles)==null?void 0:p.count)??0},Y=()=>g.currentProject?rt(g.currentProject.wall):0;return(p,i)=>(I(),P("div",vt,[r("header",pt,[r("div",gt,[r("button",{class:"btn",onClick:i[0]||(i[0]=d=>T(a).push(`/projects/${T(e)}/layout`))},[M(U,{name:"back",size:16}),i[5]||(i[5]=A("排块 ",-1))]),i[6]||(i[6]=r("div",null,[r("h1",{class:"title"},"墙面预览"),r("p",{class:"subtitle"},"实例化单 draw call 渲染 · 金箔闪光随视角移动 · 拖拽旋转，滚轮缩放")],-1))]),r("button",{class:"btn",onClick:i[1]||(i[1]=d=>T(a).push(`/projects/${T(e)}/construction`))},[i[7]||(i[7]=A(" 施工图",-1)),M(U,{name:"doc",size:16})])]),r("div",Tt,[r("canvas",{ref_key:"canvasRef",ref:n,class:"stage"},null,512),c.value?(I(),P("div",xt,[r("div",wt,[M(U,{name:"warn",size:32})]),r("div",Et,x(c.value),1),r("button",{class:"btn btn-primary",onClick:i[2]||(i[2]=d=>T(a).push(`/projects/${T(e)}/layout`))},"去生成排块")])):Q("",!0),r("div",bt,[r("div",Rt,[i[8]||(i[8]=r("span",null,"块数",-1)),r("strong",null,x(O().toLocaleString()),1)]),r("div",At,[i[9]||(i[9]=r("span",null,"面积",-1)),r("strong",null,x(Y().toFixed(1))+" ㎡",1)]),r("div",_t,[i[10]||(i[10]=r("span",null,"帧率",-1)),r("strong",{class:k({bad:s.value>0&&s.value<30})},x(s.value)+" FPS",3)])]),r("div",yt,[i[12]||(i[12]=r("h2",{class:"panel-title"},"光照场景",-1)),r("div",Ft,[(I(),P(Z,null,tt(j,d=>r("button",{key:d.mode,class:k(["btn",{active:y.value===d.mode}]),onClick:Ct=>{y.value=d.mode,b()}},x(d.label),11,Pt)),64))]),r("label",Mt,"光强（"+x(E.value.toFixed(2))+"）",1),D(r("input",{"onUpdate:modelValue":i[3]||(i[3]=d=>E.value=d),type:"range",min:"0.4",max:"2",step:"0.05",onInput:b},null,544),[[et,E.value,void 0,{number:!0}]]),r("label",It,[D(r("input",{"onUpdate:modelValue":i[4]||(i[4]=d=>F.value=d),type:"checkbox",onChange:b},null,544),[[at,F.value]]),i[11]||(i[11]=r("span",null,"死白区域报警（过曝低饱和标红）",-1))]),i[13]||(i[13]=r("div",{class:"legend"},[r("div",null,[r("i",{class:"dot gold"}),A("金箔块：高光随视角扫动")]),r("div",null,[r("i",{class:"dot red"}),A("红色覆盖：灯下死白风险")])],-1))])])]))}}),kt=lt(Ut,[["__scopeId","data-v-67b819d9"]]);export{kt as default};
