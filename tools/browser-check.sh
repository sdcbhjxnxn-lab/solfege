#!/usr/bin/env bash
# 真实浏览器验证：启动本地服务 → 逐视图检查 → 截图 → 关闭
set -u
export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.."
mkdir -p shots
PORT=8791

node tools/serve.js $PORT > shots/server.log 2>&1 &
SRV=$!
sleep 2

cleanup() {
  timeout 40 agent-browser close >/dev/null 2>&1 || true
  kill $SRV >/dev/null 2>&1 || true
}
trap cleanup EXIT

AB="timeout 90 agent-browser"
BASE="http://localhost:$PORT/"

PROBE='(function(){var WB=window.WB||{};var h=document.querySelector("#view");return JSON.stringify({hash:location.hash,wb:!!WB.App,vex:!!(WB.Notation&&WB.Notation.available()),errPanel:!!document.querySelector("#view .err"),len:h?h.innerHTML.length:0,svg:document.querySelectorAll("svg").length,staves:document.querySelectorAll(".vf-stave").length,noteheads:document.querySelectorAll(".vf-notehead").length,opts:document.querySelectorAll("#view .opt").length,paper:document.querySelector(".staff-panel")?getComputedStyle(document.querySelector(".staff-panel")).backgroundColor:null,bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color,errs:(window.__errs||[]).slice(0,6)})})()'

probe() { $AB eval "$PROBE" 2>&1 | tail -2; }
nav() { $AB eval "location.hash='$1'" >/dev/null 2>&1; sleep 1.2; }

echo "### 打开首页"
$AB open "$BASE" >/dev/null 2>&1
sleep 2.5
$AB eval 'window.__errs=[];window.addEventListener("error",function(e){window.__errs.push("ERR "+e.message)});window.addEventListener("unhandledrejection",function(e){window.__errs.push("REJ "+(e.reason&&e.reason.message||e.reason))});"hooked"' >/dev/null 2>&1
echo "-- 首页 --"; probe
$AB screenshot shots/01-home.png >/dev/null 2>&1

echo "### 练耳：音程"
nav '#ear/interval'; echo "-- interval --"; probe
$AB screenshot shots/02-interval.png >/dev/null 2>&1

echo "### 练耳：和弦"
nav '#ear/chord'; echo "-- chord --"; probe
$AB screenshot shots/03-chord.png >/dev/null 2>&1

echo "### 练耳：旋律（五线谱选项）"
nav '#ear/melody'; echo "-- melody --"; probe
$AB screenshot shots/04-melody.png >/dev/null 2>&1

echo "### 练耳：节奏（五线谱选项）"
nav '#ear/rhythm'; echo "-- rhythm --"; probe
$AB screenshot shots/05-rhythm.png >/dev/null 2>&1

echo "### 练耳：和声进行"
nav '#ear/progression'; echo "-- progression --"; probe

echo "### 视唱"
nav '#sight'; echo "-- sight --"; probe
$AB screenshot shots/06-sight.png >/dev/null 2>&1

echo "### 乐理：音程表"
nav '#ref/interval'; echo "-- ref interval --"; probe
$AB screenshot shots/07-ref-interval.png >/dev/null 2>&1

echo "### 乐理：五度圈"
nav '#ref/cof'; echo "-- ref cof --"; probe
$AB screenshot shots/08-ref-cof.png >/dev/null 2>&1

echo "### 乐理：键盘"
nav '#ref/keyboard'; echo "-- ref keyboard --"; probe
$AB screenshot shots/09-ref-keyboard.png >/dev/null 2>&1

echo "### 统计"
nav '#stats'; echo "-- stats --"; probe
$AB screenshot shots/10-stats.png >/dev/null 2>&1

echo "### 设置"
nav '#settings'; echo "-- settings --"; probe
$AB screenshot shots/11-settings.png >/dev/null 2>&1

echo "### 交互：练习题作答 + 结算"
nav '#ear/single'
$AB eval 'var o=document.querySelectorAll("#view .opt"); if(o.length) o[0].click(); "clicked"' >/dev/null 2>&1
sleep 0.6
$AB eval 'JSON.stringify({feedback:!!document.querySelector("#view .quiz-feedback.ok, #view .quiz-feedback.bad"), correctMarked:!!document.querySelector("#view .opt-correct"), fbText:(document.querySelector("#view .fb-detail")||{}).textContent||""})' 2>&1 | tail -2
$AB screenshot shots/12-answered.png >/dev/null 2>&1

echo "### 主题切换（浅色）"
$AB eval 'WB.Store.saveSettings({theme:"light"}); WB.App.setTheme("light"); "ok"' >/dev/null 2>&1
nav '#ear/interval'; echo "-- light theme --"; probe
$AB screenshot shots/13-light.png >/dev/null 2>&1

echo "### 移动端视图（420x900）"
$AB set viewport 420 900 >/dev/null 2>&1
sleep 0.8
nav '#home'
$AB screenshot shots/14-mobile-home.png >/dev/null 2>&1
nav '#ear/interval'
$AB screenshot shots/15-mobile-interval.png >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null 2>&1

echo "### 运行期错误汇总"
$AB eval 'JSON.stringify(window.__errs||[])' 2>&1 | tail -2

echo "### 截图清单"
ls -la shots/*.png | awk '{print $5, $9}'
