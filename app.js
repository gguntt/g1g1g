const PHRASE = "빠른속도로 GIF 변환";
const TYPES = [
  { label: "MP4", exts: ["mp4"] },
  { label: "WEBM", exts: ["webm"] },
  { label: "MOV", exts: ["mov"] },
  { label: "OGG", exts: ["ogg", "ogv"] },
];
const RATIOS = {
  original: null,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
};

const dropzone = document.querySelector("#dropzone");
const pickBtn = document.querySelector("#pickBtn");
const fileInput = document.querySelector("#fileInput");
const messages = document.querySelector("#messages");
const formats = document.querySelector("#formats");
const formatLabel = document.querySelector("#formatLabel");
const step1 = document.querySelector("#step1");
const step2 = document.querySelector("#step2");
const step3 = document.querySelector("#step3");
const idle2 = document.querySelector("#idle2");
const settings = document.querySelector("#settings");
const info = document.querySelector("#info");
const player = document.querySelector("#player");
const lengthWarn = document.querySelector("#lengthWarn");
const fillHint = document.querySelector("#fillHint");
const startBtn = document.querySelector("#startBtn");
const progress = document.querySelector("#progress");
const bar = document.querySelector("#bar");
const pctEl = document.querySelector("#pct");
const downloadBtn = document.querySelector("#downloadBtn");
const thumbs = document.querySelector("#thumbs");
const gifPreview = document.querySelector("#gifPreview");
const gifBox = document.querySelector("#gifBox");
const typeTitle = document.querySelector("#typeTitle");
const cancelBtn = document.querySelector("#cancelBtn");
const remakeBtn = document.querySelector("#remakeBtn");
const resetBtn = document.querySelector("#resetBtn");
const extractBtn = document.querySelector("#extractBtn");
const extractTotal = document.querySelector("#extractTotal");
const extractProgress = document.querySelector("#extractProgress");
const extractTrack = document.querySelector("#extractTrack");
const extractBar = document.querySelector("#extractBar");
const extractPct = document.querySelector("#extractPct");
const saveSelectedBtn = document.querySelector("#saveSelectedBtn");
const saveAllBtn = document.querySelector("#saveAllBtn");
const frameDialog = document.querySelector("#frameDialog");
const frameDialogImg = document.querySelector("#frameDialogImg");
const saveOneBtn = document.querySelector("#saveOneBtn");
const closeFrameBtn = document.querySelector("#closeFrameBtn");
const speedButtons = [...document.querySelectorAll(".choice[data-speed]")];
const loopButtons = [...document.querySelectorAll(".choice.loop")];
const sizeButtons = [...document.querySelectorAll(".choice.size")];
const ratioButtons = [...document.querySelectorAll(".choice.ratio")];
const fillButtons = [...document.querySelectorAll(".choice.fill")];
const extractRateButtons = [...document.querySelectorAll(".choice.extract-rate")];

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const previewCanvas = document.createElement("canvas");
const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

const state = {
  file: null,
  video: null,
  videoUrl: null,
  sourceFps: 30,
  speed: 1,
  playMode: "loop",
  maxEdge: 480,
  ratio: "original",
  fill: false,
  panX: 0,
  panY: 0,
  mode: "native",
  playBtn: null,
  gifBlob: null,
  gifName: "",
  frames: [],
  framesReady: false,
  activeFrame: -1,
  extractRate: 1,
  previewView: "applied",
  busy: false,
  busyKind: "",
  runId: 0,
  previewWrap: null,
  previewStage: null,
  previewControls: null,
  previewRatioNote: null,
  viewButtons: null,
  reversePlaying: false,
};

let gifUrl = null;
let cancelRequested = false;
let previewRaf = 0;
let reverseRaf = 0;
let drag = null;

fileInput.addEventListener("change", () => {
  const files = fileInput.files ? [...fileInput.files] : [];
  fileInput.value = "";
  takeFiles(files);
});

window.addEventListener("dragover", (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  dropzone.classList.toggle("is-over", pointerOverZone(event));
});

window.addEventListener("dragleave", (event) => {
  if (event.target !== document.documentElement && event.relatedTarget) return;
  dropzone.classList.remove("is-over");
});

window.addEventListener("drop", (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  const over = pointerOverZone(event);
  dropzone.classList.remove("is-over");
  if (!over) return;
  takeFiles([...event.dataTransfer.files]);
});

speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.speed = Number(button.dataset.speed);
    setChecked(speedButtons, button);
    updateWarn();
    applyPreviewPlayback();
  });
});

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.maxEdge = Number(button.dataset.edge);
    setChecked(sizeButtons, button);
    invalidateFrames();
    updateWarn();
    updateExtractTotal();
    updatePreviewLayout();
  });
});

ratioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.ratio = button.dataset.ratio;
    state.panX = 0;
    state.panY = 0;
    setChecked(ratioButtons, button);
    invalidateFrames();
    updateFillHint();
    updateWarn();
    updateExtractTotal();
    updatePreviewLayout();
  });
});

fillButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.fill = button.dataset.fill === "1";
    if (!state.fill) {
      state.panX = 0;
      state.panY = 0;
    }
    setChecked(fillButtons, button);
    invalidateFrames();
    updateFillHint();
    updateWarn();
    updatePreviewLayout();
  });
});

loopButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.playMode = button.dataset.mode;
    setChecked(loopButtons, button);
    updateWarn();
    applyPreviewPlayback({ restart: true });
  });
});

extractRateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.busy) return;
    state.extractRate = Number(button.dataset.rate);
    setChecked(extractRateButtons, button);
    invalidateFrames();
    updateExtractTotal();
  });
});

function invalidateFrames() {
  if (!state.frames.length && !state.framesReady) return;
  extractProgress.hidden = true;
  resetThumbs();
}

