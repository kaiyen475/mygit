"use strict";

(() => {
  const icons = {
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 2 21 2c0 4-1.2 9.3-3.4 13.1A7 7 0 0 1 11 20Z"/><path d="M2 22c0-6 7-12 12-15"/>',
    sprout: '<path d="M12 22V12M12 12C12 4 4 4 2 4c0 8 4 9 10 8ZM12 16c0-8 8-8 10-8 0 8-4 9-10 8Z"/>',
    bird: '<path d="M16 7h.01M3.4 18H12a7 7 0 0 0 7-7V8l3-2-3-1a4 4 0 0 0-7.7 1.7L3 15l4 3M11 18v3M15 17v4"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16.2 7.8-2.7 5.7-5.7 2.7 2.7-5.7 5.7-2.7Z"/>',
    waves: '<path d="M2 6c2-2 4 2 6 0s4 2 6 0 4 2 8 0M2 12c2-2 4 2 6 0s4 2 6 0 4 2 8 0M2 18c2-2 4 2 6 0s4 2 6 0 4 2 8 0"/>',
    flower: '<path d="M12 12v10M9 22h6M12 17c-4 0-5-2-5-2M12 19c4 0 5-2 5-2"/><path d="M12 12c-1.8 3-5.3 1.4-4.9-1.5-3.4.1-4-3.6-.8-4.8-1.5-3.1 1.3-5.4 3.7-3 2-2.4 5.3-.8 4.5 2.5 3.4.5 3.5 4.3.2 5-1 2.9-4 3.3-2.7 1.8Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    up: '<path d="M7 17 17 7M7 7h10v10"/>',
    down: '<path d="M12 5v14m-6-6 6 6 6-6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 1 1 8 0v4m-4 5v2"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    x: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  };
  const icon = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const categories = ["전체", "조류", "식물", "습지", "곤충", "기타"];
  const categoryIcons = { 전체: "compass", 조류: "bird", 식물: "sprout", 습지: "waves", 곤충: "flower", 기타: "leaf" };
  const examples = [
    { id: "example-birds", title: "가을 철새를 만나는 미호강 탐사", category: "조류", date: "2026-10-24T00:00:00.000Z", deadline: "2026-10-23T09:00:00.000Z", location: "청주 미호강 일대", description: "미호강을 따라 걸으며 가을 철새의 움직임을 관찰합니다. 처음 탐조를 시작하는 분도 함께할 수 있어요.\n\n준비물: 편한 복장, 물, 개인 관찰 도구\n쌍안경이 없다면 대여를 선택해 주세요.\n\n이 게시물은 화면 안내를 위한 예시입니다. 실제 탐사 일정은 운영자가 등록합니다.", meetingPlaces: ["충북대학교 정문", "미호강 현장 집합"], capacity: 20, status: "open", isExample: true, count: 0 },
    { id: "example-plants", title: "숲의 계절을 읽는 상당산성 식물 탐사", category: "식물", date: "2026-11-07T01:00:00.000Z", deadline: "2026-11-06T09:00:00.000Z", location: "청주 상당산성", description: "숲길의 잎과 열매를 살펴보고, 식물의 겨울 준비를 관찰합니다. 천천히 걷고 함께 기록하는 탐사입니다.\n\n준비물: 걷기 편한 신발, 물, 작은 기록장\n\n이 게시물은 화면 안내를 위한 예시입니다.", meetingPlaces: ["충북대학교 정문", "상당산성 주차장"], capacity: 15, status: "open", isExample: true, count: 0 },
    { id: "example-wetland", title: "물과 생명이 만나는 대청호 습지 탐사", category: "습지", date: "2026-10-03T00:00:00.000Z", deadline: "2026-10-02T09:00:00.000Z", location: "대청호 주변 습지", description: "습지에 사는 생물과 주변의 생태를 함께 살펴보는 탐사 기록입니다.\n\n이 게시물은 지난 탐사 화면을 보여주기 위한 예시입니다.", meetingPlaces: ["충북대학교 정문", "대청호 현장 집합"], capacity: 20, status: "closed", isExample: true, count: 0 },
  ];
  const blankApplication = () => ({ name: "", phone: "", binoculars: false, boots: false, meetingPlace: "", meal: false, consent: false });
  const blankDraft = () => ({ title: "", category: "조류", date: "", deadline: "", location: "", description: "", meetingPlaces: "", capacity: "0", status: "open" });
  const state = { events: [], admin: false, loading: true, preview: false, category: "전체", tab: "open", search: "", mode: null, eventId: null, detail: null, detailLoading: false, detailError: "", signup: false, successName: "", busy: false, error: "", editingId: null, draft: blankDraft(), application: blankApplication(), key: "" };
  let previousFocus = null;
  let toastTimer;
  const $ = selector => document.querySelector(selector);
  const dateOptions = { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" };
  function format(value, full = false) { try { return new Intl.DateTimeFormat("ko-KR", full ? { ...dateOptions, year: "numeric", hour: "numeric", minute: "2-digit" } : dateOptions).format(new Date(value)); } catch { return "일정 미정"; } }
  function dateParts(value) { try { const d = new Date(value); return { day: new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", day: "2-digit" }).format(d), month: new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", month: "short" }).format(d).toUpperCase() }; } catch { return { day: "—", month: "DATE" }; } }
  function localDate(value) { return value ? new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 16) : ""; }
  function open(event) { return event.status === "open" && new Date(event.deadline).getTime() > Date.now() && new Date(event.date).getTime() > Date.now() && (!event.capacity || event.count < event.capacity); }
  function status(event) { if (new Date(event.date).getTime() < Date.now()) return "탐사 완료"; if (event.capacity && event.count >= event.capacity) return "정원 마감"; return open(event) ? "모집 중" : "신청 마감"; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join(""); }
  async function request(path, options = {}) { const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers }, cache: "no-store" }); let data; try { data = await response.json(); } catch { throw new Error("서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."); } if (!response.ok) { const e = new Error(data.error || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."); e.status = response.status; throw e; } return data; }
  function toast(message) { clearTimeout(toastTimer); $("#toast-root").innerHTML = `<div class="toast" role="status">${icon("checkCircle", 17)}${escape(message)}</div>`; toastTimer = setTimeout(() => { $("#toast-root").innerHTML = ""; }, 3500); }
  function header() { $("#header-actions").innerHTML = state.admin ? `<button class="admin-signout" data-action="logout" ${state.busy ? "disabled" : ""}>운영자 모드 · 로그아웃</button><button class="button button-small" data-action="compose">${icon("plus", 15)} 탐사 글쓰기</button>` : `<button class="admin-button" data-action="login">${icon("lock", 14)}<span>관리자</span></button>`; }

  function shell() {
    $("#app").innerHTML = `<header class="site-header"><div class="header-inner"><a href="#" class="brand" aria-label="VITALL 홈"><span class="brand-mark">${icon("leaf", 22)}</span><span>VITALL<span class="brand-dot">.</span></span></a><nav aria-label="주 메뉴"><a href="#board" class="nav-active">탐사 게시판</a><button data-action="about">VITALL 소개 ${icon("up", 13)}</button></nav><div class="header-actions" id="header-actions"></div></div></header>
      <main><section class="hero wrap"><div class="hero-copy"><div class="eyebrow"><span class="small-star">✳</span> VITALL FIELD NOTES</div><h1>자연을 가까이,<br>발견을 함께<span class="heading-dot">.</span></h1><p>작은 새 한 마리, 이름 모를 풀 한 포기.<br>함께 걷고 관찰하며 자연의 이야기를 기록합니다.</p><a href="#board" class="button hero-button">다음 탐사 만나보기 ${icon("down")}</a><div class="hero-footnote"><span class="tiny-line"></span> 자연을 좋아하는 누구나 함께할 수 있어요.</div></div><div class="hero-image"><img id="forest-photo" src="forest.svg" alt="햇빛이 스며드는 푸른 숲과 고요한 물길의 일러스트"><div class="image-grain"></div><div class="photo-top"><span class="photo-dot"></span> KEEP YOUR CURIOSITY ALIVE</div><div class="photo-caption"><span>함께 걷는 길에서,<br>새로운 자연을 만납니다.</span><span class="photo-coordinate">OUR NEXT DISCOVERY<br><span>IS JUST A WALK AWAY.</span></span></div><span class="photo-number">01 / FIELD NOTES</span></div></section>
      <div class="values-strip wrap"><div>${icon("compass", 20)}<span>발견하는 즐거움</span><small>익숙한 풍경을 새로운 시선으로</small></div><div>${icon("bird", 20)}<span>함께하는 관찰</span><small>경험이 없어도, 호기심만 있다면</small></div><div>${icon("leaf", 20)}<span>자연을 향한 마음</span><small>느리게 걷고, 오래 바라봅니다</small></div></div>
      <section class="board-section wrap" id="board"><div class="section-heading"><div><div class="eyebrow section-eyebrow">EXPLORE TOGETHER</div><h2>우리의 다음 탐사<span class="heading-dot">.</span></h2><p>마음이 가는 탐사를 골라, 함께 떠나보세요.</p></div><span class="board-heading-note" id="board-heading-note"></span></div><div id="board-notice"></div><div class="board-controls"><div class="categories" id="categories" aria-label="탐사 카테고리"></div><label class="search-box">${icon("search", 17)}<input id="search" aria-label="탐사 검색" placeholder="어떤 탐사를 찾고 있나요?"><button id="clear-search" data-action="clear-search" aria-label="검색어 지우기" hidden>${icon("x", 14)}</button></label></div><div class="board-tabs"><div role="tablist" aria-label="모집 상태" id="board-tabs"></div><span class="result-count" id="result-count"></span></div><div id="board-content"></div><div class="board-bottom"><span>${icon("leaf", 13)} 좋은 관찰은 자연을 아끼는 마음에서 시작됩니다.</span><span>WALK · OBSERVE · CONNECT</span></div></section>
      <section class="invitation wrap"><div class="invitation-symbol">${icon("sprout", 37)}</div><div><h3>처음이라도 괜찮아요.</h3><p>자연을 알아가는 일은, 함께할 때 더 즐겁습니다.<br class="mobile-break"> 당신의 첫 탐사를 VITALL과 함께해요.</p></div><button data-action="about">우리는 VITALL ${icon("up", 17)}</button></section></main>
      <footer class="site-footer wrap"><div class="footer-brand"><span>VITALL<span class="brand-dot">.</span></span><small>생태연구회 · 자연을 발견하는 사람들</small></div><span class="footer-note">작은 발견이 모여, 더 넓은 자연이 됩니다.</span><span class="copyright">© ${new Date().getFullYear()} VITALL</span></footer>`;
    const photo = $("#forest-photo");
    photo.addEventListener("error", () => { photo.hidden = true; });
    header(); board();
  }
  function board() {
    const count = state.events.filter(open).length;
    const filtered = state.events.filter(e => (state.category === "전체" || e.category === state.category) && (state.tab === "all" || (state.tab === "open" ? open(e) : new Date(e.date).getTime() < Date.now())) && `${e.title} ${e.location} ${e.category}`.toLowerCase().includes(state.search.trim().toLowerCase())).sort((a, b) => state.tab === "open" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
    $("#board-heading-note").innerHTML = `<span class="live-dot"></span> ${state.events.some(e => !e.isExample) ? `${count}개의 탐사가 기다리고 있어요` : "자연을 만나는 다양한 탐사를 준비합니다"}`;
    $("#board-notice").innerHTML = state.preview ? `<div class="board-example-note">${icon("leaf", 14)}<span><strong>미리보기</strong> · 현재 서버에 연결되지 않아 예시 화면을 보여드려요.<small> 신청과 저장은 서버가 연결된 후 이용할 수 있어요.</small></span><button class="text-button" data-action="reload" style="margin-left:auto;white-space:nowrap">다시 연결</button></div>` : !state.loading && state.events.length && state.events.every(e => e.isExample) ? `<div class="board-example-note">${icon("leaf", 14)}<span>아래 게시물은 예시 탐사입니다.<small> 실제 탐사가 등록되면 이곳에서 바로 신청할 수 있어요.</small></span></div>` : "";
    $("#categories").innerHTML = categories.map(c => `<button class="category-chip ${c === state.category ? "selected" : ""}" data-action="category" data-value="${escape(c)}" aria-pressed="${c === state.category}">${icon(categoryIcons[c], 15)}${escape(c)}</button>`).join("");
    $("#board-tabs").innerHTML = [{ key: "open", label: "모집 중" }, { key: "past", label: "지난 탐사" }, { key: "all", label: "전체 탐사" }].map(t => `<button role="tab" aria-selected="${state.tab === t.key}" class="${state.tab === t.key ? "active" : ""}" data-action="tab" data-value="${t.key}">${t.label}${t.key === "open" ? `<span>${count}</span>` : ""}</button>`).join("");
    $("#result-count").innerHTML = `총 <strong>${filtered.length}</strong>개의 탐사`;
    $("#clear-search").hidden = !state.search;
    $("#board-content").innerHTML = state.loading ? `<div class="board-loading"><span class="spinner"></span> 탐사 소식을 가져오고 있어요.</div>` : !filtered.length ? `<div class="empty-state">${icon("leaf", 32)}<h3>${state.search ? "검색 결과가 없어요" : "아직 등록된 탐사가 없어요"}</h3><p>${state.search ? "다른 이름이나 장소로 찾아보세요." : "새로운 탐사 소식을 이곳에서 만나보세요."}</p>${state.admin ? `<button class="button button-outline" data-action="compose">${icon("plus", 15)}탐사 글쓰기</button>` : ""}</div>` : `<div class="expedition-list">${filtered.map(e => { const date = dateParts(e.date); return `<button class="expedition-row" data-action="event" data-id="${escape(e.id)}"><div class="date-block"><span>${escape(date.month)}</span><strong>${escape(date.day)}</strong></div><div class="row-main"><div class="row-meta"><span class="category-label">${icon(categoryIcons[e.category], 12)}${escape(e.category)}</span>${e.isExample ? '<span class="example-badge">예시 탐사</span>' : ""}<span class="row-meta-date">${escape(format(e.date))}</span></div><h3>${escape(e.title)}</h3><div class="row-location">${icon("pin", 13)}${escape(e.location)}</div></div><div class="row-status"><span class="status-badge ${open(e) ? "open" : "closed"}">${open(e) ? "<span></span>" : ""}${status(e)}</span><span class="row-participants">${icon("users", 13)}<strong>${Number(e.count) || 0}</strong>명 신청${e.capacity > 0 ? `<span> / ${Number(e.capacity)}명</span>` : ""}</span></div><span class="row-arrow">${icon("up", 21)}</span></button>`; }).join("")}</div>`;
  }
  async function loadEvents() {
    state.loading = true; board();
    try { const result = await request("/api/expeditions"); if (!Array.isArray(result.events)) throw new Error("Invalid response"); state.events = result.events; state.admin = result.admin === true; state.preview = false; }
    catch { state.events = examples; state.admin = false; state.preview = true; }
    finally { state.loading = false; header(); board(); }
  }
  function modal(mode) { if (!state.mode) previousFocus = document.activeElement; state.mode = mode; state.error = ""; document.body.style.overflow = "hidden"; renderModal(); }
  function closeModal() { state.mode = null; state.signup = false; state.successName = ""; state.error = ""; $("#modal-root").innerHTML = ""; document.body.style.overflow = ""; const url = new URL(location.href); url.searchParams.delete("expedition"); history.replaceState({}, "", url); previousFocus?.focus(); }
  async function showEvent(id, changeUrl = true) {
    state.eventId = id; state.detail = null; state.detailError = ""; state.detailLoading = true; state.signup = false; state.successName = ""; state.application = blankApplication(); state.key = uuid(); modal("event");
    if (changeUrl) { const url = new URL(location.href); url.searchParams.set("expedition", id); history.pushState({}, "", url); }
    await loadDetail(id);
  }
  async function loadDetail(id) {
    state.detailLoading = true; state.detailError = "";
    try {
      if (state.preview) { const event = examples.find(e => e.id === id); if (!event) throw new Error("미리보기에서는 예시 탐사만 확인할 수 있어요."); state.detail = { event, signedUp: [], admin: false }; }
      else { state.detail = await request(`/api/expeditions/${encodeURIComponent(id)}`); state.admin = state.detail.admin === true; }
      if (!state.application.meetingPlace) state.application.meetingPlace = state.detail.event.meetingPlaces[0] || "";
    } catch (error) { state.detailError = error.message; }
    finally { state.detailLoading = false; header(); if (state.mode === "event" && state.eventId === id) renderModal(); }
  }
  function compose(event) { state.editingId = event?.id || null; state.draft = event ? { title: event.title, category: event.category, date: localDate(event.date), deadline: localDate(event.deadline), location: event.location, description: event.description, meetingPlaces: event.meetingPlaces.join("\n"), capacity: String(event.capacity), status: event.status } : blankDraft(); modal("compose"); }
  const formError = () => state.error ? `<p class="form-error" role="alert">${escape(state.error)}</p>` : "";
  const busyButton = (text, glyph = "check") => `<button class="button full-width" ${state.busy ? "disabled" : ""}>${state.busy ? '<span class="spinner"></span>' : icon(glyph)}${state.busy ? "처리 중…" : text}</button>`;
  function textInput(label, name, value, options = "") { return `<label class="field" for="field-${name}">${label}<input id="field-${name}" name="${name}" value="${escape(value)}" ${options}></label>`; }
  function choices(label, name, value) { return `<fieldset class="choice-field"><legend>${label}</legend><div class="choices"><label class="${value ? "chosen" : ""}"><input type="radio" name="${name}" value="true" ${value ? "checked" : ""}>예 ${icon("check", 15)}</label><label class="${!value ? "chosen" : ""}"><input type="radio" name="${name}" value="false" ${!value ? "checked" : ""}>아니요 ${icon("check", 15)}</label></div></fieldset>`; }
  function applicationForm(event) {
    const a = state.application;
    return `<form id="application-form" class="application-form"><div class="form-section-title"><h3>함께할 준비, 해볼까요?</h3><p>아래 정보를 남겨 주시면 신청이 완료됩니다.</p></div><div class="two-fields">${textInput('신청자 이름 <span class="required-dot">*</span>', "name", a.name, 'required maxlength="40" autocomplete="name" placeholder="이름을 입력해 주세요"')}${textInput('전화번호 <span class="required-dot">*</span>', "phone", a.phone, 'type="tel" required maxlength="24" autocomplete="tel" placeholder="010-0000-0000"')}</div><div class="two-fields">${choices("쌍안경을 대여할까요?", "binoculars", a.binoculars)}${choices("장화를 대여할까요?", "boots", a.boots)}</div><label class="field" for="field-meetingPlace">집합 장소 <span class="required-dot">*</span><select id="field-meetingPlace" name="meetingPlace" required><option value="">집합 장소를 선택해 주세요</option>${event.meetingPlaces.map(p => `<option ${p === a.meetingPlace ? "selected" : ""} value="${escape(p)}">${escape(p)}</option>`).join("")}</select></label>${choices("탐사 후 식사에 함께할까요?", "meal", a.meal)}<label class="consent"><input type="checkbox" name="consent" required ${a.consent ? "checked" : ""}><span>탐사 운영을 위한 개인정보 수집·이용 및 신청자 이름 공개에 동의합니다.<small>이름과 전화번호, 대여·집합·식사 선택 정보는 탐사 운영을 위해 수집하며, 이름만 게시판에 공개됩니다. 연락처와 상세 선택 정보는 운영자만 확인할 수 있습니다. 수집 정보는 탐사 안내와 준비에 사용됩니다.</small></span></label>${formError()}${busyButton("탐사 신청 완료하기")}</form>`;
  }
  function composer() {
    const d = state.draft;
    return `<div class="modal-eyebrow">${icon("sprout", 17)} NEW FIELD NOTE</div><h2 class="modal-title">${state.editingId ? "탐사 게시물 수정" : "새로운 탐사, 새로운 발견"}</h2><p class="modal-description">함께할 탐사의 일정과 준비사항을 알려주세요. 시간은 한국 시간 기준입니다.</p><form id="composer-form" class="composer-form"><div class="two-fields"><div class="field-grow" style="flex:2;min-width:0;width:100%">${textInput("탐사 제목", "title", d.title, 'required maxlength="120" placeholder="예: 가을 철새를 만나는 한강 탐사"')}</div><label class="field">카테고리<select name="category">${categories.slice(1).map(c => `<option ${d.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label></div><div class="two-fields">${textInput("탐사 일시", "date", d.date, 'type="datetime-local" required')}${textInput("신청 마감", "deadline", d.deadline, `type="datetime-local" required ${d.date ? `max="${escape(d.date)}"` : ""}`)}</div>${textInput("탐사 장소", "location", d.location, 'required maxlength="180" placeholder="탐사가 진행되는 장소"')}<label class="field">탐사 소개 및 안내<textarea name="description" rows="5" required maxlength="6000" placeholder="탐사 내용, 준비물, 집합 안내 등을 적어 주세요.">${escape(d.description)}</textarea></label><label class="field">집합 장소 선택지 <span class="field-note">한 줄에 한 곳씩 입력해 주세요.</span><textarea name="meetingPlaces" rows="3" required placeholder="현장 집합&#10;동아리방 앞">${escape(d.meetingPlaces)}</textarea></label><div class="two-fields">${textInput('모집 인원 <span class="field-note">0으로 설정하면 제한이 없어요.</span>', "capacity", d.capacity, 'type="number" min="0" max="10000" required')}<label class="field">모집 상태<select name="status"><option value="open" ${d.status === "open" ? "selected" : ""}>모집 중</option><option value="closed" ${d.status === "closed" ? "selected" : ""}>신청 마감</option></select></label></div>${state.events.find(e => e.id === state.editingId)?.isExample ? `<p class="example-note">${icon("leaf")}저장하면 예시 표시가 해제되고 실제 신청을 받는 탐사가 됩니다.</p>` : ""}${formError()}<div class="form-actions"><button type="button" class="button button-outline" data-action="close">취소</button><button class="button" ${state.busy ? "disabled" : ""}>${state.busy ? '<span class="spinner"></span>' : icon("plus")}${state.busy ? "저장 중…" : state.editingId ? "수정 내용 저장" : "탐사 게시물 올리기"}</button></div></form>`;
  }
  function applicants(detail) {
    const event = detail.event, list = detail.applicants || [];
    return `<div class="participants-section"><div class="participants-heading"><h3>함께하는 사람들 <span>${Number(event.count) || 0}</span></h3>${state.admin && detail.admin ? `<button class="text-button" data-action="csv">${icon("download", 14)}명단 다운로드</button>` : ""}</div>${state.admin && detail.admin ? `<div class="admin-totals"><span>쌍안경 <strong>${list.filter(a => a.binoculars).length}개</strong></span><span>장화 <strong>${list.filter(a => a.boots).length}켤레</strong></span><span>식사 <strong>${list.filter(a => a.meal).length}명</strong></span></div>${list.length ? `<div class="applicants-table-wrap"><table class="applicants-table"><thead><tr><th>이름</th><th>전화번호</th><th>쌍안경</th><th>장화</th><th>집합 장소</th><th>식사</th></tr></thead><tbody>${list.map(a => `<tr><td>${escape(a.name)}</td><td>${escape(a.phone)}</td><td>${a.binoculars ? "대여" : "—"}</td><td>${a.boots ? "대여" : "—"}</td><td>${escape(a.meetingPlace)}</td><td>${a.meal ? "참여" : "—"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="no-participants">아직 신청자가 없어요. 첫 동행을 기다리고 있습니다.</p>'}` : `${detail.signedUp?.length ? `<div class="name-chips">${detail.signedUp.map(a => `<span><span class="name-dot"></span>${escape(a.name)}</span>`).join("")}</div>` : '<p class="no-participants">아직 신청자가 없어요. 첫 동행을 기다리고 있습니다.</p>'}<p class="privacy-note">${icon("lock", 12)}연락처와 상세 신청 정보는 운영자만 확인할 수 있어요.</p>`}</div>`;
  }
  function eventContent() {
    let content = `<button class="detail-back" data-action="${state.signup ? "back-detail" : "close"}">${icon("back", 15)}${state.signup ? "탐사 정보로 돌아가기" : "탐사 게시판"}</button>`;
    if (state.detailLoading && !state.detail) return content + '<div class="board-loading"><span class="spinner"></span> 탐사 정보를 가져오고 있어요.</div>';
    if (state.detailError) return content + `<div class="empty-state"><p role="alert">${escape(state.detailError)}</p><button class="button button-outline" data-action="retry-detail">다시 시도</button></div>`;
    const detail = state.detail; if (!detail) return content;
    const e = detail.event;
    content += `<div class="detail-heading"><div class="detail-badges"><span class="category-label">${escape(e.category)}</span><span class="status-badge ${open(e) ? "open" : "closed"}">${status(e)}</span>${e.isExample ? '<span class="example-badge">예시 탐사</span>' : ""}</div><h2 class="detail-title">${escape(e.title)}</h2><div class="detail-actions"><button class="text-button" data-action="share">${icon("share", 14)}링크 공유</button>${state.admin ? `<button class="text-button" data-action="edit">게시물 수정 ${icon("up", 14)}</button>` : ""}</div></div>`;
    if (e.isExample) content += `<div class="example-note">${icon("leaf", 17)}<span>사이트 이용 방법을 보여주는 예시 탐사입니다. 실제 신청은 받지 않아요.${state.admin ? " 게시물을 수정해 실제 탐사로 전환할 수 있어요." : ""}</span></div>`;
    if (state.successName) return content + `<div class="signup-success" role="status"><div class="success-icon">${icon("check", 29)}</div><div class="eyebrow">SEE YOU IN THE FIELD</div><h3>${escape(state.successName)}님, 함께하게 되어 반가워요!</h3><p>탐사 신청이 완료되었어요.<br>아래 탐사 일시와 집합 장소를 확인해 주세요.</p><div class="success-date">${icon("calendar", 17)}${escape(format(e.date, true))}</div><button class="button button-outline" data-action="back-detail">탐사 정보 확인하기 ${icon("arrow", 15)}</button></div>`;
    if (state.signup) return content + applicationForm(e);
    content += `<div class="detail-facts"><div>${icon("calendar", 19)}<span>탐사 일시<strong>${escape(format(e.date, true))}</strong></span></div><div>${icon("pin", 19)}<span>탐사 장소<strong>${escape(e.location)}</strong></span></div><div>${icon("users", 19)}<span>모집 인원<strong>${e.capacity ? `${Number(e.capacity)}명` : "인원 제한 없음"}</strong></span></div><div>${icon("compass", 19)}<span>신청 마감<strong>${escape(format(e.deadline, true))}</strong></span></div></div><div class="detail-body"><h3>이번 탐사를 소개해요</h3><p>${escape(e.description)}</p><div class="meeting-info">${icon("pin", 17)}<div><strong>집합 장소</strong>${e.meetingPlaces.map(p => `<span>${escape(p)}</span>`).join("")}</div></div></div>${applicants(detail)}<div class="detail-bottom"><div><strong>${Number(e.count) || 0}명이 함께할 예정이에요.</strong><span>${e.isExample ? "실제 탐사 소식이 등록되면 신청해 주세요." : open(e) ? "별도의 가입 없이 바로 신청할 수 있어요." : "이 탐사는 신청이 마감되었습니다."}</span></div><button class="button" data-action="signup" ${e.isExample || !open(e) || state.preview ? "disabled" : ""}>${e.isExample ? "예시 탐사" : open(e) ? "이 탐사에 함께하기" : "신청 마감"}${icon("arrow")}</button></div>`;
    return content;
  }
  function renderModal() {
    if (!state.mode) return;
    const backdrop = $(".modal-backdrop"), scroll = backdrop?.scrollTop || 0;
    const activeId = $("#modal-root")?.contains(document.activeElement) ? document.activeElement.id : "";
    let content = "", title = "", wide = false;
    if (state.mode === "about") { title = "VITALL 소개"; content = `<div class="modal-eyebrow">${icon("leaf", 17)} ABOUT VITALL</div><h2 class="modal-title">자연을 발견하는 사람들<span class="heading-dot">.</span></h2><p class="about-lead">VITALL은 함께 걷고 관찰하며<br>자연의 이야기를 알아가는 생태연구회입니다.</p><div class="about-values"><p>${icon("bird", 22)}<span><strong>호기심에서 시작해요</strong>새와 식물, 습지와 작은 생명들까지. 가까운 자연을 새로운 눈으로 바라봅니다.</span></p><p>${icon("users", 22)}<span><strong>누구나 함께해요</strong>관찰 경험이 없어도 괜찮아요. 마음에 드는 탐사에 이름을 남기면 첫걸음이 시작됩니다.</span></p><p>${icon("leaf", 22)}<span><strong>자연을 아끼며 걸어요</strong>생명과 서식지를 존중하며, 자연을 만나고 배운 발견을 함께 나눕니다.</span></p></div><button class="button full-width" data-action="explore">탐사 둘러보기 ${icon("arrow")}</button>`; }
    if (state.mode === "login") { title = "운영자 로그인"; content = `<div class="modal-icon">${icon("lock", 25)}</div><div class="modal-eyebrow">FOR ORGANIZERS</div><h2 class="modal-title">운영자 모드</h2><p class="modal-description">비밀번호를 입력하면 탐사 게시물을 작성하고<br>신청자의 전체 정보를 확인할 수 있어요.</p>${state.preview ? '<div class="example-note">현재는 미리보기입니다. 서버가 연결되면 운영자 모드를 사용할 수 있어요.</div>' : `<form id="login-form">${textInput("운영자 비밀번호", "password", "", 'type="password" required autocomplete="current-password" placeholder="비밀번호를 입력해 주세요"')}${formError()}${busyButton("운영자 모드로 들어가기", "lock")}</form>`}<p class="modal-fineprint">탐사 신청은 로그인 없이 누구나 할 수 있어요.</p>`; }
    if (state.mode === "compose") { title = state.editingId ? "탐사 수정" : "탐사 글쓰기"; wide = true; content = composer(); }
    if (state.mode === "event") { title = state.detail?.event.title || "탐사 상세"; wide = true; content = eventContent(); }
    $("#modal-root").innerHTML = `<div class="modal-backdrop" data-backdrop="true"><div class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${escape(title)}" tabindex="-1"><button class="icon-button modal-close" data-action="close" aria-label="닫기">${icon("x", 21)}</button>${content}</div></div>`;
    $(".modal-backdrop").scrollTop = scroll;
    const focus = activeId && document.getElementById(activeId); (focus || $(".modal")).focus({ preventScroll: true });
  }
  async function login(form) {
    const password = new FormData(form).get("password"); state.busy = true; state.error = ""; renderModal();
    try { await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); await loadEvents(); closeModal(); toast("운영자 모드로 전환했어요."); }
    catch (error) { state.error = error.message; renderModal(); }
    finally { state.busy = false; if (state.mode === "login") renderModal(); header(); }
  }
  async function logout() {
    state.busy = true; header();
    try { await request("/api/admin/logout", { method: "POST", body: "{}" }); state.admin = false; if (state.detail) { state.detail.admin = false; delete state.detail.applicants; } await loadEvents(); if (state.mode === "event") await loadDetail(state.eventId); toast("운영자 모드를 종료했어요."); }
    catch (error) { toast(error.message); }
    finally { state.busy = false; header(); }
  }
  function readApplication(form) { const data = new FormData(form); state.application = { name: String(data.get("name") || ""), phone: String(data.get("phone") || ""), binoculars: data.get("binoculars") === "true", boots: data.get("boots") === "true", meetingPlace: String(data.get("meetingPlace") || ""), meal: data.get("meal") === "true", consent: data.get("consent") === "on" }; }
  function readDraft(form) { const data = new FormData(form); state.draft = Object.fromEntries(["title", "category", "date", "deadline", "location", "description", "meetingPlaces", "capacity", "status"].map(key => [key, String(data.get(key) || "")])); }
  async function apply(form) {
    if (state.preview || !state.detail || state.detail.event.isExample) { toast("실제 탐사가 등록되고 서버가 연결되면 신청할 수 있어요."); return; }
    readApplication(form); state.busy = true; state.error = ""; renderModal();
    const id = state.detail.event.id;
    try { const result = await request(`/api/expeditions/${encodeURIComponent(id)}/apply`, { method: "POST", body: JSON.stringify({ ...state.application, name: state.application.name.trim(), phone: state.application.phone.trim(), idempotencyKey: state.key || (state.key = uuid()) }) }); state.successName = result.name; state.signup = false; await Promise.all([loadEvents(), loadDetail(id)]); }
    catch (error) { state.error = error.message; }
    finally { state.busy = false; if (state.mode === "event") renderModal(); }
  }
  async function save(form) {
    if (state.preview || !state.admin) { toast("운영자 모드에서 서버에 연결한 후 저장할 수 있어요."); return; }
    readDraft(form); state.busy = true; state.error = ""; renderModal();
    try { const d = state.draft; const payload = { ...d, date: new Date(`${d.date}:00+09:00`).toISOString(), deadline: new Date(`${d.deadline}:00+09:00`).toISOString(), meetingPlaces: d.meetingPlaces.split("\n").map(p => p.trim()).filter(Boolean), capacity: Number(d.capacity), isExample: false }; await request(state.editingId ? `/api/expeditions/${encodeURIComponent(state.editingId)}` : "/api/expeditions", { method: state.editingId ? "PUT" : "POST", body: JSON.stringify(payload) }); await loadEvents(); closeModal(); toast(state.editingId ? "탐사 게시물을 수정했어요." : "새로운 탐사 게시물을 올렸어요."); }
    catch (error) { state.error = error.message; }
    finally { state.busy = false; if (state.mode === "compose") renderModal(); }
  }
  function exportCsv() {
    if (!state.admin || !state.detail?.admin) return;
    const rows = [["이름", "전화번호", "쌍안경 대여", "장화 대여", "집합 장소", "식사", "신청일"], ...(state.detail.applicants || []).map(a => [a.name, a.phone, a.binoculars ? "예" : "아니요", a.boots ? "예" : "아니요", a.meetingPlace, a.meal ? "예" : "아니요", format(a.createdAt, true)])];
    const csv = "\uFEFF" + rows.map(row => row.map(value => { const v = String(value); return `"${(/^[=+@-]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); const link = document.createElement("a"); link.href = url; link.download = `VITALL_${state.detail.event.title}_신청자.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document.addEventListener("click", event => {
    if (event.target.matches?.('[data-backdrop="true"]')) { closeModal(); return; }
    const button = event.target.closest?.("[data-action]"); if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "category") { state.category = button.dataset.value; board(); }
    else if (action === "tab") { state.tab = button.dataset.value; board(); }
    else if (action === "clear-search") { state.search = ""; $("#search").value = ""; board(); $("#search").focus(); }
    else if (action === "event") void showEvent(button.dataset.id);
    else if (action === "about" || action === "login") modal(action);
    else if (action === "close") closeModal();
    else if (action === "explore") { closeModal(); $("#board").scrollIntoView({ behavior: "smooth" }); }
    else if (action === "compose") { if (state.admin) compose(); }
    else if (action === "edit") { if (state.admin && state.detail) compose(state.detail.event); }
    else if (action === "signup") { if (state.detail && open(state.detail.event) && !state.detail.event.isExample && !state.preview) { state.signup = true; state.error = ""; renderModal(); $(".modal-backdrop").scrollTop = 0; } }
    else if (action === "back-detail") { state.signup = false; state.successName = ""; state.error = ""; renderModal(); }
    else if (action === "logout") void logout();
    else if (action === "reload") void loadEvents();
    else if (action === "retry-detail") void loadDetail(state.eventId);
    else if (action === "csv") exportCsv();
    else if (action === "share") { if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => toast("탐사 링크를 복사했어요.")).catch(() => toast("주소창의 링크를 복사해 주세요.")); else toast("주소창의 링크를 복사해 주세요."); }
  });
  document.addEventListener("input", event => {
    const field = event.target;
    if (field.id === "search") { state.search = field.value; board(); }
    if (field.closest?.("#application-form")) { readApplication(field.form); if (field.type === "radio") field.closest(".choices").querySelectorAll("label").forEach(label => label.classList.toggle("chosen", label.querySelector("input").checked)); }
    if (field.closest?.("#composer-form")) { readDraft(field.form); if (field.name === "date") field.form.elements.deadline.max = field.value; }
  });
  document.addEventListener("submit", event => { if (!["login-form", "application-form", "composer-form"].includes(event.target.id)) return; event.preventDefault(); if (state.busy) return; if (event.target.id === "login-form") void login(event.target); if (event.target.id === "application-form") void apply(event.target); if (event.target.id === "composer-form") void save(event.target); });
  document.addEventListener("keydown", event => {
    if (!state.mode) return;
    if (event.key === "Escape") { closeModal(); return; }
    if (event.key !== "Tab") return;
    const dialog = $(".modal"); const items = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')];
    if (!items.length) return; const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener("popstate", () => { const id = new URLSearchParams(location.search).get("expedition"); if (id) void showEvent(id, false); else closeModal(); });
  setInterval(() => { board(); if (state.mode === "event" && !state.signup && !state.busy) renderModal(); }, 60000);
  shell();
  loadEvents().then(() => { const id = new URLSearchParams(location.search).get("expedition"); if (id) void showEvent(id, false); });
})();
