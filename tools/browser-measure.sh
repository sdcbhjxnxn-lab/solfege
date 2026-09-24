#!/usr/bin/env bash
# 程序化版式测量 + 谱面几何回归
#   1) 选项卡片宽度一致性、按钮文案
#   2) 全站 SVG「内容包围盒 vs viewBox」裁切检测（SVG 默认 overflow:hidden，越界即不可见）
#   3) 视唱谱面全组合压力测试（调性 × 拍号 × 小节数 × 难度）
#   4) 节奏听辨 / 视唱谱例：期望音符数 vs 实际渲染音符数
#   5) 五度圈文字、移动端横向溢出、运行期错误
# 输出末尾打印 PASS/FAIL 汇总，可作为回归闸门。
set -u
export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.."
mkdir -p shots
PORT=8793
node tools/serve.js $PORT > shots/measure-server.log 2>&1 &
SRV=$!
sleep 2
cleanup() { timeout 40 agent-browser close >/dev/null 2>&1 || true; kill $SRV >/dev/null 2>&1 || true; }
trap cleanup EXIT
AB="timeout 180 agent-browser"
BASE="http://localhost:$PORT/"

$AB open "$BASE" >/dev/null 2>&1
sleep 2.5
$AB eval 'window.__errs=[];window.addEventListener("error",function(e){window.__errs.push("ERR "+e.message)});window.addEventListener("unhandledrejection",function(e){window.__errs.push("REJ "+(e.reason&&e.reason.message||e.reason))});"ok"' >/dev/null 2>&1

# 注入检测器：每个 svg 的内容真实包围盒是否越出 viewBox
$AB eval '(function(){
  window.__clip=function(){
    var out=[];
    document.querySelectorAll("svg").forEach(function(svg){
      var vb=(svg.getAttribute("viewBox")||"").split(/\s+/).map(Number);
      if(vb.length!==4||!vb[2]) return;
      var minY=1e9,maxY=-1e9,minX=1e9,maxX=-1e9,n=0;
      svg.querySelectorAll("path,rect,circle,ellipse,text").forEach(function(el){
        try{var b=el.getBBox(); if(!isFinite(b.x)||b.width<0) return;
          if(b.width===0&&b.height===0) return; n++;
          minY=Math.min(minY,b.y);maxY=Math.max(maxY,b.y+b.height);
          minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+b.width);}catch(e){}
      });
      if(!n) return;
      var o={cls:(svg.parentElement&&svg.parentElement.className)||"",vb:vb,
        over:{top:Math.round((vb[1]-minY)*10)/10,bottom:Math.round((maxY-vb[3])*10)/10,
              left:Math.round((vb[0]-minX)*10)/10,right:Math.round((maxX-vb[2])*10)/10}};
      if(o.over.top>0.5||o.over.bottom>0.5||o.over.left>0.5||o.over.right>0.5) out.push(o);
    });
    return out;
  };
  window.__ov=function(){return document.documentElement.scrollWidth>window.innerWidth+1;};
  return "ok";
})()' >/dev/null 2>&1