startBtn.addEventListener("click", () => convert());
remakeBtn.addEventListener("click", () => convert());
extractBtn.addEventListener("click", () => extractFrames());
cancelBtn.addEventListener("click", () => {
  if (!state.busy) return;
  cancelRequested = true;
});
resetBtn.addEventListener("click", () => resetAll());
downloadBtn.addEventListener("click", () => downloadGif());
saveSelectedBtn.addEventListener("click", () => saveFramesZip(state.frames.filter((frame) => frame.selected)));
saveAllBtn.addEventListener("click", () => saveFramesZip(state.frames));
saveOneBtn.addEventListener("click", () => {
  const frame = state.frames[state.activeFrame];
  if (frame) {
    downloadBlob(frame.blob, frame.name, {
      description: "PNG 이미지",
      accept: { "image/png": [".png"] },
    });
  }
});
closeFrameBtn.addEventListener("click", () => frameDialog.close());
frameDialog.addEventListener("click", (event) => {
  if (event.target === frameDialog) frameDialog.close();
});

updateWarn();
resetThumbs();
updateActionButtons();
updateFillHint();
updateExtractTotal();
markSteps();
startTypewriter();

function setChecked(buttons, active) {
  buttons.forEach((button) => {
    button.setAttribute("aria-checked", button === active ? "true" : "false");
  });
}

function dragHasFiles(event) {
  const types = event.dataTransfer && event.dataTransfer.types;
  return Boolean(types && [...types].includes("Files"));
}

