import{J,d as Q,f as Z,L as tt,c as I,g as z,h as et,a as d,F as ot,b as nt,s as M,n as j,q as S,l as Y,t as D,C as at,u as st,m as P,M as O,o as k,_,p as rt,B as it,P as H}from"./index-BE8VxwTF.js";import{_ as lt}from"./page_header.vue_vue_type_script_setup_true_lang-Q4BiFTia.js";function ct(s,o,e){const t=s[0]-o[0],a=s[1]-o[1],i=s[2]-o[2];let n=Math.hypot(t,a,i)||1;const c=t/n,l=a/n,u=i/n;let f=e[1]*u-e[2]*l,v=e[2]*c-e[0]*u,m=e[0]*l-e[1]*c;n=Math.hypot(f,v,m)||1,f/=n,v/=n,m/=n;const y=l*m-u*v,h=u*f-c*m,L=c*v-l*f;return new Float32Array([f,y,c,0,v,h,l,0,m,L,u,0,-(f*s[0]+v*s[1]+m*s[2]),-(y*s[0]+h*s[1]+L*s[2]),-(c*s[0]+l*s[1]+u*s[2]),1])}function ut(s){const o={state:{yaw:0,pitch:.12,distance:s,target:[0,0,0],autoRotate:!1},view:new Float32Array(16),position:[0,0,s],update(){const{yaw:e,pitch:t,distance:a,target:i}=this.state,n=Math.cos(t);this.position=[i[0]+a*Math.sin(e)*n,i[1]+a*Math.sin(t),i[2]+a*Math.cos(e)*n],this.view=ct(this.position,i,[0,1,0])},rotate(e,t){this.state.yaw-=e*.006,this.state.pitch=Math.max(-1.2,Math.min(1.2,this.state.pitch+t*.006)),this.update()},zoom(e){this.state.distance=Math.max(.4,Math.min(60,this.state.distance*(1+e*.0012))),this.update()}};return o.update(),o}function $(s,o,e,t){const a=1/Math.tan(s/2),i=1/(e-t);return new Float32Array([a/o,0,0,0,0,a,0,0,0,0,(t+e)*i,-1,0,0,2*t*e*i,0])}function q(s,o){const e=new Float32Array(16);for(let t=0;t<4;t++)for(let a=0;a<4;a++)e[t*4+a]=s[a]*o[t*4]+s[4+a]*o[t*4+1]+s[8+a]*o[t*4+2]+s[12+a]*o[t*4+3];return e}function ft(s,o){return o<=1e-6?Number.POSITIVE_INFINITY:s*s/(8*o)+o/2}function ht(s,o){return Number.isFinite(o)?s/o:0}function vt(s,o,e){if(s.kind==="plane"){if(Math.abs(e.z)<1e-8)return null;const A=-o.z/e.z;if(A<0)return null;const R=o.x+e.x*A,V=o.y+e.y*A,C=(R+s.width/2)/s.width,b=(V+s.height/2)/s.height;return C>=0&&C<=1&&b>=0&&b<=1?{u:C,v:b}:null}const t=ft(s.width,s.curvature),a=ht(s.width,t);if(s.kind==="curved"){const A=e.x*e.x+e.z*e.z,R=2*(o.x*e.x+o.z*e.z),V=o.x*o.x+o.z*o.z-t*t,C=R*R-4*A*V;if(C<0)return null;const b=(-R-Math.sqrt(C))/(2*A);if(b<0)return null;const p=o.x+e.x*b,r=o.z+e.z*b,w=o.y+e.y*b,E=Math.atan2(p,r);if(Math.abs(E)>a/2+1e-4)return null;const N=(w+s.height/2)/s.height;return N<0||N>1?null:{u:E/a+.5,v:N}}const i=-t*Math.cos(a/2),n=-t/2,c=o.x,l=o.y-n,u=o.z-i,f=e.x*e.x+e.y*e.y+e.z*e.z,v=2*(c*e.x+l*e.y+u*e.z),m=c*c+l*l+u*u-t*t,y=v*v-4*f*m;if(y<0)return null;const h=(-v-Math.sqrt(y))/(2*f);if(h<0)return null;const L=c+e.x*h,B=l+e.y*h,F=u+e.z*h,x=Math.asin(Math.max(-1,Math.min(1,B/t)));if(x<-1e-4||x>Math.PI/2+1e-4)return null;const g=Math.atan2(L,F);if(Math.abs(g)>a/2+1e-4)return null;const T=x/(Math.PI/2);return{u:g/a+.5,v:Math.max(0,Math.min(1,T))}}const dt=`#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iRect;       // x y w h（米）
layout(location=2) in float iAngle;
layout(location=3) in vec4 iColor;     // sRGB 0~1 + 金箔标记
layout(location=4) in vec3 iSurface;   // opacity / roughness / reflectivity
uniform vec2 uWall;
uniform int uKind;
uniform float uCurvature;
uniform mat4 uViewProj;
out vec3 vNormal;
out vec3 vWorldPos;
out vec4 vColor;
out vec3 vSurface;

float arcRadius(float W, float c) {
  if (c < 1e-6) return 99999.0;
  return (W * W) / (8.0 * c) + c * 0.5;
}

vec3 wallPoint(vec2 uv) {
  float W = uWall.x;
  float H = uWall.y;
  float y = uv.y * H - H * 0.5;
  if (uKind == 0) return vec3(uv.x * W - W * 0.5, y, 0.0);
  float R = arcRadius(W, uCurvature);
  float theta = W / R;
  float phi = theta * (uv.x - 0.5);
  if (uKind == 1) {
    return vec3(R * sin(phi), y, R * cos(phi) - R * cos(theta * 0.5));
  }
  float alpha = uv.y * 1.5707963;
  float rho = R * cos(alpha);
  return vec3(rho * sin(phi), R * sin(alpha) - R * 0.5,
    rho * cos(phi) - R * cos(theta * 0.5));
}

vec3 wallNormal(vec2 uv) {
  if (uKind == 0) return vec3(0.0, 0.0, 1.0);
  float R = arcRadius(uWall.x, uCurvature);
  float theta = uWall.x / R;
  float phi = theta * (uv.x - 0.5);
  if (uKind == 1) return vec3(sin(phi), 0.0, cos(phi));
  float alpha = uv.y * 1.5707963;
  return vec3(sin(phi) * cos(alpha), sin(alpha), cos(phi) * cos(alpha));
}

void main() {
  vec2 uv = iRect.xy / uWall;
  vec2 halfUv = (iRect.zw * 0.5) / uWall;
  vec2 corner = aCorner * halfUv;
  float c = cos(iAngle);
  float s = sin(iAngle);
  vec2 rot = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  vec2 tileUv = clamp(uv + rot, vec2(1e-5), vec2(1.0 - 1e-5));
  vec3 pos = wallPoint(tileUv);
  vec3 baseN = wallNormal(tileUv);
  float eps = 0.0008;
  vec3 tU = normalize(wallPoint(clamp(tileUv + vec2(eps, 0.0), vec2(0.0), vec2(1.0)))
    - wallPoint(clamp(tileUv - vec2(eps, 0.0), vec2(0.0), vec2(1.0))));
  vec3 tV = normalize(cross(baseN, tU));
  // 块倾斜角转化为微表面法线扰动
  vec3 n = normalize(baseN + (tU * sin(iAngle) + tV * (1.0 - cos(iAngle))) * 0.55);
  vNormal = n;
  vWorldPos = pos + n * 0.0025;
  vColor = iColor;
  vSurface = iSurface;
  gl_Position = uViewProj * vec4(vWorldPos, 1.0);
}
`,mt=`#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
in vec4 vColor;
in vec3 vSurface;
uniform vec3 uViewPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform float uIntensity;
uniform float uBlowout;
uniform int uShowBlowout;
uniform float uTime;
out vec4 outColor;

float srgbToLinear(float x) {
  return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4);
}

void main() {
  float isGold = vColor.a;
  vec3 baseColor = vec3(srgbToLinear(vColor.r), srgbToLinear(vColor.g), srgbToLinear(vColor.b));
  float opacity = vSurface.x;
  float roughness = vSurface.y;
  float reflectivity = vSurface.z;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uViewPos - vWorldPos);
  vec3 L = normalize(-uLightDir);
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float shininess = mix(220.0, 12.0, roughness);
  float spec = pow(ndh, shininess);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 diffuse = baseColor * (uAmbient * (0.6 + opacity * 0.4) + ndl * uIntensity * 0.8);
  vec3 specular = uLightColor * spec * fresnel * reflectivity * uIntensity;
  vec3 color = diffuse + specular;
  // 金箔：视角相关闪烁，相机移动时闪光跟着流动
  if (isGold > 0.5) {
    float cell = fract(sin(dot(floor(vWorldPos.xz * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.2 + cell * 40.0 + vWorldPos.x * 14.0);
    float glint = pow(ndh, 320.0) * (0.35 + 0.65 * twinkle) * 1.7;
    color += uLightColor * glint * reflectivity;
  }
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  if (uShowBlowout == 1 && lum > uBlowout) {
    color = mix(color, vec3(1.0, 0.16, 0.16), 0.82);
  }
  // ACES 近似 + gamma
  color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, opacity);
}
`;function G(s,o,e){const t=s.createShader(o);if(s.shaderSource(t,e),s.compileShader(t),!s.getShaderParameter(t,s.COMPILE_STATUS))throw new Error(s.getShaderInfoLog(t)??"shader compile error");return t}const U=12,W=U*4;class pt{gl;program;vao;quadBuffer;instanceBuffer;uniformLocs={};instanceCount=0;canvas;wall;showBlowout=!1;time=0;constructor(o,e){this.canvas=o,this.wall=e;const t=o.getContext("webgl2",{antialias:!0,alpha:!1});if(!t)throw new Error("当前浏览器不支持 WebGL2");this.gl=t;const a=G(t,t.VERTEX_SHADER,dt),i=G(t,t.FRAGMENT_SHADER,mt),n=t.createProgram();if(t.attachShader(n,a),t.attachShader(n,i),t.linkProgram(n),!t.getProgramParameter(n,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(n)??"program link error");this.program=n,this.vao=t.createVertexArray(),t.bindVertexArray(this.vao),this.quadBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),this.instanceBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.instanceBuffer),t.enableVertexAttribArray(1),t.vertexAttribPointer(1,4,t.FLOAT,!1,W,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,1,t.FLOAT,!1,W,16),t.vertexAttribDivisor(2,1),t.enableVertexAttribArray(3),t.vertexAttribPointer(3,4,t.FLOAT,!1,W,20),t.vertexAttribDivisor(3,1),t.enableVertexAttribArray(4),t.vertexAttribPointer(4,3,t.FLOAT,!1,W,36),t.vertexAttribDivisor(4,1),t.bindVertexArray(null);for(const c of["uWall","uKind","uCurvature","uViewProj","uViewPos","uLightDir","uLightColor","uAmbient","uIntensity","uBlowout","uShowBlowout","uTime"])this.uniformLocs[c]=t.getUniformLocation(n,c);t.clearColor(.07,.08,.1,1),t.enable(t.DEPTH_TEST)}setData(o){const e=this.gl,t=new DataView(o.buffer),a=new Map(o.materials.map(c=>[c.id,c])),i={kind:"stone",rgb:[200,200,195],opacity:1,roughness:.8,reflectivity:.1},n=new Float32Array(o.count*U);for(let c=0;c<o.count;c++){const l=J(t,c),u=a.get(o.materialTable[String(l.materialIndex)])??i,f=c*U;n[f]=l.x,n[f+1]=l.y,n[f+2]=l.w,n[f+3]=l.h,n[f+4]=l.angle,n[f+5]=u.rgb[0]/255,n[f+6]=u.rgb[1]/255,n[f+7]=u.rgb[2]/255,n[f+8]=u.kind==="gold"?1:0,n[f+9]=u.opacity,n[f+10]=u.roughness,n[f+11]=u.reflectivity}e.bindVertexArray(this.vao),e.bindBuffer(e.ARRAY_BUFFER,this.instanceBuffer),e.bufferData(e.ARRAY_BUFFER,n.byteLength,e.DYNAMIC_DRAW),e.bufferSubData(e.ARRAY_BUFFER,0,n),this.instanceCount=o.count,e.bindVertexArray(null)}render(o,e,t){const a=this.gl;this.time+=t;const i=Math.min(2,window.devicePixelRatio||1),n=Math.floor(this.canvas.clientWidth*i),c=Math.floor(this.canvas.clientHeight*i);if((this.canvas.width!==n||this.canvas.height!==c)&&(this.canvas.width=n,this.canvas.height=c),a.viewport(0,0,this.canvas.width,this.canvas.height),a.clear(a.COLOR_BUFFER_BIT|a.DEPTH_BUFFER_BIT),this.instanceCount===0)return;const l=$(Math.PI/4,this.canvas.width/this.canvas.height,.05,200),u=q(l,o.view);a.useProgram(this.program),a.uniform2f(this.uniformLocs.uWall,this.wall.width,this.wall.height),a.uniform1i(this.uniformLocs.uKind,this.wall.kind==="plane"?0:this.wall.kind==="curved"?1:2),a.uniform1f(this.uniformLocs.uCurvature,this.wall.curvature),a.uniformMatrix4fv(this.uniformLocs.uViewProj,!1,u),a.uniform3fv(this.uniformLocs.uViewPos,o.position),a.uniform3fv(this.uniformLocs.uLightDir,e.lightDir),a.uniform3fv(this.uniformLocs.uLightColor,e.lightColor),a.uniform1f(this.uniformLocs.uAmbient,e.ambient),a.uniform1f(this.uniformLocs.uIntensity,e.intensity),a.uniform1f(this.uniformLocs.uBlowout,e.blowoutThreshold),a.uniform1i(this.uniformLocs.uShowBlowout,this.showBlowout?1:0),a.uniform1f(this.uniformLocs.uTime,this.time),a.bindVertexArray(this.vao),a.drawArraysInstanced(a.TRIANGLE_STRIP,0,4,this.instanceCount),a.bindVertexArray(null)}pick(o,e,t){const a=this.canvas.getBoundingClientRect(),i=(o-a.left)/a.width*2-1,n=1-(e-a.top)/a.height*2,c=$(Math.PI/4,a.width/a.height,.05,200),l=wt(q(c,t.view));if(!l)return null;const u=K(l,[i,n,-1]),f=K(l,[i,n,1]),v={x:f[0]-u[0],y:f[1]-u[1],z:f[2]-u[2]},m=Math.hypot(v.x,v.y,v.z)||1;return vt(this.wall,{x:u[0],y:u[1],z:u[2]},{x:v.x/m,y:v.y/m,z:v.z/m})}dispose(){const o=this.gl;o.deleteProgram(this.program),o.deleteBuffer(this.quadBuffer),o.deleteBuffer(this.instanceBuffer),o.deleteVertexArray(this.vao)}}function wt(s){const o=new Float32Array(16),e=[...s];for(let t=0;t<4;t++)o[t*4+t]=1;for(let t=0;t<4;t++){let a=t;for(let n=t+1;n<4;n++)Math.abs(e[n*4+t])>Math.abs(e[a*4+t])&&(a=n);if(Math.abs(e[a*4+t])<1e-8)return null;for(let n=0;n<4;n++){const c=o[t*4+n];o[t*4+n]=o[a*4+n],o[a*4+n]=c;const l=e[t*4+n];e[t*4+n]=e[a*4+n],e[a*4+n]=l}const i=e[t*4+t];for(let n=0;n<4;n++)o[t*4+n]/=i,e[t*4+n]/=i;for(let n=0;n<4;n++){if(n===t)continue;const c=e[n*4+t];for(let l=0;l<4;l++)o[n*4+l]-=c*o[t*4+l],e[n*4+l]-=c*e[t*4+l]}}return o}function K(s,o){const e=s[0]*o[0]+s[4]*o[1]+s[8]*o[2]+s[12],t=s[1]*o[0]+s[5]*o[1]+s[9]*o[2]+s[13],a=s[2]*o[0]+s[6]*o[1]+s[10]*o[2]+s[14],i=s[3]*o[0]+s[7]*o[1]+s[11]*o[2]+s[15];return[e/i,t/i,a/i]}const X={daylight:{mode:"daylight",label:"白天自然光",lightDir:[-.45,.55,.7],lightColor:[1,.97,.9],ambient:.55,intensity:1.05,blowoutThreshold:.92},spot:{mode:"spot",label:"射灯",lightDir:[.15,.35,.92],lightColor:[1,.94,.82],ambient:.18,intensity:1.7,blowoutThreshold:.88},candle:{mode:"candle",label:"烛光",lightDir:[-.1,-.25,.96],lightColor:[1,.66,.32],ambient:.08,intensity:1.25,blowoutThreshold:.95}},yt={class:"h-full flex flex-col"},bt={class:"text-sm muted mr-2"},xt={class:"flex-1 min-h-0 flex"},gt={class:"w-64 shrink-0 border-r p-4 flex flex-col gap-4 overflow-auto",style:{"border-color":"var(--c-border)"}},At={class:"card p-4"},Rt={class:"flex flex-col gap-2"},Ct=["onClick"],Lt={class:"card p-4 flex flex-col gap-2"},zt={class:"flex-1 min-w-0 relative",style:{background:"#12141a"}},Mt={key:0,class:"absolute inset-0 flex items-center justify-center"},Pt={class:"card p-6 text-center"},Bt={key:1,class:"absolute inset-0 flex items-center justify-center"},Tt={style:{color:"#f87171"}},Ft=Q({__name:"wall_preview_page",setup(s){const o=at(),e=st(),t=o.params.id,a=P(null),i=O(null),n=O(null),c=P("spot"),l=P(!1),u=P(!1),f=P(0),v=P(0),m=P("");let y=null,h=null,L=0,B=0,F=0,x=0,g=!1,T={x:0,y:0};async function A(){if(i.value=await rt.get(t)??null,!i.value||!a.value)return;const p=await it.list();i.value.currentVersionId&&(n.value=await H.get(i.value.currentVersionId)??null);try{y=new pt(a.value,i.value.wall);const r=Math.max(i.value.wall.width,i.value.wall.height)*1.6;if(h=ut(r),y.showBlowout=l.value,n.value){const w=await H.loadBuffer(n.value.id);if(w){const E={buffer:w,count:n.value.stats.count,materials:p,materialTable:n.value.materialTable};y.setData(E),v.value=n.value.stats.count}}V(),B=performance.now(),R(B)}catch(r){m.value=r instanceof Error?r.message:String(r)}}function R(p){const r=Math.min(.05,(p-B)/1e3);B=p,h&&y&&(u.value&&!g&&(h.state.yaw+=r*.25,h.update()),y.render(h,X[c.value],r)),F++,x+=r,x>=1&&(f.value=Math.round(F/x),F=0,x=0),L=requestAnimationFrame(R)}function V(){const p=a.value;p.addEventListener("pointerdown",r=>{g=!0,T={x:r.clientX,y:r.clientY},p.setPointerCapture(r.pointerId)}),p.addEventListener("pointermove",r=>{!g||!h||(h.rotate(r.clientX-T.x,r.clientY-T.y),T={x:r.clientX,y:r.clientY})}),p.addEventListener("pointerup",()=>g=!1),p.addEventListener("pointercancel",()=>g=!1),p.addEventListener("wheel",r=>{r.preventDefault(),h?.zoom(r.deltaY)},{passive:!1})}function C(){l.value=!l.value,y&&(y.showBlowout=l.value)}function b(){if(!h||!i.value)return;const p=Math.max(i.value.wall.width,i.value.wall.height)*1.6;h.state.yaw=0,h.state.pitch=.12,h.state.distance=p,h.update()}return Z(A),tt(()=>{cancelAnimationFrame(L),y?.dispose()}),(p,r)=>(k(),I("div",yt,[z(lt,{title:i.value?.name??"墙面预览",subtitle:"真实光照渲染：块倾角反射、金箔闪烁随视角流动"},{default:et(()=>[d("span",bt,D(v.value.toLocaleString())+" 块 · "+D(f.value)+" FPS",1),d("button",{class:"btn",onClick:r[0]||(r[0]=w=>M(e).push(`/projects/${M(t)}/tiles`))},[z(_,{name:"grid",size:15}),r[4]||(r[4]=S(" 排块编辑",-1))]),d("button",{class:"btn",onClick:r[1]||(r[1]=w=>M(e).push(`/projects/${M(t)}/drawing`))},[z(_,{name:"print",size:15}),r[5]||(r[5]=S(" 施工图",-1))])]),_:1},8,["title"]),d("div",xt,[d("aside",gt,[d("section",At,[r[6]||(r[6]=d("h3",{class:"font-semibold mb-3"},"光源环境",-1)),d("div",Rt,[(k(!0),I(ot,null,nt(Object.values(M(X)),w=>(k(),I("button",{key:w.mode,class:j(["btn justify-start",c.value===w.mode?"btn-primary":""]),onClick:E=>c.value=w.mode},[z(_,{name:w.mode==="daylight"?"sun":w.mode==="candle"?"candle":"spot",size:16},null,8,["name"]),S(" "+D(w.label),1)],10,Ct))),128))])]),d("section",Lt,[r[10]||(r[10]=d("h3",{class:"font-semibold mb-1"},"检视工具",-1)),d("button",{class:j(["btn justify-start",l.value?"btn-primary":""]),onClick:C},[z(_,{name:"alert",size:16}),r[7]||(r[7]=S(" 死白区域预警 ",-1))],2),d("button",{class:j(["btn justify-start",u.value?"btn-primary":""]),onClick:r[2]||(r[2]=w=>u.value=!u.value)},[z(_,{name:"play",size:16}),r[8]||(r[8]=S(" 自动旋转（模拟人走过） ",-1))],2),d("button",{class:"btn justify-start",onClick:b},[z(_,{name:"reset",size:16}),r[9]||(r[9]=S(" 重置视角",-1))]),r[11]||(r[11]=d("p",{class:"text-xs muted mt-1"},"红色覆盖区域为当前光源下亮度超过阈值的连片死白，需调整块倾角或更换低反光材料",-1))])]),d("div",zt,[d("canvas",{ref_key:"canvasRef",ref:a,class:"w-full h-full block touch-none"},null,512),n.value?Y("",!0):(k(),I("div",Mt,[d("div",Pt,[r[12]||(r[12]=d("p",{class:"mb-3"},"当前墙面还没有排块版本",-1)),d("button",{class:"btn btn-primary",onClick:r[3]||(r[3]=w=>M(e).push(`/projects/${M(t)}/tiles`))},"去生成排块")])])),m.value?(k(),I("div",Bt,[d("p",Tt,D(m.value),1)])):Y("",!0)])])]))}});export{Ft as default};