PASS=0; FAIL=0
# agent-browser eval 的输出形如 "{\"a\":1}"（带外层引号与转义），比较前先归一化
norm() { sed -e 's/^"//' -e 's/"$//' -e 's/\\"/"/g'; }
chk() { # chk <描述> <0=通过>
  if [ "$2" = "0" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1"; fi
}
nav() { $AB eval "location.hash='#$1'" >/dev/null 2>&1; sleep 1.3; }

echo "--- 1) 练耳：旋律题选项卡片与谱面宽度 ---"
nav 'ear/melody'
$AB eval '(function(){var c=[].map.call(document.querySelectorAll("#view .opt-notation"),function(e){return Math.round(e.getBoundingClientRect().width)});var s=[].map.call(document.querySelectorAll("#view .opt-stave svg"),function(e){return Math.round(e.getBoundingClientRect().width)});return JSON.stringify({cardWidths:c,svgWidths:s})})()' 2>&1 | tail -2

echo "--- 2) 练耳：选项按钮文案 ---"
$AB eval 'JSON.stringify([].map.call(document.querySelectorAll("#view .quiz-actions .btn"),function(b){return b.textContent.trim()}))' 2>&1 | tail -2

echo "--- 3) 全站 SVG 裁切检测 ---"
for route in home ear/melody ear/interval ear/chord ear/rhythm ear/scale ear/progression ear/pitch ear/timbre sight ref/interval ref/chord ref/scale ref/progression ref/cof ref/keyboard stats settings; do
  nav "$route"
  R=$($AB eval 'JSON.stringify(window.__clip())' 2>&1 | tail -1 | norm)
  chk "[$route] 无内容越出 viewBox  $R" "$([ "$R" = '[]' ] && echo 0 || echo 1)"
done

echo "--- 4) 视唱谱面全组合压力测试（无越界 / 音符全部可见） ---"
nav 'sight'
$AB eval '(function(){
  window.__m=function(){
    var p=document.querySelector("#view .staff-panel"); var svg=p&&p.querySelector("svg");
    if(!svg) return null;
    var vb=(svg.getAttribute("viewBox")||"").split(/\s+/).map(Number);
    var minY=1e9,maxY=-1e9,minX=1e9,maxX=-1e9,n=0;
    svg.querySelectorAll("path,rect,text").forEach(function(el){try{var b=el.getBBox();
      if(!isFinite(b.x)||b.width<0)return; if(b.width===0&&b.height===0)return; n++;
      minY=Math.min(minY,b.y);maxY=Math.max(maxY,b.y+b.height);
      minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+b.width);}catch(e){}});
    var heads=svg.querySelectorAll(".vf-notehead"), vis=0;
    heads.forEach(function(h){var b=h.getBBox();
      if(b.y>=0&&b.y+b.height<=vb[3]+0.6&&b.x>=0&&b.x+b.width<=vb[2]+0.6) vis++;});
    return {n:n,heads:heads.length,vis:vis,
      overB:Math.round((maxY-vb[3])*10)/10,overT:Math.round((vb[1]-minY)*10)/10,overR:Math.round((maxX-vb[2])*10)/10};
  };
  window.__pill=function(lv,vv){var g=document.querySelectorAll("#view .ctrl-bar .ctrl-group");
    for(var i=0;i<g.length;i++){var l=g[i].querySelector(".ctrl-label");
      if(l&&l.textContent.trim()===lv){var b=g[i].querySelectorAll(".pill");
        for(var j=0;j<b.length;j++)if(b[j].textContent.trim()===vv){b[j].click();return true;}}}
    return false;};
  return "ok";
})()' >/dev/null 2>&1
S=$($AB eval '(function(){
  var bad=[],total=0,minRatio=1;
  ["C","G","F","D","Bb","A"].forEach(function(k){ window.__pill("调性",k);
    ["2/4","3/4","4/4"].forEach(function(ts){ window.__pill("拍号",ts);
      ["2","3","4"].forEach(function(bb){ window.__pill("小节数",bb);
        ["初级","中级","高级"].forEach(function(l){ window.__pill("难度",l);
          for(var r=0;r<4;r++){
            var bx=document.querySelectorAll("#view .ctrl-bar .btn")[0]; if(bx) bx.click();
            var m=window.__m(); if(!m) continue; total++;
            if(m.overB>0.6||m.overR>0.6||m.overT>0.6) bad.push(k+"/"+ts+"/"+bb+"/"+l+" "+JSON.stringify(m));
            if(m.heads) minRatio=Math.min(minRatio,m.vis/m.heads);
          }});});});});
  return JSON.stringify({total:total,clipped:bad.length,minNoteVisibleRatio:Math.round(minRatio*1000)/1000,bad:bad.slice(0,5)});
})()' 2>&1 | tail -1 | norm)
echo "  $S"
chk "视唱 648 组合无越界且音符 100% 可见" "$(echo "$S" | grep -q '"clipped":0' && echo "$S" | grep -q '"minNoteVisibleRatio":1' && echo 0 || echo 1)"