function pointerOverZone(event) {
  const rect = dropzone.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function updateActionButtons() {
  const hasVideo = Boolean(state.video);
  const framesDone = state.framesReady && state.frames.length > 0 && !state.busy;
  remakeBtn.hidden = !hasVideo;
  resetBtn.hidden = !hasVideo;
  startBtn.disabled = state.busy || !hasVideo;
  remakeBtn.disabled = state.busy || !hasVideo;
  extractBtn.disabled = state.busy || !hasVideo;
  saveSelectedBtn.disabled = !framesDone || !state.frames.some((frame) => frame.selected);
  saveAllBtn.disabled = !framesDone;
}

function updateExtractTotal() {
  if (!state.video || !Number.isFinite(state.video.duration) || state.video.duration <= 0) {
    extractTotal.textContent = "총 0장";
    return;
  }
  extractTotal.textContent = `총 ${planExtractTimes(state.video.duration, state.extractRate).length}장`;
}

function planExtractTimes(duration, rate) {
  const fps = Math.max(1, rate);
  const times = [];
  const safe = Number.isFinite(duration) ? duration : 0;
  if (safe <= 0) return [0];
  for (let i = 0; i / fps < safe - 0.001; i += 1) {
    times.push(i / fps);
    if (times.length >= 20000) break;
  }
  if (!times.length) times.push(0);
  return times;
}

function updateFillHint() {
  if (state.fill) {
    fillHint.textContent =
      state.ratio === "original"
        ? "켜면 고른 크기에 맞춰 화면을 채웁니다. 원본 비율에서는 잘릴 부분이 거의 없습니다."
        : "켜면 고른 비율에 꽉 차게 자릅니다. 미리보기에서 마우스로 끌어 남길 부분을 옮길 수 있습니다.";
  } else {
    fillHint.textContent = "끄면 영상이 잘리지 않고, 남는 공간은 검은색으로 채워집니다.";
  }
}

function stopPreviewLoop() {
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

function stopReversePlay() {
  if (reverseRaf) cancelAnimationFrame(reverseRaf);
  reverseRaf = 0;
  state.reversePlaying = false;
}

function startPreviewLoop() {
  stopPreviewLoop();
  const tick = () => {
    if (state.previewView === "applied" && previewCanvas.width > 0) {
      drawFramed(previewCtx, previewCanvas.width, previewCanvas.height);
    }
    previewRaf = requestAnimationFrame(tick);
  };
  tick();
}

function parkVideoInPlayer() {
  if (!state.previewWrap) return;
  player.replaceChildren(state.previewWrap);
  applyPreviewView();
}

function showGifResult() {
  gifBox.hidden = false;
  gifBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function applyPreviewPlayback({ restart = false } = {}) {
  const video = state.video;
  if (!video || state.busy) return;
  stopReversePlay();
  try {
    if ("playbackRate" in video) video.playbackRate = state.speed;
  } catch {
    /* 일부 재생기는 배속을 받지 않습니다. */
  }
  try {
    if ("playbackSpeed" in video) video.playbackSpeed = state.speed;
  } catch {
    /* ogv.js는 playbackSpeed를 쓸 수 있습니다. */
  }
  video.loop = state.playMode === "loop";
  if (restart) {
    try {
      await seek(video, 0);
    } catch {
      /* 처음으로 되돌리지 못해도 설정은 적용합니다. */
    }
  }
  if (state.mode === "native") video.muted = false;
  bindBoomerang(video);
  try {
    await video.play();
    syncPlayButton();
  } catch {
    /* 자동 재생이 막혀도 사용자가 직접 재생하면 설정이 적용됩니다. */
  }
}

function syncPlayButton() {
  if (!state.playBtn || !state.video) return;
  state.playBtn.textContent = state.video.paused && !state.reversePlaying ? "재생" : "일시정지";
}

function bindBoomerang(video) {
  video.onended = null;
  if (state.playMode !== "boomerang") return;
  video.loop = false;
  video.onended = () => {
    if (state.busy || state.playMode !== "boomerang") return;
    runBoomerangReverse(video);
  };
}

function runBoomerangReverse(video) {
  stopReversePlay();
  state.reversePlaying = true;
  let last = performance.now();
  const step = (now) => {
    if (!state.reversePlaying || state.busy || state.playMode !== "boomerang") return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const next = Math.max(0, video.currentTime - dt * state.speed);
    video.currentTime = next;
    if (next <= 0.02) {
      state.reversePlaying = false;
      video.currentTime = 0;
      video.play().catch(() => {});
      return;
    }
    reverseRaf = requestAnimationFrame(step);
  };
  reverseRaf = requestAnimationFrame(step);
}

async function downloadGif() {
  if (!state.gifBlob) return;
  await downloadBlob(state.gifBlob, state.gifName || "animation.gif", {
    description: "GIF 이미지",
    accept: { "image/gif": [".gif"] },
  });
}

async function downloadBlob(blob, name, pickerType) {
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: pickerType
          ? [pickerType]
          : [{ description: "파일", accept: { "application/octet-stream": [".*"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveFramesZip(frames) {
  if (!frames.length || state.busy || !state.framesReady) return;
  const base = fileBaseName(state.file ? state.file.name : "animation");
  const entries = frames.map((frame) => ({
    name: frame.name || `${base}_장면001.png`,
    data: frame.bytes,
  }));
  const zipBlob = buildZip(entries);
  await downloadBlob(zipBlob, `${base}_장면.zip`, {
    description: "ZIP 압축 파일",
    accept: { "application/zip": [".zip"] },
  });
}

function resetAll() {
  state.runId += 1;
  cancelRequested = false;
  stopPreviewLoop();
  stopReversePlay();
  releaseVideo();
  clearGif();
  setProgress(0);
  resetThumbs();
  setMessages([]);
  highlightFormats(false);
  state.speed = 1;
  state.playMode = "loop";
  state.maxEdge = 480;
  state.ratio = "original";
  state.fill = false;
  state.panX = 0;
  state.panY = 0;
  state.extractRate = 1;
  state.previewView = "applied";
  state.busy = false;
  state.busyKind = "";
  setChecked(speedButtons, speedButtons.find((button) => button.dataset.speed === "1"));
  setChecked(loopButtons, loopButtons.find((button) => button.dataset.mode === "loop"));
  setChecked(sizeButtons, sizeButtons.find((button) => button.dataset.edge === "480"));
  setChecked(ratioButtons, ratioButtons.find((button) => button.dataset.ratio === "original"));
  setChecked(fillButtons, fillButtons.find((button) => button.dataset.fill === "0"));
  setChecked(extractRateButtons, extractRateButtons.find((button) => button.dataset.rate === "1"));
  [...speedButtons, ...loopButtons, ...sizeButtons, ...ratioButtons, ...fillButtons, ...extractRateButtons].forEach(
    (button) => {
      button.disabled = false;
    }
  );
  fileInput.disabled = false;
  pickBtn.disabled = false;
  cancelBtn.hidden = true;
  extractProgress.hidden = true;
  setExtractProgress(0);
  idle2.hidden = false;
  settings.hidden = true;
  dropzone.classList.remove("is-over", "is-locked");
  updateFillHint();
  updateExtractTotal();
  updateActionButtons();
  markSteps();
  updateWarn();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTypewriter() {
  let count = 0;
  const tick = () => {
    count += 1;
    typeTitle.textContent = PHRASE.slice(0, count);
    if (count >= PHRASE.length) {
      typeTitle.classList.add("is-done");
      return;
    }
    setTimeout(tick, 110);
  };
  tick();
}

function takeFiles(files) {
  if (!files.length) return;
  if (state.busy) {
    setMessages([{ kind: "warn", text: "변환이 진행 중입니다. 끝난 뒤에 다른 동영상을 올려 주세요." }]);
    return;
  }
  const notices = [];
  if (files.length > 1) {
    notices.push({
      kind: "warn",
      text: "한 번에 하나의 동영상만 올릴 수 있습니다. 첫 번째 동영상만 사용합니다.",
    });
  }
  useFile(files[0], notices);
}

async function useFile(file, notices) {
  if (!file || file.size <= 0) {
    highlightFormats(true);
    setMessages([
      ...notices,
      {
        kind: "error",
        text: "빈 파일은 GIF로 바꿀 수 없습니다. 아래에서 빛나고 있는 MP4, WEBM, MOV, OGG 중에서 골라 주세요.",
      },
    ]);
    formats.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const kind = matchType(file);
  if (!kind) {
    const ext = extensionOf(file.name);
    highlightFormats(true);
    setMessages([
      ...notices,
      {
        kind: "error",
        text: `‘${file.name}’ 파일은 GIF로 바꿀 수 없습니다. ${ext ? `${ext.toUpperCase()} 형식은` : "이 형식은"} 지원하지 않습니다. 아래에서 빛나고 있는 MP4, WEBM, MOV, OGG 동영상을 다시 골라 주세요.`,
      },
    ]);
    formats.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  highlightFormats(false);
  setMessages([...notices, { kind: "info", text: "동영상을 읽고 있습니다." }]);

  let opened;
  try {
    opened = await openMedia(file);
  } catch {
    highlightFormats(true);
    setMessages([
      ...notices,
      {
        kind: "error",
        text: `‘${file.name}’ 파일은 ${kind.label} 형식으로 보이지만, 이 브라우저에서 영상을 열 수 없어 GIF로 만들지 못합니다. 코덱이 다르면 재생 자체가 되지 않습니다. 아래에서 빛나고 있는 MP4, WEBM, MOV, OGG 중에서 다른 파일을 골라 주세요.`,
      },
    ]);
    formats.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  releaseVideo();
  clearGif();
  setProgress(0);
  resetThumbs();
  state.file = file;
  state.video = opened.video;
  state.videoUrl = opened.url;
  state.mode = opened.mode;
  state.panX = 0;
  state.panY = 0;
  state.runId += 1;

  mountPreview(opened.video, opened.mode);
  idle2.hidden = true;
  settings.hidden = false;

  setMessages([...notices, { kind: "info", text: "영상 길이와 초당 장면 수를 확인하고 있습니다." }]);
  state.sourceFps = opened.mode === "ogv" ? await detectOgvFps(opened.video) : await detectFps(opened.video);
  if (opened.mode === "native") opened.video.muted = false;

  renderInfo(file, kind, opened.video);
  updateWarn();
  updateExtractTotal();
  markSteps();
  updateActionButtons();
  updatePreviewLayout();
  applyPreviewPlayback({ restart: true });
  setMessages(notices);
  step2.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderInfo(file, kind, video) {
  const rows = [
    ["파일 이름", file.name],
    ["종류", kind.label],
    ["용량", formatBytes(file.size)],
    ["영상 길이", formatDuration(video.duration)],
    ["화면 크기", `${video.videoWidth}×${video.videoHeight}`],
  ];
  info.replaceChildren();
  for (const [label, value] of rows) {
    const box = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    box.append(dt, dd);
    info.append(box);
  }
}

async function convert() {
  const video = state.video;
  if (!video || state.busy || !state.file) return;

  const { captureFps, times } = planCapture(video.duration, state.sourceFps, state.speed);
  const sequence = buildSequence(times);
  if (sequence.length > 900) {
    const ok = window.confirm(
      `이 영상은 약 ${sequence.length}장으로 나뉩니다. 영상이 길면 변환이 오래 걸릴 수 있고, 이 분량은 몇 분 이상 걸릴 수 있습니다. 시작할까요?`
    );
    if (!ok) return;
  }

  const runId = ++state.runId;
  cancelRequested = false;
  setBusy(true, "gif");
  clearGif();
  parkVideoInPlayer();
  setProgress(0);
  markSteps();
  updateActionButtons();
  step3.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const size = resolveOutputSize(video.videoWidth, video.videoHeight);
  canvas.width = size.w;
  canvas.height = size.h;
  const delay = frameDelayMs(captureFps);
  const gif = GIFEncoder();
  const repeat = state.playMode === "once" ? -1 : 0;
  let outcome = "done";

  try {
    video.pause();
    stopReversePlay();
    for (let i = 0; i < sequence.length; i += 1) {
      if (state.runId !== runId) {
        outcome = "replaced";
        break;
      }
      if (cancelRequested) {
        outcome = "cancel";
        break;
      }
      await seek(video, sequence[i]);
      if (state.mode !== "ogv") await nextPresentedFrame(video);
      if (state.runId !== runId) {
        outcome = "replaced";
        break;
      }
      if (cancelRequested) {
        outcome = "cancel";
        break;
      }

      drawFramed(ctx, size.w, size.h);
      const shot = ctx.getImageData(0, 0, size.w, size.h);
      setProgress((i / sequence.length) * 100);
      await nextPaint();

      const palette = quantize(shot.data, 128);
      if (!palette || palette.length === 0) throw new Error("색을 추리지 못했습니다.");
      const index = applyPalette(shot.data, palette);
      gif.writeFrame(index, size.w, size.h, { palette, delay, dispose: 1, repeat });
      setProgress(((i + 1) / sequence.length) * 100);
    }

    if (outcome === "done") {
      gif.finish();
      const bytes = gif.bytes();
      state.gifBlob = new Blob([bytes], { type: "image/gif" });
      state.gifName = toGifName(state.file.name);
      gifUrl = URL.createObjectURL(state.gifBlob);
      gifPreview.src = gifUrl;
      downloadBtn.disabled = false;
      setProgress(100);
      setMessages([{ kind: "info", text: "GIF가 완성되었습니다. 아래에서 미리보고 다운로드하세요." }]);
      showGifResult();
    } else if (outcome === "cancel") {
      downloadBtn.disabled = true;
      setMessages([{ kind: "warn", text: "변환을 취소했습니다. 설정을 바꾼 뒤 다시 만들 수 있습니다." }]);
    }
  } catch {
    if (state.runId !== runId) return;
    outcome = "error";
    downloadBtn.disabled = true;
    setMessages([
      {
        kind: "error",
        text: "변환 중 문제가 생겼습니다. 다른 동영상을 선택하거나 더 짧은 영상으로 다시 시도해 주세요.",
      },
    ]);
  } finally {
    if (state.runId === runId) {
      cancelRequested = false;
      setBusy(false);
      markSteps();
      updateActionButtons();
      if (outcome === "done") {
        try {
          await seek(video, 0);
        } catch {
          /* 미리보기를 처음으로 되돌리지 못해도 완성된 GIF는 유지합니다. */
        }
        applyPreviewPlayback();
      }
    }
  }
}

async function extractFrames() {
  const video = state.video;
  if (!video || state.busy || !state.file) return;

  const times = planExtractTimes(video.duration, state.extractRate);
  if (times.length > 900) {
    const ok = window.confirm(
      `약 ${times.length}장을 뽑습니다. 영상이 길면 시간이 꽤 걸릴 수 있습니다. 시작할까요?`
    );
    if (!ok) return;
  }

  const runId = ++state.runId;
  cancelRequested = false;
  setBusy(true, "extract");
  resetThumbs();
  state.framesReady = false;
  extractProgress.hidden = false;
  setExtractProgress(0);
  updateActionButtons();

  const size = resolveOutputSize(video.videoWidth, video.videoHeight);
  canvas.width = size.w;
  canvas.height = size.h;
  let outcome = "done";

  try {
    video.pause();
    stopReversePlay();
    for (let i = 0; i < times.length; i += 1) {
      if (state.runId !== runId) {
        outcome = "replaced";
        break;
      }
      if (cancelRequested) {
        outcome = "cancel";
        break;
      }
      await seek(video, times[i]);
      if (state.mode !== "ogv") await nextPresentedFrame(video);
      if (state.runId !== runId) {
        outcome = "replaced";
        break;
      }
      if (cancelRequested) {
        outcome = "cancel";
        break;
      }
      drawFramed(ctx, size.w, size.h);
      await appendThumb(i, size.w, size.h);
      setExtractProgress(((i + 1) / times.length) * 100);
      await nextPaint();
    }

    if (outcome === "done") {
      state.framesReady = true;
      setExtractProgress(100);
      setMessages([{ kind: "info", text: `장면 ${state.frames.length}장을 뽑았습니다. 필요한 사진을 저장하세요.` }]);
    } else if (outcome === "cancel") {
      resetThumbs();
      setMessages([{ kind: "warn", text: "장면 뽑기를 취소했습니다." }]);
    }
  } catch {
    if (state.runId !== runId) return;
    outcome = "error";
    resetThumbs();
    setMessages([{ kind: "error", text: "장면을 뽑는 중 문제가 생겼습니다. 다시 시도해 주세요." }]);
  } finally {
    if (state.runId === runId) {
      cancelRequested = false;
      setBusy(false);
      if (outcome !== "done") extractProgress.hidden = true;
      updateActionButtons();
      try {
        await seek(video, 0);
      } catch {
        /* 미리보기를 처음으로 되돌리지 못해도 됩니다. */
      }
      applyPreviewPlayback();
    }
  }
}

function buildSequence(times) {
  if (state.playMode !== "boomerang" || times.length < 2) return times;
  const reverse = [];
  for (let i = times.length - 2; i >= 1; i -= 1) reverse.push(times[i]);
  return times.concat(reverse);
}

async function appendThumb(index, width, height) {
  const pngCanvas = document.createElement("canvas");
  pngCanvas.width = width;
  pngCanvas.height = height;
  pngCanvas.getContext("2d").drawImage(canvas, 0, 0);
  const blob = await new Promise((resolve) => pngCanvas.toBlob(resolve, "image/png"));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = `${fileBaseName(state.file.name)}_장면${String(index + 1).padStart(3, "0")}.png`;
  const frame = { blob, bytes, name, selected: false, url: URL.createObjectURL(blob) };
  state.frames.push(frame);

  const thumbWidth = 92;
  const thumbHeight = Math.max(2, Math.round(height * (thumbWidth / width)));
  const thumb = document.createElement("canvas");
  thumb.width = thumbWidth;
  thumb.height = thumbHeight;
  thumb.getContext("2d").drawImage(canvas, 0, 0, thumbWidth, thumbHeight);

  const card = document.createElement("div");
  card.className = "thumb-card";
  const image = document.createElement("img");
  image.src = thumb.toDataURL("image/jpeg", 0.72);
  image.alt = `장면 ${index + 1}`;
  image.addEventListener("click", () => openFrame(index));
  const label = document.createElement("label");
  const check = document.createElement("input");
  check.type = "checkbox";
  check.addEventListener("change", () => {
    frame.selected = check.checked;
    updateActionButtons();
  });
  label.append(check, document.createTextNode("선택"));
  card.append(image, label);
  const empty = thumbs.querySelector(".thumb-empty");
  if (empty) empty.remove();
  thumbs.append(card);
  thumbs.scrollLeft = thumbs.scrollWidth;
}

function openFrame(index) {
  const frame = state.frames[index];
  if (!frame) return;
  state.activeFrame = index;
  frameDialogImg.src = frame.url;
  frameDialog.showModal();
}

function setBusy(busy, kind = "") {
  state.busy = busy;
  state.busyKind = busy ? kind : "";
  pickBtn.disabled = busy;
  fileInput.disabled = busy;
  startBtn.disabled = busy || !state.video;
  remakeBtn.disabled = busy || !state.video;
  extractBtn.disabled = busy || !state.video;
  [...speedButtons, ...loopButtons, ...sizeButtons, ...ratioButtons, ...fillButtons, ...extractRateButtons].forEach(
    (button) => {
      button.disabled = busy;
    }
  );
  if (state.playBtn) state.playBtn.disabled = busy;
  if (state.viewButtons) {
    state.viewButtons.forEach((button) => {
      button.disabled = busy;
    });
  }
  dropzone.classList.toggle("is-locked", busy);
  cancelBtn.hidden = !(busy && kind === "gif");
  if (state.previewStage) {
    state.previewStage.classList.toggle(
      "is-draggable",
      !busy && state.fill && state.ratio !== "original" && state.previewView === "applied"
    );
  }
  updateActionButtons();
}

function setExtractProgress(value) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  extractBar.style.width = `${pct}%`;
  extractPct.textContent = `${pct}%`;
  extractTrack.setAttribute("aria-valuenow", String(pct));
}

function markSteps() {
  const hasVideo = Boolean(state.video);
  const stage = state.busyKind === "gif" || state.gifBlob ? 3 : hasVideo ? 2 : 1;
  [step1, step2, step3].forEach((step, index) => {
    const number = index + 1;
    step.classList.toggle("is-current", number === stage);
    step.classList.toggle("is-done", number < stage);
    step.classList.toggle("is-upcoming", number > stage);
  });
}

function updateWarn() {
  if (!state.video) {
    lengthWarn.textContent =
      "영상이 길면 변환이 오래 걸릴 수 있습니다. 동영상을 올리면 만들기 전에 장면 수와 예상 용량을 알려 드립니다.";
    return;
  }

  const { captureFps, times } = planCapture(state.video.duration, state.sourceFps, state.speed);
  const sequence = buildSequence(times);
  const size = resolveOutputSize(state.video.videoWidth, state.video.videoHeight);
  const bytes = estimateGifBytes(sequence.length, size.w, size.h);
  const delay = frameDelayMs(captureFps);
  let rateLine;
  if (state.sourceFps > 30) {
    rateLine = `원본은 1초에 ${state.sourceFps}장입니다. GIF는 1초에 최대 30장만 자릅니다.`;
  } else if (state.sourceFps < 30) {
    rateLine = `원본은 1초에 ${state.sourceFps}장으로, 30장보다 적어서 원래 장수를 기준으로 합니다.`;
  } else {
    rateLine = "원본은 1초에 30장입니다. 한도와 같으므로 그 장수를 기준으로 합니다.";
  }
  const modeLine =
    state.playMode === "loop"
      ? "계속 반복합니다."
      : state.playMode === "once"
        ? "한 번만 재생합니다."
        : "부메랑으로 갔다가 다시 돌아옵니다.";
  const fillLine = state.fill ? "화면 채우기로 자릅니다." : "잘리지 않게 넣고 남는 칸은 검게 채웁니다.";

  lengthWarn.textContent =
    `영상이 길면 변환이 오래 걸릴 수 있습니다. 이 영상은 ${formatDuration(state.video.duration)}입니다. ` +
    `${rateLine} ${state.speed}배 속도라 약 ${sequence.length}장, 용량은 대략 ${formatBytes(bytes)}입니다. ` +
    `장면 간격은 약 ${(delay / 1000).toFixed(2)}초이고, 화면은 ${size.w}×${size.h} 크기입니다. ${fillLine} ${modeLine}`;
}

function highlightFormats(on) {
  formats.classList.toggle("is-hot", on);
  formatLabel.textContent = on
    ? "이 종류만 GIF로 바꿀 수 있습니다. 다시 골라 주세요."
    : "GIF로 바꿀 수 있는 동영상";
}

function setMessages(items) {
  messages.replaceChildren();
  if (!items.length) {
    messages.hidden = true;
    return;
  }
  messages.hidden = false;
  for (const item of items) {
    const paragraph = document.createElement("p");
    paragraph.className = item.kind;
    paragraph.textContent = item.text;
    messages.append(paragraph);
  }
}

function setProgress(value) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  bar.style.width = `${pct}%`;
  pctEl.textContent = `${pct}%`;
  progress.setAttribute("aria-valuenow", String(pct));
}

function resetThumbs() {
  clearFrameUrls();
  state.frames = [];
  state.framesReady = false;
  state.activeFrame = -1;
  thumbs.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "thumb-empty";
  empty.textContent = "장면 뽑기를 누르면 사진이 여기에 줄지어 나타납니다.";
  thumbs.append(empty);
  updateActionButtons();
}

function clearFrameUrls() {
  for (const frame of state.frames) {
    if (frame.url) URL.revokeObjectURL(frame.url);
  }
}

function clearGif() {
  state.gifBlob = null;
  state.gifName = "";
  downloadBtn.disabled = true;
  gifBox.hidden = true;
  gifPreview.removeAttribute("src");
  if (gifUrl) {
    URL.revokeObjectURL(gifUrl);
    gifUrl = null;
  }
  updateActionButtons();
}

function releaseVideo() {
  stopPreviewLoop();
  stopReversePlay();
  if (state.video) {
    try {
      state.video.pause();
    } catch {
      /* 이미 정리된 재생기는 멈춰 있지 않아도 됩니다. */
    }
    state.video.onended = null;
    state.video.removeAttribute("src");
    if (typeof state.video.load === "function") state.video.load();
  }
  state.mode = "native";
  state.playBtn = null;
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.video = null;
  state.videoUrl = null;
  state.file = null;
  state.previewWrap = null;
  state.previewStage = null;
  state.previewControls = null;
  state.previewRatioNote = null;
  state.viewButtons = null;
  player.replaceChildren();
}

function isOggFile(file) {
  const ext = extensionOf(file.name);
  if (ext === "ogg" || ext === "ogv") return true;
  return (file.type || "").toLowerCase() === "video/ogg";
}

function loadOgvScript() {
  if (window.ogvjs && window.ogvjs.OGVPlayer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "vendor/ogv/ogv.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("ogv"));
    document.head.append(script);
  });
}

async function openMedia(file) {
  try {
    const loaded = await loadVideo(file);
    try {
      await ensureDuration(loaded.video);
    } catch (error) {
      URL.revokeObjectURL(loaded.url);
      throw error;
    }
    return { mode: "native", video: loaded.video, url: loaded.url };
  } catch (error) {
    if (!isOggFile(file)) throw error;
  }
  return openOgv(file);
}

async function openOgv(file) {
  await loadOgvScript();
  const url = URL.createObjectURL(file);
  const video = new window.ogvjs.OGVPlayer();
  video.muted = true;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 20000);
      const onError = () => {
        clearTimeout(timer);
        reject(new Error("ogv"));
      };
      const ok = () => {
        if (!(video.videoWidth > 0) || !Number.isFinite(video.duration) || video.duration <= 0) return;
        clearTimeout(timer);
        video.removeEventListener("error", onError);
        resolve();
      };
      video.addEventListener("loadedmetadata", ok);
      video.addEventListener("loadeddata", ok);
      video.addEventListener("error", onError);
      video.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { mode: "ogv", video, url };
}

function mountPreview(video, mode) {
  const wrap = document.createElement("div");
  wrap.className = "preview-wrap";

  const tabs = document.createElement("div");
  tabs.className = "preview-tabs";
  const appliedBtn = document.createElement("button");
  appliedBtn.type = "button";
  appliedBtn.className = "choice";
  appliedBtn.dataset.view = "applied";
  appliedBtn.setAttribute("role", "radio");
  appliedBtn.textContent = "적용된 모습";
  const sourceBtn = document.createElement("button");
  sourceBtn.type = "button";
  sourceBtn.className = "choice";
  sourceBtn.dataset.view = "source";
  sourceBtn.setAttribute("role", "radio");
  sourceBtn.textContent = "원본";
  tabs.append(appliedBtn, sourceBtn);

  const stage = document.createElement("div");
  stage.className = "preview-stage";
  stage.append(previewCanvas);

  const ratioNote = document.createElement("p");
  ratioNote.className = "ratio-note";
  ratioNote.hidden = true;

  const controls = document.createElement("div");
  controls.className = "preview-controls";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "btn btn-ghost";
  playBtn.textContent = "재생";
  controls.append(playBtn);

  state.previewWrap = wrap;
  state.previewStage = stage;
  state.previewControls = controls;
  state.previewRatioNote = ratioNote;
  state.viewButtons = [appliedBtn, sourceBtn];
  state.playBtn = playBtn;
  state.previewView = "applied";
  setChecked(state.viewButtons, appliedBtn);

  appliedBtn.addEventListener("click", () => {
    if (state.busy) return;
    state.previewView = "applied";
    setChecked(state.viewButtons, appliedBtn);
    applyPreviewView();
  });
  sourceBtn.addEventListener("click", () => {
    if (state.busy) return;
    state.previewView = "source";
    setChecked(state.viewButtons, sourceBtn);
    applyPreviewView();
  });

  playBtn.addEventListener("click", async () => {
    if (!state.video || state.busy) return;
    if (state.video.paused && !state.reversePlaying) {
      state.video.muted = false;
      applyPreviewPlayback();
      return;
    }
    stopReversePlay();
    state.video.pause();
    syncPlayButton();
  });

  video.addEventListener("play", syncPlayButton);
  video.addEventListener("pause", syncPlayButton);
  video.addEventListener("ended", () => {
    if (state.playMode !== "boomerang") syncPlayButton();
  });

  if (mode === "native") {
    video.controls = false;
    video.playsInline = true;
    video.playbackRate = state.speed;
    video.loop = state.playMode === "loop";
  } else {
    video.className = "ogv-view";
    video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    if ("playbackSpeed" in video) video.playbackSpeed = state.speed;
    if ("playbackRate" in video) video.playbackRate = state.speed;
    video.loop = state.playMode === "loop";
  }

  bindPreviewDrag(stage);
  wrap.append(tabs, stage, ratioNote, controls);
  player.replaceChildren(wrap);
  applyPreviewView();
  startPreviewLoop();
}

function applyPreviewView() {
  if (!state.video || !state.previewStage) return;
  const stage = state.previewStage;
  stage.replaceChildren();
  if (state.previewView === "source") {
    stage.classList.add("is-source");
    stage.classList.remove("is-draggable");
    stage.style.width = "";
    stage.style.height = "";
    stage.style.aspectRatio = `${state.video.videoWidth} / ${state.video.videoHeight}`;
    stage.append(state.video);
    if (state.previewRatioNote) state.previewRatioNote.hidden = true;
  } else {
    stage.classList.remove("is-source");
    stage.append(previewCanvas);
    updatePreviewLayout();
  }
}

function bindPreviewDrag(stage) {
  stage.addEventListener("pointerdown", (event) => {
    if (state.busy || !state.fill || !state.video) return;
    if (state.ratio === "original") return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || !state.video) return;
    const size = resolveOutputSize(state.video.videoWidth, state.video.videoHeight);
    const rect = stage.getBoundingClientRect();
    const scaleX = size.w / Math.max(rect.width, 1);
    const scaleY = size.h / Math.max(rect.height, 1);
    const crop = cropRect(state.video.videoWidth, state.video.videoHeight, size.w, size.h);
    const dx = (event.clientX - drag.x) * scaleX;
    const dy = (event.clientY - drag.y) * scaleY;
    const rangeX = Math.max(crop.maxSx, 1);
    const rangeY = Math.max(crop.maxSy, 1);
    state.panX = clamp(drag.panX - (dx / rangeX) * 2, -1, 1);
    state.panY = clamp(drag.panY - (dy / rangeY) * 2, -1, 1);
  });
  const endDrag = (event) => {
    if (!drag) return;
    drag = null;
    stage.classList.remove("is-dragging");
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {
      /* 포인터가 이미 놓인 경우입니다. */
    }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
}

function updatePreviewLayout() {
  if (!state.video || !state.previewStage) return;
  const size = resolveOutputSize(state.video.videoWidth, state.video.videoHeight);
  previewCanvas.width = size.w;
  previewCanvas.height = size.h;
  if (state.previewView === "applied") {
    const display = fitPreviewDisplaySize(size.w, size.h);
    state.previewStage.style.aspectRatio = "";
    state.previewStage.style.width = `${display.displayW}px`;
    state.previewStage.style.height = `${display.displayH}px`;
    state.previewStage.classList.toggle(
      "is-draggable",
      state.fill && state.ratio !== "original" && !state.busy
    );
    if (!state.previewStage.contains(previewCanvas)) {
      state.previewStage.replaceChildren(previewCanvas);
    }
    drawFramed(previewCtx, size.w, size.h);
    updateRatioNote(state.video.videoWidth, state.video.videoHeight);
  }
}

function fitPreviewDisplaySize(outW, outH) {
  const maxW = Math.min(560, Math.max(240, (player.clientWidth || 560) - 8));
  const maxH = outH >= outW ? 360 : 420;
  const scale = Math.min(maxW / outW, maxH / outH);
  return {
    displayW: Math.max(2, Math.round(outW * scale)),
    displayH: Math.max(2, Math.round(outH * scale)),
  };
}

function updateRatioNote(srcW, srcH) {
  if (!state.previewRatioNote) return;
  if (state.previewView !== "applied" || state.ratio === "original" || !srcW || !srcH) {
    state.previewRatioNote.hidden = true;
    state.previewRatioNote.textContent = "";
    return;
  }
  const chosen = RATIOS[state.ratio];
  const source = srcW / Math.max(srcH, 1);
  const same = Math.abs(chosen - source) / Math.max(source, 0.0001) < 0.02;
  state.previewRatioNote.hidden = !same;
  state.previewRatioNote.textContent = same ? "원본과 같은 비율이에요" : "";
}

function drawFramed(targetCtx, outW, outH) {
  const video = state.video;
  if (!video) return;
  let source;
  try {
    source = frameElement(video);
  } catch {
    return;
  }
  const srcW = video.videoWidth || source.videoWidth || source.width || 2;
  const srcH = video.videoHeight || source.videoHeight || source.height || 2;
  targetCtx.fillStyle = "#000";
  targetCtx.fillRect(0, 0, outW, outH);
  if (state.fill) {
    const crop = cropRect(srcW, srcH, outW, outH);
    targetCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
    return;
  }
  const scale = Math.min(outW / srcW, outH / srcH);
  const dw = Math.max(1, Math.round(srcW * scale));
  const dh = Math.max(1, Math.round(srcH * scale));
  const dx = Math.round((outW - dw) / 2);
  const dy = Math.round((outH - dh) / 2);
  targetCtx.drawImage(source, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

function cropRect(srcW, srcH, outW, outH) {
  const outAspect = outW / outH;
  let sw;
  let sh;
  if (srcW / srcH > outAspect) {
    sh = srcH;
    sw = srcH * outAspect;
  } else {
    sw = srcW;
    sh = srcW / outAspect;
  }
  const maxSx = Math.max(0, srcW - sw);
  const maxSy = Math.max(0, srcH - sh);
  const sx = clamp(maxSx / 2 + state.panX * (maxSx / 2), 0, maxSx);
  const sy = clamp(maxSy / 2 + state.panY * (maxSy / 2), 0, maxSy);
  return { sx, sy, sw, sh, maxSx, maxSy };
}

function frameElement(video) {
  if (state.mode !== "ogv") return video;
  const canvasNode = video.querySelector("canvas");
  if (!canvasNode) throw new Error("frame");
  return canvasNode;
}

async function detectOgvFps(video) {
  const times = [];
  video.muted = true;
  const onFrame = () => {
    if (Number.isFinite(video.currentTime)) times.push(video.currentTime);
  };
  video.addEventListener("framecallback", onFrame);
  try {
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 700));
  } catch {
    return 30;
  } finally {
    video.removeEventListener("framecallback", onFrame);
    try {
      video.pause();
    } catch {
      /* 재생이 시작되지 않았으면 멈출 대상이 없습니다. */
    }
  }
  try {
    await seek(video, 0);
  } catch {
    /* 처음으로 되돌리지 못해도 초당 장면 수는 계산할 수 있습니다. */
  }
  return snapFps(times);
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.muted = true;
    let settled = false;
    const timer = setTimeout(() => fail(new Error("timeout")), 12000);
    const ok = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("error", onError);
      resolve({ video, url });
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    const onError = () => fail();
    video.addEventListener("loadedmetadata", ok);
    video.addEventListener("error", onError);
    video.src = url;
    video.load();
  });
}

async function ensureDuration(video) {
  if (Number.isFinite(video.duration) && video.duration > 0 && !(video.videoWidth > 0)) {
    throw new Error("novideo");
  }
  if (video.videoWidth > 0 && Number.isFinite(video.duration) && video.duration > 0) return;
  try {
    await seek(video, 1e7);
    await seek(video, 0);
  } catch {
    throw new Error("metadata");
  }
  if (!(video.videoWidth > 0) || !Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("metadata");
  }
}

async function detectFps(video) {
  if (typeof video.requestVideoFrameCallback !== "function") return 30;
  const times = [];
  video.muted = true;
  let stop = false;
  try {
    await video.play();
  } catch {
    return 30;
  }

  await new Promise((resolve) => {
    const finish = () => {
      if (stop) return;
      stop = true;
      resolve();
    };
    const step = (_now, metadata) => {
      if (stop) return;
      if (metadata && Number.isFinite(metadata.mediaTime)) times.push(metadata.mediaTime);
      if (times.length >= 12 || video.ended) {
        finish();
        return;
      }
      video.requestVideoFrameCallback(step);
    };
    video.requestVideoFrameCallback(step);
    setTimeout(finish, 900);
  });

  video.pause();
  try {
    await seek(video, 0);
  } catch {
    /* 처음으로 되돌리지 못해도 초당 장면 수는 계산할 수 있습니다. */
  }
  return snapFps(times);
}

function snapFps(times) {
  const deltas = [];
  for (let i = 1; i < times.length; i += 1) {
    const delta = times[i] - times[i - 1];
    if (delta > 0.008 && delta < 0.2) deltas.push(delta);
  }
  if (deltas.length < 2) return 30;
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];
  const fps = 1 / median;
  const common = [8, 10, 12, 15, 20, 24, 25, 30, 48, 50, 60];
  let best = 30;
  let bestDiff = Infinity;
  for (const candidate of common) {
    const diff = Math.abs(fps - candidate);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  if (bestDiff > 4) return Math.min(60, Math.max(1, Math.round(fps)));
  return best;
}

function planCapture(duration, sourceFps, speed = 1) {
  const captureFps = Math.min(sourceFps, 30);
  const safeDuration = Number.isFinite(duration) ? duration : 0;
  const base = [];
  if (safeDuration <= 0) {
    base.push(0);
  } else {
    for (let i = 0; i / captureFps < safeDuration - 0.001; i += 1) {
      base.push(i / captureFps);
      if (base.length >= 20000) break;
    }
    if (!base.length) base.push(0);
  }

  const safeSpeed = speed > 0 ? speed : 1;
  const targetCount = Math.max(1, Math.round(base.length / safeSpeed));
  const times = [];
  if (targetCount <= base.length) {
    if (targetCount === 1) {
      times.push(base[0]);
    } else {
      for (let i = 0; i < targetCount; i += 1) {
        const index = Math.round((i * (base.length - 1)) / (targetCount - 1));
        times.push(base[index]);
      }
    }
  } else {
    const repeats = targetCount / base.length;
    for (let i = 0; i < base.length; i += 1) {
      const copies = Math.round((i + 1) * repeats) - Math.round(i * repeats);
      for (let copy = 0; copy < copies; copy += 1) times.push(base[i]);
    }
  }
  if (!times.length) times.push(base[0] || 0);
  return { captureFps, times };
}

function frameDelayMs(captureFps) {
  const ideal = 1000 / captureFps;
  const centiseconds = Math.max(2, Math.round(ideal / 10));
  return centiseconds * 10;
}

function estimateGifBytes(frames, width, height) {
  return Math.max(1024, Math.round(frames * width * height * 0.45));
}

function resolveOutputSize(srcW, srcH) {
  const aspect = RATIOS[state.ratio] == null ? srcW / Math.max(srcH, 1) : RATIOS[state.ratio];
  const maxEdge = state.maxEdge;
  let w;
  let h;
  if (aspect >= 1) {
    w = maxEdge;
    h = Math.round(maxEdge / aspect);
  } else {
    h = maxEdge;
    w = Math.round(maxEdge * aspect);
  }
  if (w % 2) w -= 1;
  if (h % 2) h -= 1;
  return { w: Math.max(2, w), h: Math.max(2, h) };
}

function toGifName(name) {
  return `${fileBaseName(name)}.gif`;
}

function fileBaseName(name) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base || "animation";
}

function matchType(file) {
  const ext = extensionOf(file.name);
  const byExt = TYPES.find((type) => type.exts.includes(ext));
  if (byExt) return byExt;
  const mime = (file.type || "").toLowerCase();
  if (mime === "video/mp4") return TYPES[0];
  if (mime === "video/webm") return TYPES[1];
  if (mime === "video/quicktime") return TYPES[2];
  if (mime === "video/ogg") return TYPES[3];
  return null;
}

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remain = total - minutes * 60;
  const shown = remain.toFixed(1);
  if (minutes > 0) return `${minutes}분 ${shown}초`;
  return `${shown}초`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seek(video, time) {
  return new Promise((resolve, reject) => {
    const target = Math.min(
      Math.max(time, 0),
      Number.isFinite(video.duration) ? Math.max(video.duration - 0.001, 0) : time
    );
    if (Math.abs(video.currentTime - target) < 0.001) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("seek-timeout"));
    }, 4000);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek-error"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = target;
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function nextPresentedFrame(video) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => finish());
      setTimeout(finish, 160);
      return;
    }
    requestAnimationFrame(() => finish());
  });
}

function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc32(data) >>> 0, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const center = new Uint8Array(46 + nameBytes.length);
    const centerView = new DataView(center.buffer);
    centerView.setUint32(0, 0x02014b50, true);
    centerView.setUint16(10, 0, true);
    centerView.setUint32(16, crc32(data) >>> 0, true);
    centerView.setUint32(20, data.length, true);
    centerView.setUint32(24, data.length, true);
    centerView.setUint16(28, nameBytes.length, true);
    centerView.setUint32(42, offset, true);
    center.set(nameBytes, 46);
    central.push(center);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}
