(function () {
  const plan = window.FIN_ENGLISH_PLAN;
  const storageKey = "finenglish84-state-v1";
  const todayISO = new Date().toISOString().slice(0, 10);
  const defaultState = { startDate: todayISO, rate: 0.85, completed: {}, view: "today", selectedDay: null };
  let state = loadState();
  let installPrompt = null;
  const phraseAudio = new Audio();
  phraseAudio.preload = "none";

  const app = document.getElementById("app");
  const dialog = document.getElementById("settingsDialog");

  function loadState() {
    try { return { ...defaultState, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
    catch { return { ...defaultState }; }
  }

  function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }

  function courseDay() {
    if (state.selectedDay !== null) return Math.max(0, Math.min(83, state.selectedDay));
    const start = new Date(`${state.startDate}T00:00:00`);
    const now = new Date();
    const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 86400000);
    return Math.max(0, Math.min(83, diff));
  }

  function dayInfo(index = courseDay()) {
    const weekIndex = Math.floor(index / 7);
    const dayIndex = index % 7;
    const week = plan[weekIndex];
    return { index, weekIndex, dayIndex, week, tasks: window.buildWeekDays(week, weekIndex)[dayIndex] };
  }

  function completedCount() { return Object.values(state.completed).filter(Boolean).length; }
  function dayDone(index) { return [0,1,2,3].every(taskIndex => state.completed[`${index}-${taskIndex}`]); }
  function streak() {
    let count = 0;
    for (let index = courseDay(); index >= 0; index -= 1) {
      if (dayDone(index)) count += 1;
      else if (index !== courseDay()) break;
    }
    return count;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function speakWithSystem(text) {
    if (!("speechSynthesis" in window)) return toast("当前浏览器暂不支持发音，请用系统浏览器打开");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = Number(state.rate);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => voice.lang === "en-US") || voices.find(voice => voice.lang.startsWith("en")) || null;
    window.speechSynthesis.speak(utterance);
  }

  function speak(text) {
    phraseAudio.pause();
    phraseAudio.currentTime = 0;
    phraseAudio.playbackRate = Number(state.rate);
    const audioSlug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    phraseAudio.src = `./${audioSlug}.mp3`;
    toast(`正在播放：${text}`);
    const playback = phraseAudio.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
        toast("内置音频暂不可用，已切换系统发音");
        speakWithSystem(text);
      });
    }
  }

  function toast(message) {
    let node = document.querySelector(".toast");
    if (!node) { node = document.createElement("div"); node.className = "toast"; node.setAttribute("role", "status"); node.setAttribute("aria-live", "polite"); document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 1800);
  }

  function setView(view) {
    state.view = view;
    if (view !== "today") state.selectedDay = null;
    saveState();
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderToday() {
    const info = dayInfo();
    const tasksDone = info.tasks.filter((_, taskIndex) => state.completed[`${info.index}-${taskIndex}`]).length;
    const percentage = Math.round(tasksDone / info.tasks.length * 100);
    const phraseCards = info.week.phrases.map(([english, chinese]) => `
      <article class="phrase-mini"><p class="phrase-en">${escapeHTML(english)}</p><span class="phrase-cn"><b>中文释义：</b>${escapeHTML(chinese)}</span><br><button type="button" class="speak-button" data-speak="${escapeHTML(english)}">🔊 播放发音</button></article>`).join("");
    const tasks = info.tasks.map((task, taskIndex) => {
      const key = `${info.index}-${taskIndex}`;
      const checked = Boolean(state.completed[key]);
      return `<label class="task-card ${checked ? "done" : ""}"><input class="check" type="checkbox" data-task="${key}" ${checked ? "checked" : ""}><span><span class="task-title">${escapeHTML(task[0])}</span><span class="task-meta">${escapeHTML(task[1])}</span></span><span class="tag">${escapeHTML(task[2])}</span></label>`;
    }).join("");
    const listeningContent = info.week.localAudio ? `
      <audio class="lesson-audio" controls preload="metadata" src="${info.week.localAudio}">当前浏览器不支持音频播放。</audio>
      <details class="transcript-card"><summary>查看核对文本 <span>听完第1遍再打开</span></summary><div class="transcript-lines">${info.week.transcript.map(([speaker, line, translation], lineIndex) => `<article class="transcript-line"><p><b>${escapeHTML(speaker)}:</b> ${escapeHTML(line)}</p><button type="button" class="translation-toggle" data-translation="translation-${lineIndex}" aria-expanded="false">显示翻译</button><p class="translation-text" id="translation-${lineIndex}" hidden>${escapeHTML(translation)}</p></article>`).join("")}</div></details>
      <a class="source-link" href="${info.week.main[1]}" target="_blank" rel="noreferrer">备用：打开原课程页面 ↗</a>` : `
      <p>第一遍听大意，第二遍核对文本，第三遍逐句跟读。</p><a class="link-button" href="${info.week.main[1]}" target="_blank" rel="noreferrer">打开听力材料 ↗</a>`;
    app.innerHTML = `
      <section class="hero">
        <span class="day-pill">第 ${info.index + 1} 天 · 第 ${info.weekIndex + 1} 周</span>
        <div class="hero-row"><div><h2>${escapeHTML(info.week.theme)}</h2><p>${escapeHTML(info.week.goal)}</p></div><div class="progress-ring" style="--progress:${percentage * 3.6}deg"><b>${percentage}%</b></div></div>
      </section>
      <div class="section-head"><h2>今日任务</h2><small>${tasksDone}/${info.tasks.length} 已完成</small></div>
      <section class="task-list">${tasks}</section>
      <div class="section-head"><h2>今日听力</h2><small>三遍法</small></div>
      <section class="listening-card"><p class="eyebrow">MAIN LISTENING</p><h3>${escapeHTML(info.week.main[0])}</h3>${listeningContent}</section>
      <div class="section-head"><h2>本周词组</h2><small>点击跟读</small></div>
      <section class="phrase-strip">${phraseCards}</section>`;
  }

  function renderPlan() {
    const current = courseDay();
    const weeks = plan.map((week, weekIndex) => {
      const days = Array.from({length: 7}, (_, dayIndex) => {
        const index = weekIndex * 7 + dayIndex;
        return `<button class="day-button ${dayDone(index) ? "complete" : ""} ${index === current ? "current" : ""}" data-day="${index}">${dayIndex + 1}</button>`;
      }).join("");
      return `<details class="week-card" ${weekIndex === Math.floor(current / 7) ? "open" : ""}><summary class="week-summary"><span><strong>第${weekIndex + 1}周 · ${escapeHTML(week.theme)}</strong><small>${escapeHTML(week.goal)}</small></span><b>${Array.from({length:7},(_,i)=>dayDone(weekIndex*7+i)).filter(Boolean).length}/7</b></summary><div class="day-grid">${days}</div></details>`;
    }).join("");
    app.innerHTML = `<div class="section-head"><div><p class="eyebrow">84-DAY ROADMAP</p><h2>完整学习计划</h2></div><small>${Math.round(completedCount()/336*100)}%</small></div>${weeks}`;
  }

  function renderPhrases(query = "") {
    const normalized = query.trim().toLowerCase();
    const phrases = plan.flatMap((week, weekIndex) => week.phrases.map(item => ({ item, weekIndex })))
      .filter(({item}) => `${item[0]} ${item[1]}`.toLowerCase().includes(normalized));
    app.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">PRONUNCIATION LAB</p><h2>词组发音练习</h2></div><small>${phrases.length} 个</small></div>
      <div class="phrase-toolbar"><input class="search-input" id="phraseSearch" value="${escapeHTML(query)}" placeholder="搜索英文或中文"><button class="primary-button" id="playWeek">播放本周</button></div>
      <section class="phrase-list">${phrases.map(({item, weekIndex}) => `<article class="phrase-row"><div><p class="phrase-en">${escapeHTML(item[0])}</p><span class="phrase-cn">第${weekIndex + 1}周 · <b>中文释义：</b>${escapeHTML(item[1])}</span></div><button type="button" class="speak-button" data-speak="${escapeHTML(item[0])}" aria-label="播放${escapeHTML(item[0])}">🔊 播放</button></article>`).join("") || '<div class="empty">没有找到对应词组</div>'}</section>`;
    const input = document.getElementById("phraseSearch");
    input.addEventListener("input", event => renderPhrases(event.target.value));
    document.getElementById("playWeek").addEventListener("click", () => playSequence(dayInfo().week.phrases.map(item => item[0])));
    input.focus({preventScroll:true});
  }

  function playSequence(items) {
    if (!("speechSynthesis" in window)) return toast("当前浏览器不支持语音播放");
    window.speechSynthesis.cancel();
    items.forEach(text => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = Number(state.rate);
      window.speechSynthesis.speak(utterance);
    });
  }

  function renderProgress() {
    const completeDays = Array.from({length:84},(_,index)=>dayDone(index)).filter(Boolean).length;
    const weekIndex = Math.floor(courseDay()/7);
    const weekComplete = Array.from({length:7},(_,i)=>dayDone(weekIndex*7+i)).filter(Boolean).length;
    app.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">YOUR MOMENTUM</p><h2>学习进度</h2></div></div>
      <section class="stat-grid"><article class="stat"><b>${completeDays}</b><small>完成天数</small></article><article class="stat"><b>${streak()}</b><small>连续天数</small></article><article class="stat"><b>${weekComplete}/7</b><small>本周完成</small></article></section>
      <section class="milestone"><p class="eyebrow">NEXT MILESTONE</p><h3>${completeDays < 14 ? "先稳定完成14天" : completeDays < 42 ? "向课程中点前进" : completeDays < 84 ? "完成最终英文汇报" : "84天训练已完成"}</h3><p>${completeDays < 84 ? `你已经完成 ${completeDays} 天。每天完成一小步，比周末突击更重要。` : "重新录制第1天的自我介绍，对比你的流畅度与表达准确性。"}</p></section>
      <div class="section-head"><h2>12周概览</h2><small>${Math.round(completeDays/84*100)}%</small></div>
      ${plan.map((week,index)=>`<article class="week-card"><div class="week-summary"><span><strong>第${index+1}周 · ${escapeHTML(week.theme)}</strong><small>${Array.from({length:7},(_,i)=>dayDone(index*7+i)).filter(Boolean).length} 天完成</small></span><b>${Math.round(Array.from({length:7},(_,i)=>dayDone(index*7+i)).filter(Boolean).length/7*100)}%</b></div></article>`).join("")}`;
  }

  function render() {
    if (state.view === "plan") renderPlan();
    else if (state.view === "phrases") renderPhrases();
    else if (state.view === "progress") renderProgress();
    else renderToday();
    bindDynamicEvents();
  }

  function bindDynamicEvents() {
    document.querySelectorAll("[data-speak]").forEach(button => button.addEventListener("click", () => speak(button.dataset.speak)));
    document.querySelectorAll("[data-task]").forEach(input => input.addEventListener("change", () => {
      state.completed[input.dataset.task] = input.checked;
      saveState(); render(); if (input.checked) toast("完成一项，很稳！");
    }));
    document.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => {
      state.selectedDay = Number(button.dataset.day); state.view = "today"; saveState();
      document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === "today")); render();
    }));
    document.querySelectorAll("[data-translation]").forEach(button => button.addEventListener("click", () => {
      const translation = document.getElementById(button.dataset.translation);
      const shouldShow = translation.hidden;
      translation.hidden = !shouldShow;
      button.textContent = shouldShow ? "收起翻译" : "显示翻译";
      button.setAttribute("aria-expanded", String(shouldShow));
    }));
  }

  document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", () => setView(item.dataset.view)));
  document.getElementById("settingsButton").addEventListener("click", () => {
    document.getElementById("startDateInput").value = state.startDate;
    document.getElementById("speechRateInput").value = String(state.rate);
    dialog.showModal();
  });
  document.getElementById("saveSettings").addEventListener("click", () => {
    state.startDate = document.getElementById("startDateInput").value || todayISO;
    state.rate = Number(document.getElementById("speechRateInput").value);
    state.selectedDay = null; saveState(); render(); toast("设置已保存");
  });
  document.getElementById("resetButton").addEventListener("click", () => {
    if (confirm("确定清空所有学习记录吗？此操作无法撤销。")) { state = {...defaultState}; saveState(); dialog.close(); render(); toast("记录已清空"); }
  });
  document.getElementById("installButton").addEventListener("click", async () => {
    if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; }
    else toast("iPhone请点分享，再选“添加到主屏幕”");
  });
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
  render();
})();