echo "--- 5) 期望音符数 vs 实际渲染音符数 ---"
$AB eval '(function(){
  var N=window.WB.Notation; window.__rec=[];
  var r1=N.renderRhythm;
  N.renderRhythm=function(c,p,o){var r=r1.call(N,c,p,o);window.__rec.push(p.length);return r;};
  var r2=N.renderStave;
  N.renderStave=function(c,s,o){var r=r2.call(N,c,s,o);if(s&&s.notes)window.__rec.push(s.notes.length);return r;};
  var r3=N.renderSystem;
  N.renderSystem=function(c,s,o){var b=(s&&s.bars)||[];var r=r3.call(N,c,s,o);
    window.__rec.push(b.reduce(function(a,x){return a+x.length;},0));return r;};
  return "hooked";
})()' >/dev/null 2>&1
nav 'ear/rhythm'
R=$($AB eval '(function(){
  var bad=0,rows=[];
  for(var it=0;it<10;it++){
    var rec=window.__rec.slice(); window.__rec=[];
    var opts=[].map.call(document.querySelectorAll("#view .opt-notation .opt-stave"),function(h){
      var svg=h.querySelector("svg"); if(!svg) return -1;
      var vb=(svg.getAttribute("viewBox")||"").split(/\s+/).map(Number);
      var heads=svg.querySelectorAll(".vf-notehead"), out=0, maxStem=0;
      heads.forEach(function(n){var b=n.getBBox(); if(b.y<30||b.y+b.height>vb[3]-2) out++;});
      svg.querySelectorAll(".vf-stem").forEach(function(s){maxStem=Math.max(maxStem,s.getBBox().height);});
      return {h:heads.length,out:out,stem:Math.round(maxStem)};
    });
    var ok = opts.length>0 && opts.every(function(o,i){return o.h===rec[i]&&o.out===0&&o.stem<=60;});
    if(!ok){bad++;rows.push("第"+(it+1)+"题 期望="+rec.join(",")+" 实际="+JSON.stringify(opts));}
    var o0=document.querySelector("#view .quiz-options .opt"); if(o0)o0.click();
    var b2=[].find.call(document.querySelectorAll("#view .btn"),function(x){return /下一题|继续/.test(x.textContent)});
    if(b2)b2.click();
  }
  return JSON.stringify({checked:10,bad:bad,rows:rows.slice(0,3)});
})()' 2>&1 | tail -1 | norm)
echo "  $R"
chk "节奏听辨 10 题：音符数一致、无越界、符干长度正常" "$(echo "$R" | grep -q '"bad":0' && echo 0 || echo 1)"

nav 'sight'
R2=$($AB eval '(function(){
  var bad=[],rows=[];
  for(var i=0;i<6;i++){
    var b=document.querySelectorAll("#view .ctrl-bar .btn")[0]; if(b)b.click();
    var exp=window.__rec.pop();
    var svg=document.querySelector("#view .staff-panel svg");
    var vb=(svg.getAttribute("viewBox")||"").split(/\s+/).map(Number);
    var heads=svg.querySelectorAll(".vf-notehead"), out=0;
    heads.forEach(function(n){var b2=n.getBBox();
      if(b2.y<0||b2.y+b2.height>vb[3]+0.5||b2.x+b2.width>vb[2]+0.5) out++;});
    if(heads.length!==exp||out) bad.push("第"+(i+1)+"条 期望="+exp+" 实际="+heads.length+" 越界="+out);
    rows.push("第"+(i+1)+"条 期望="+exp+" 实际="+heads.length+" 越界="+out);
  }
  return JSON.stringify({bad:bad.length,rows:rows});
})()' 2>&1 | tail -1 | norm)
echo "  $R2"
chk "视唱谱例 6 条：音符数一致且无越界" "$(echo "$R2" | grep -q '"bad":0' && echo 0 || echo 1)"

echo "--- 5b) 视唱谱例：每小节总时值是否等于拍号拍数 ---"
nav 'sight'
$AB eval '(function(){
  var N=window.WB.Notation; window.__bars=[];
  var r3=N.renderSystem;
  N.renderSystem=function(c,s,o){ if(s&&s.bars) window.__bars.push({timeSig:s.timeSig,bars:s.bars});
    return r3.call(N,c,s,o); };
  return "hooked";
})()' >/dev/null 2>&1
B=$($AB eval '(function(){
  var bad=[],total=0,seen={};
  function pill(lv,vv){var g=document.querySelectorAll("#view .ctrl-bar .ctrl-group");
    for(var i=0;i<g.length;i++){var l=g[i].querySelector(".ctrl-label");
      if(l&&l.textContent.trim()===lv){var b=g[i].querySelectorAll(".pill");
        for(var j=0;j<b.length;j++)if(b[j].textContent.trim()===vv){b[j].click();return true;}}}
    return false;}
  ["2/4","3/4","4/4"].forEach(function(ts){ pill("拍号",ts);
    ["初级","中级","高级"].forEach(function(l){ pill("难度",l);
      for(var r=0;r<10;r++){
        var bx=document.querySelectorAll("#view .ctrl-bar .btn")[0]; if(bx) bx.click();
        var rec=window.__bars.pop(); if(!rec) continue;
        var per=parseInt(rec.timeSig.split("/")[0],10); total++;
        rec.bars.forEach(function(bar,k){
          var sum=bar.reduce(function(a,n){return a+(typeof n.beats==="number"?n.beats:NaN);},0);
          if(!isFinite(sum)||Math.abs(sum-per)>1e-6) bad.push(rec.timeSig+" bar"+(k+1)+"="+sum);
        });
        seen[rec.timeSig+"/"+l]=(seen[rec.timeSig+"/"+l]||0)+1;
      }});});
  return JSON.stringify({melodies:total,underOrOverFilled:bad.length,bad:bad.slice(0,6)});
})()' 2>&1 | tail -1 | norm)
echo "  $B"
chk "视唱谱例小节时值全部吻合拍号" "$(echo "$B" | grep -q '"underOrOverFilled":0' && echo 0 || echo 1)"

echo "--- 6) 五度圈文字是否落于扇区内 ---"
nav 'ref/cof'
$AB eval '(function(){var txt=[].map.call(document.querySelectorAll(".cof-minor"),function(t){return {t:t.textContent,w:Math.round(t.getBBox().width)}});return JSON.stringify({minors:txt.length,majors:document.querySelectorAll(".cof-major").length,sectors:document.querySelectorAll(".cof-sector").length})})()' 2>&1 | tail -2

echo "--- 7) 移动端 420 宽横向溢出 ---"
$AB set viewport 420 900 >/dev/null 2>&1; sleep 0.8
for route in home ear/melody ear/rhythm sight ref/cof ref/keyboard stats settings; do
  nav "$route"
  O=$($AB eval 'window.__ov()' 2>&1 | tail -1 | norm)
  chk "[420 $route] 页面无横向溢出" "$([ "$O" = "false" ] && echo 0 || echo 1)"
done
$AB set viewport 1440 900 >/dev/null 2>&1

echo "--- 8) 运行期错误 ---"
E=$($AB eval 'JSON.stringify(window.__errs||[])' 2>&1 | tail -1 | norm)
echo "  $E"
chk "无运行期错误" "$([ "$E" = '[]' ] && echo 0 || echo 1)"

echo ""
echo "================================"
echo "通过：$PASS    失败：$FAIL"
[ "$FAIL" = "0" ] && echo "全部通过 ✓" || echo "存在失败项 ✗"
exit $FAIL
