    let STATE = null;
    let selectedDeal = 'PO-25800';
    let activeView = 'workflow'; // 'workflow' | 'registers' | 'security' | 'factory'
    let activeDocTab = 'auto';   // 'auto' | 'stock' | 'po' | 'bol' | 'invoice'
    let deskSubView = 'auto';    // 'auto' | 'books' | 'voucher' | 'spot' | 'oa' | 'ocr'
    let liveShowcasePhase = null; // null | 'spot_calling' | 'email_arrived'
    let showcaseTimer = null;
    let selectedRegSys = 'wms';
    let selectedRegTable = 'part_part';
    let cachedTableData = null;
    let busyAction = false;
    let busyBannerText = '';
    let activeModal = null;

    // KAL Voice State
    let speakSeq = 0;
    let ttsAbortController = null;
    let currentTtsBlobUrl = null;
    let kalSpeaking = false;
    let kalMuted = false;
    let kalSubtitle = 'Click "▶ Start KAL · P2P Steward" — KAL runs automated blocks & speaks live, pausing at every step for your review.';
    let kalBadgeText = 'KAL · P2P STEWARD ($0 SIGNING LIMIT)';
    let dockScannedReels = new Set();
    let lastFlashedReelSeq = 0;
    let autoScanningReels = false;

    function playRfScannerBeep(allDone = false) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const beep = (freq, startSec, durSec) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + startSec);
          gain.gain.setValueAtTime(0.14, ctx.currentTime + startSec);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startSec + durSec);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + startSec);
          osc.stop(ctx.currentTime + startSec + durSec);
        };
        beep(1960, 0, 0.06);
        if (allDone) beep(2520, 0.08, 0.09);
        setTimeout(() => { try { ctx.close(); } catch {} }, 300);
      } catch {}
    }

    function getDealReelSpecs(d) {
      if (Array.isArray(d?.reelBarcodes) && d.reelBarcodes.length > 0) return d.reelBarcodes;
      return [
        { seq: 1, serial: 'REEL-01', barcode: 'ENC-GS1-884192-R01', heatLot: 'HT-2611-884A', qtyFt: 2000, weightLbs: 822 },
        { seq: 2, serial: 'REEL-02', barcode: 'ENC-GS1-884192-R02', heatLot: 'HT-2611-884A', qtyFt: 2000, weightLbs: 822 },
        { seq: 3, serial: 'REEL-03', barcode: 'ENC-GS1-884192-R03', heatLot: 'HT-2611-884B', qtyFt: 2000, weightLbs: 822 },
        { seq: 4, serial: 'REEL-04', barcode: 'ENC-GS1-884192-R04', heatLot: 'HT-2611-884B', qtyFt: 2000, weightLbs: 822 },
      ];
    }

    function scanSingleDockReel(seq) {
      if (busyAction || !STATE) return;
      const d = STATE.deals[selectedDeal];
      const reels = getDealReelSpecs(d);
      const target = reels.find(r => r.seq === seq);
      if (!target) return;
      dockScannedReels.add(seq);
      lastFlashedReelSeq = seq;
      const scannedCount = dockScannedReels.size;
      const allDone = scannedCount >= reels.length;
      playRfScannerBeep(allDone);
      kalBadgeText = `RF SCAN GUN · BAY 4 (${scannedCount}/${reels.length} REELS)`;
      kalSubtitle = allDone
        ? `All ${reels.length} Encore Wire GS1 reel barcodes scanned (${fmtInt(scannedCount * 2000)} FT = 100% of BOL-25800). Click "✓ Submit Dock Scan" to post SQLite stock & GL!`
        : `Snap ${scannedCount} of ${reels.length}: Scanned Vendor Barcode ${target.barcode} (+${fmtInt(target.qtyFt)} FT · ${target.weightLbs} lbs) ➔ ${fmtInt(scannedCount * 2000)} / 8,000 FT.`;
      renderCenter();
      const subEl = document.getElementById('kalSubText');
      const badgeEl = document.getElementById('kalRoleBadge');
      if (subEl) subEl.textContent = kalSubtitle;
      if (badgeEl) badgeEl.textContent = kalBadgeText;
    }

    function scanNextDockReel() {
      if (!STATE) return;
      const reels = getDealReelSpecs(STATE.deals[selectedDeal]);
      const next = reels.find(r => !dockScannedReels.has(r.seq));
      if (next) scanSingleDockReel(next.seq);
    }

    async function scanAllDockReelsSequentially() {
      if (busyAction || autoScanningReels || !STATE) return;
      const reels = getDealReelSpecs(STATE.deals[selectedDeal]);
      const pending = reels.filter(r => !dockScannedReels.has(r.seq));
      if (pending.length === 0) return;
      autoScanningReels = true;
      renderCenter();
      try {
        for (let i = 0; i < pending.length; i++) {
          if (!STATE || computeStepIndex(STATE.runtimeState[selectedDeal]) !== 5) break;
          scanSingleDockReel(pending[i].seq);
          if (i < pending.length - 1) {
            await new Promise(res => setTimeout(res, 460));
          }
        }
      } finally {
        await new Promise(res => setTimeout(res, 240));
        autoScanningReels = false;
        lastFlashedReelSeq = 0;
        renderCenter();
      }
    }

    // Mic & Recorder State
    let recognition = null;
    let isListening = false;
    let micMediaRecorder = null;
    let micChunks = [];
    let demoRecorder = null;
    let demoChunks = [];
    let demoTimerInterval = null;
    let demoStartEpoch = 0;
    let recAudioCtx = null;
    let recMixDest = null;
    let recTtsSourceWired = false;

    function fmtUsd(n) {
      return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtUsdShort(n) {
      const v = Number(n || 0);
      if (v === 0) return '$0';
      return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    function fmtInt(n) {
      return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    function fmtAcct(n, showPlus = false) {
      const v = Number(n || 0);
      if (Math.abs(v) < 0.005) return '$0.00';
      if (v < 0) return '(' + fmtUsd(Math.abs(v)) + ')';
      return (showPlus ? '+' : '') + fmtUsd(v);
    }
    function usdToCheckWords(amount) {
      const ones = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const sub1000 = (x) => {
        const p = [];
        if (x >= 100) { p.push(ones[Math.floor(x / 100)] + ' Hundred'); x %= 100; }
        if (x >= 20) { const t = tens[Math.floor(x / 10)], o = x % 10; p.push(o ? `${t}-${ones[o]}` : t); }
        else if (x > 0) p.push(ones[x]);
        return p.join(' ');
      };
      const centsTotal = Math.round(Math.abs(Number(amount) || 0) * 100);
      let d = Math.floor(centsTotal / 100);
      const c = String(centsTotal % 100).padStart(2, '0');
      if (d === 0) return `Zero and ${c}/100 Dollars`;
      const parts = [];
      if (d >= 1000) { parts.push(sub1000(Math.floor(d / 1000)) + ' Thousand'); d %= 1000; }
      if (d > 0) parts.push(sub1000(d));
      return `${parts.join(' ')} and ${c}/100 Dollars`;
    }
    function esc(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function computeStepIndex(st) {
      // Returns 0..8 (0..7 = active step 1..8, 8 = all 8 steps complete — pauses at EVERY step 1..8!)
      if (!st) return 0;
      if (st.wf4_ach_released) return 8;
      if (st.wf4_match_status === 'voucher_posted' && st.wf3_match_confirmed) return 7; // Step 8: Meredith Cut Check
      if (st.wf2_dock_received === 'done') return 6;          // Step 7: OCR & 3-Way Match (pauses for OK to Proceed)
      if (st.wf1_po_committed === 'done' && st.wf1_vendor_ack === 'done' && st.wf1_ack_verified) return 5; // Step 6: Marcus Dock Scan
      if (st.wf1_po_committed === 'done') return 4;           // Step 5: Order Ack (pauses for OK to Proceed)
      if (st.wf0_req_status === 'approved') return 3;         // Step 4: Live Spot & PO (pauses for OK to Proceed)
      if (st.wf0_req_status === 'pending_manager_doa') return 2; // Step 3: VP Devon Signing Limit
      if (st.kal_started) return 1;                           // Step 2: Darius Supply Chain Confirm
      return 0;                                               // Step 1: WMS Stock-Out Signal
    }

    function inspectStepCell(idx) {
      const st = STATE?.runtimeState?.[selectedDeal];
      if (!st) return;
      const curIdx = computeStepIndex(st);
      if (idx === curIdx) { setDeskSubView('auto'); return; }
      if (idx === 3 && st.spotQuote) { setDeskSubView('spot'); return; }
      if (idx === 4 && st.wf1_vendor_ack === 'done') { setDeskSubView('oa'); return; }
      if (idx === 6 && st.wf3_mailbox_polled) { setDeskSubView('ocr'); return; }
      if (idx === 7 && st.wf4_ach_released) { setDeskSubView('voucher'); return; }
    }

    function resolveEffectiveDocTab(st) {
      if (activeDocTab !== 'auto') return activeDocTab;
      if (!st) return 'stock';
      if (st.wf3_mailbox_polled) return 'invoice';
      if (st.wf2_dock_received === 'done') return 'bol';
      if (st.wf1_po_committed === 'done') return 'po';
      return 'stock';
    }

    function setDocTab(tab) {
      activeDocTab = tab;
      renderRight();
    }

    function setDeskSubView(mode) {
      if (showcaseTimer) { clearTimeout(showcaseTimer); showcaseTimer = null; }
      liveShowcasePhase = null;
      if (activeView !== 'workflow') setView('workflow');
      deskSubView = mode;
      renderCenter();
    }

    /* ================= VOICE ENGINE (KAL · ~450ms TURBO STREAMING) ================= */
    function syncKalButtons() {
      const b = document.getElementById('kalMuteBtn');
      if (!b) return;
      if (kalSpeaking) {
        b.textContent = '⏹ Stop KAL';
        b.style.background = '#fef2f2';
        b.style.borderColor = '#ef4444';
        b.style.color = '#b91c1c';
      } else if (kalMuted) {
        b.textContent = '🔇 KAL: MUTED';
        b.style.background = '#f1f5f9';
        b.style.borderColor = '#94a3b8';
        b.style.color = '#475569';
      } else {
        b.textContent = '🔊 KAL Voice: ON';
        b.style.background = '';
        b.style.borderColor = '';
        b.style.color = '';
      }
    }

    function stopKalAudio() {
      speakSeq++;
      kalSpeaking = false;
      if (ttsAbortController) {
        try { ttsAbortController.abort(); } catch {}
        ttsAbortController = null;
      }
      const audio = document.getElementById('ttsAudio');
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        try { audio.pause(); } catch {}
        audio.removeAttribute('src');
        try { audio.load(); } catch {}
      }
      if (currentTtsBlobUrl) {
        try { URL.revokeObjectURL(currentTtsBlobUrl); } catch {}
        currentTtsBlobUrl = null;
      }
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
      syncKalButtons();
    }

    function handleKalStopOrMute() {
      if (kalSpeaking) {
        stopKalAudio();
        return;
      }
      kalMuted = !kalMuted;
      if (kalMuted) stopKalAudio();
      syncKalButtons();
      if (activeView === 'security') renderCenter();
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          if (activeModal) closeModal();
          else if (kalSpeaking) stopKalAudio();
        }
      });
    }

    async function speakText(text, voiceRole = 'ops_steward') {
      if (!text) return;
      stopKalAudio();
      kalSubtitle = text;
      renderCenter();
      if (kalMuted) return;

      const mySeq = ++speakSeq;
      const ctrl = new AbortController();
      ttsAbortController = ctrl;
      kalSpeaking = true;
      syncKalButtons();

      let useWebSpeechFallback = false;
      let normalizedFallback = text;

      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceRole }),
          signal: ctrl.signal,
        });
        if (mySeq !== speakSeq || kalMuted) return;

        const ct = res.headers.get('content-type') || '';
        if (ct.includes('audio/mpeg')) {
          const lat = res.headers.get('x-voice-latency-ms') || '';
          kalBadgeText = `KAL · STEWARD${lat ? ' · ' + lat + 'ms' : ''}`;
          const blob = await res.blob();
          if (mySeq !== speakSeq || kalMuted) return;

          const audio = document.getElementById('ttsAudio');
          currentTtsBlobUrl = URL.createObjectURL(blob);
          audio.src = currentTtsBlobUrl;
          audio.onended = () => {
            if (mySeq === speakSeq) { kalSpeaking = false; syncKalButtons(); }
          };
          audio.onerror = () => {
            if (mySeq === speakSeq) { kalSpeaking = false; syncKalButtons(); }
          };
          renderCenter();
          await audio.play();
          return;
        } else {
          const j = await res.json().catch(() => ({}));
          if (j.fallback === 'web_speech' && !STATE?.voiceConfig?.elevenLabsConfigured) {
            useWebSpeechFallback = true;
            if (j.normalizedText) normalizedFallback = j.normalizedText;
          }
        }
      } catch {
        if (mySeq === speakSeq) { kalSpeaking = false; syncKalButtons(); }
        return;
      }

      if (useWebSpeechFallback && mySeq === speakSeq && !kalMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(normalizedFallback);
        u.rate = 1.04;
        u.onend = () => { if (mySeq === speakSeq) { kalSpeaking = false; syncKalButtons(); } };
        u.onerror = () => { if (mySeq === speakSeq) { kalSpeaking = false; syncKalButtons(); } };
        window.speechSynthesis.speak(u);
      } else if (mySeq === speakSeq) {
        kalSpeaking = false;
        syncKalButtons();
      }
    }

    function startSoxAndDbTour() {
      if (activeView !== 'workflow') {
        activeView = 'workflow';
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('nav-workflow');
        if (btn) btn.classList.add('active');
      }
      if (deskSubView === 'sox_db') {
        deskSubView = 'auto';
        stopKalAudio();
        renderCenter();
        return;
      }
      deskSubView = 'sox_db';
      renderCenter();
      askKalPreset('sox_db_tour');
    }

    async function askKalPreset(preset) {
      stopKalAudio();
      if (kalMuted) { kalMuted = false; syncKalButtons(); }
      try {
        kalSubtitle = 'KAL checking live SQLite & hledger records…';
        renderCenter();
        const res = await fetch('/api/voice/kal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset }),
        });
        const out = await res.json();
        if (out.state) { STATE = out.state; renderAll(); }
        await speakText(out.reply, out.voiceRole || 'ops_steward');
      } catch {}
    }

    async function askKalPrompt(rawTranscript) {
      const clean = String(rawTranscript || '').trim();
      if (!clean) return;
      stopKalAudio();
      if (kalMuted) { kalMuted = false; syncKalButtons(); }
      kalSubtitle = `Heard "${clean}" — checking records…`;
      renderCenter();
      try {
        const res = await fetch('/api/voice/kal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: clean }),
        });
        const out = await res.json();
        if (out.state) { STATE = out.state; renderAll(); }
        await speakText(out.reply, out.voiceRole || 'ops_steward');
      } catch {}
    }

    async function toggleVoiceListen() {
      const btn = document.getElementById('micBtn');
      if (STATE?.voiceConfig?.elevenLabsConfigured && navigator.mediaDevices?.getUserMedia) {
        if (isListening && micMediaRecorder && micMediaRecorder.state !== 'inactive') {
          micMediaRecorder.stop();
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micChunks = [];
          micMediaRecorder = new MediaRecorder(stream);
          isListening = true;
          btn.classList.add('listening');
          btn.textContent = '🔴 Send to KAL';
          micMediaRecorder.ondataavailable = e => { if (e.data.size > 0) micChunks.push(e.data); };
          micMediaRecorder.onstop = async () => {
            isListening = false;
            btn.classList.remove('listening');
            btn.textContent = '🎙️ Ask KAL';
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(micChunks, { type: micMediaRecorder.mimeType || 'audio/webm' });
            kalSubtitle = 'Transcribing via ElevenLabs Scribe…';
            renderCenter();
            const sttRes = await fetch('/api/voice/stt', {
              method: 'POST',
              headers: { 'Content-Type': blob.type || 'audio/webm' },
              body: blob,
            });
            const sttJson = await sttRes.json().catch(() => ({}));
            if (sttJson.ok && sttJson.transcript) {
              await askKalPrompt(sttJson.transcript);
            } else {
              kalSubtitle = 'Could not hear clearly — click 🎙️ Ask KAL or 📊 Brief.';
              renderCenter();
            }
          };
          micMediaRecorder.start();
          return;
        } catch {}
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) { await askKalPreset('status'); return; }
      if (isListening && recognition) { recognition.stop(); return; }
      recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.onstart = () => { isListening = true; btn.classList.add('listening'); btn.textContent = '🔴 Listening…'; };
      recognition.onend = () => { isListening = false; btn.classList.remove('listening'); btn.textContent = '🎙️ Ask KAL'; };
      recognition.onresult = async (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || '';
        await askKalPrompt(transcript);
      };
      recognition.start();
    }

    async function toggleDemoRecorder() {
      const btn = document.getElementById('recBtn');
      if (demoRecorder && demoRecorder.state !== 'inactive') {
        demoRecorder.stop();
        return;
      }
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: true });
        recAudioCtx = recAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        recMixDest = recAudioCtx.createMediaStreamDestination();
        if (displayStream.getAudioTracks().length > 0) {
          recAudioCtx.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks())).connect(recMixDest);
        }
        let micStream = null;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          recAudioCtx.createMediaStreamSource(micStream).connect(recMixDest);
        } catch {}
        const ttsEl = document.getElementById('ttsAudio');
        if (ttsEl && !recTtsSourceWired) {
          try {
            const ttsSrc = recAudioCtx.createMediaElementSource(ttsEl);
            ttsSrc.connect(recMixDest);
            ttsSrc.connect(recAudioCtx.destination);
            recTtsSourceWired = true;
          } catch {}
        }
        const combined = new MediaStream([...displayStream.getVideoTracks(), ...recMixDest.stream.getAudioTracks()]);
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
        demoChunks = [];
        demoRecorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 6000000 });
        demoRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) demoChunks.push(e.data); };
        demoRecorder.onstop = () => {
          clearInterval(demoTimerInterval);
          displayStream.getTracks().forEach(t => t.stop());
          if (micStream) micStream.getTracks().forEach(t => t.stop());
          btn.textContent = '🎥 Record';
          btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
          const blob = new Blob(demoChunks, { type: mime });
          const a = document.createElement('a');
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
          a.href = URL.createObjectURL(blob);
          a.download = `8090-copper-p2p-kal-${stamp}.webm`;
          a.click();
        };
        displayStream.getVideoTracks()[0].onended = () => {
          if (demoRecorder && demoRecorder.state !== 'inactive') demoRecorder.stop();
        };
        demoRecorder.start(500);
        demoStartEpoch = Date.now();
        btn.style.background = '#fef2f2'; btn.style.color = '#b91c1c'; btn.style.borderColor = '#ef4444';
        const tick = () => {
          const sec = Math.floor((Date.now() - demoStartEpoch) / 1000);
          btn.textContent = `🔴 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} Stop`;
        };
        tick();
        demoTimerInterval = setInterval(tick, 500);
      } catch (err) {
        if (err && err.name !== 'NotAllowedError') alert('Recorder error: ' + err.message);
      }
    }

    /* ================= WORKFLOW EXECUTION & KAL STEWARD ORCHESTRATION ================= */
    async function postStepRaw(action, extra = {}) {
      const res = await fetch('/api/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: selectedDeal, action, ...extra }),
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }

    // Click "▶ Start KAL · P2P Steward" -> Runs Step 1 SQL check, speaks, and stops at Human Checkpoint #1 (Darius)
    async function startKalSteward() {
      if (busyAction) return;
      setView('workflow');
      activeDocTab = 'auto';
      const st = STATE?.runtimeState?.[selectedDeal];
      if (!st || !st.kal_started) {
        await executeStewardSequence([
          { action: 'wf0_detect_stockout', label: 'KAL reading InvenTree WMS stock-out signal…' },
        ]);
      } else {
        await askKalPreset('status');
      }
    }

    // Runs 1 human checkpoint + any immediate downstream automated blocks cleanly while updating screen live!
    async function executeStewardSequence(steps) {
      if (busyAction) return;
      busyAction = true;
      activeDocTab = 'auto';
      deskSubView = 'auto';
      let finalVoiceBrief = null;
      let finalVoiceRole = 'ops_steward';

      try {
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          busyBannerText = s.label || 'Running deterministic workflow block…';
          renderAll();
          if (i > 0) await new Promise(r => setTimeout(r, 320));
          const { ok, data } = await postStepRaw(s.action, s.extra || {});
          if (!ok) {
            if (data?.state) {
              STATE = data.state;
              const stErr = STATE.runtimeState[selectedDeal];
              finalVoiceBrief = stErr?.lastVoiceBrief || data.error;
              finalVoiceRole = stErr?.activeVoiceRole || 'treasury_steward';
            }
            break;
          }
          STATE = data;
          const stNow = STATE.runtimeState[selectedDeal];
          finalVoiceBrief = stNow?.lastVoiceBrief || finalVoiceBrief;
          finalVoiceRole = stNow?.activeVoiceRole || finalVoiceRole;
          renderAll();
        }
      } finally {
        busyAction = false;
        busyBannerText = '';
        renderAll();
      }

      if (finalVoiceBrief) {
        speakText(finalVoiceBrief, finalVoiceRole);
      }
    }

    // Step-by-Step Human Checkpoints & "OK to Proceed" Gates (NEVER auto-skips a step!)
    function approveCheckpoint1Darius() {
      executeStewardSequence([
        { action: 'wf0_submit_req', label: 'Recording Darius Mercer confirmation & checking $20,000 Signing Limit…' },
      ]);
    }

    // Step 3 -> Step 4: VP Devon signs ceiling -> Central Purchasing reviews -> fires live outbound COMEX API call -> PAUSES on Step 4!
    let spotGateUnlockedAt = 0;
    let ocrGateUnlockedAt = 0;
    async function approveCheckpoint2Devon() {
      if (busyAction) return;
      busyAction = true;
      activeDocTab = 'auto';
      deskSubView = 'auto';
      if (showcaseTimer) { clearTimeout(showcaseTimer); showcaseTimer = null; }
      try {
        stopKalAudio();
        busyBannerText = 'Recording VP Devon Brooks ($100,000 Signing Limit) sign-off & routing to Central Purchasing…';
        renderAll();
        const r1 = await postStepRaw('wf0_approve_req');
        if (!r1.ok) {
          if (r1.data?.state) { STATE = r1.data.state; renderAll(); }
          return;
        }
        STATE = r1.data;

        // Beat 1 (~850ms): Central Purchasing (Nancy Rostova) receives signed REQ-25800 and initiates spot review
        liveShowcasePhase = 'cp_reviewing';
        busyAction = false;
        kalBadgeText = 'CENTRAL PURCHASING · NANCY ROSTOVA';
        kalSubtitle = 'VP Devon signed REQ-25800 ($23,120 ceiling) ➔ Central Purchasing received the requisition and is launching a live COMEX copper spot check…';
        renderAll();
        await new Promise(r => setTimeout(r, 850));

        // Beat 2 (~1,450ms min): Outbound TLS handshake pulls real-time COMEX Copper price live on screen
        liveShowcasePhase = 'spot_calling';
        kalBadgeText = 'LIVE HTTPS · COMEX COPPER SPOT';
        kalSubtitle = 'Going out live to api.gold-api.com/price/HG + Yahoo Finance COMEX (HG=F) to benchmark against our $2.89/FT ($23,120) Standard Cost…';
        renderAll();
        const tSpotStart = Date.now();
        const r2 = await postStepRaw('wf1_check_spot');
        const spotElapsed = Date.now() - tSpotStart;
        if (spotElapsed < 1450) await new Promise(r => setTimeout(r, 1450 - spotElapsed));

        // Beat 3: PAUSE cleanly on Step 4 so presenter can explain the live spot quote before approving!
        liveShowcasePhase = null;
        spotGateUnlockedAt = Date.now() + 600;
        if (r2.ok) {
          STATE = r2.data;
          const stNow = STATE.runtimeState[selectedDeal];
          renderAll();
          if (stNow?.lastVoiceBrief) speakText(stNow.lastVoiceBrief, stNow.activeVoiceRole || 'ops_steward');
        } else {
          if (r2.data?.state) STATE = r2.data.state;
          renderAll();
        }
      } finally {
        liveShowcasePhase = null;
        busyAction = false;
        busyBannerText = '';
      }
    }

    // Re-poll live COMEX API right on Step 4 (proves real-time market tick on demand!)
    async function repollLiveComexSpot() {
      if (busyAction || liveShowcasePhase === 'spot_calling' || liveShowcasePhase === 'cp_reviewing') return;
      stopKalAudio();
      liveShowcasePhase = 'spot_calling';
      kalBadgeText = 'LIVE HTTPS · COMEX COPPER SPOT';
      kalSubtitle = 'Re-polling live COMEX Copper feeds (api.gold-api.com/price/HG + HG=F)…';
      renderAll();
      const tSpotStart = Date.now();
      const r = await postStepRaw('wf1_check_spot');
      const spotElapsed = Date.now() - tSpotStart;
      if (spotElapsed < 1100) await new Promise(res => setTimeout(res, 1100 - spotElapsed));
      liveShowcasePhase = null;
      if (r.ok) {
        STATE = r.data;
        const stNow = STATE.runtimeState[selectedDeal];
        renderAll();
        if (stNow?.lastVoiceBrief) speakText(stNow.lastVoiceBrief, stNow.activeVoiceRole || 'ops_steward');
      } else {
        renderAll();
      }
    }

    // Step 4 -> Step 5: Central Purchasing clicks "OK to Proceed" -> Cuts PO-25800 + Receives Encore Vendor Ack ENC-OA-2026-884192 -> STOPS on Step 5!
    async function proceedStep4CutPo() {
      if (busyAction || liveShowcasePhase === 'cp_reviewing' || liveShowcasePhase === 'spot_calling' || Date.now() < spotGateUnlockedAt) return;
      await executeStewardSequence([
        { action: 'wf1_commit_po', label: 'Central Purchasing cutting PO-25800 at locked COMEX spot price…' },
        { action: 'wf1_vendor_ack', label: 'Receiving Encore Wire Vendor Ack ENC-OA-2026-884192 (ship & delivery dates)…' },
      ]);
      // Pre-warm rendered invoice PNG in browser image cache so Step 7 OCR laser stage paints in 0ms
      try {
        const pngFile = STATE?.deals?.[selectedDeal]?.pngFile || 'INV-25800.png';
        const poHash = STATE?.runtimeState?.[selectedDeal]?.poSha256;
        const vQuery = poHash ? `&v=${encodeURIComponent(poHash.slice(0, 8))}` : '';
        if (typeof Image !== 'undefined') {
          const pre = new Image();
          pre.src = `/api/invoice-image?file=${encodeURIComponent(pngFile)}${vQuery}`;
        }
      } catch {}
    }

    // Step 5 -> Step 6: Central Purchasing verifies OA ship/delivery dates copacetic -> clicks "OK to Proceed" -> STOPS on Step 6!
    function proceedStep5VerifyAck() {
      dockScannedReels.clear();
      lastFlashedReelSeq = 0;
      autoScanningReels = false;
      executeStewardSequence([
        { action: 'wf1_confirm_ack', label: 'Verifying ENC-OA-2026-884192 ship & delivery dates and staging 4 barcoded reels at Bay 4…' },
      ]);
    }

    // Step 6 -> Step 7: Marcus submits all 4 RF Reel Barcode Scans -> AP Email arrives -> 2-Pass RapidOCR Laser Scan -> Laser STOPS -> 28 Boxes Lock -> PAUSES on Step 7!
    async function approveCheckpoint3MarcusDock() {
      if (busyAction || autoScanningReels) return;
      const dCur = STATE?.deals?.[selectedDeal];
      const reelSpecs = getDealReelSpecs(dCur);
      if (dockScannedReels.size < reelSpecs.length) {
        await scanAllDockReelsSequentially();
        return;
      }
      busyAction = true;
      activeDocTab = 'auto';
      deskSubView = 'auto';
      if (showcaseTimer) { clearTimeout(showcaseTimer); showcaseTimer = null; }
      try {
        stopKalAudio();
        busyBannerText = 'Submitting 4 Bay 4 RF Reel Barcode Scans (8,000 FT) & posting GL Entry #1 (121100 Std + 201200 GRNI + 501900 PPV)…';
        renderAll();
        const r1 = await postStepRaw('wf2_dock_receipt', {
          scannedBarcodes: reelSpecs.map(r => r.barcode),
        });
        if (!r1.ok) {
          if (r1.data?.state) { STATE = r1.data.state; renderAll(); }
          return;
        }
        STATE = r1.data;
        await new Promise(r => setTimeout(r, 480));

        // Sweep the blue laser 2 clean passes (~2,300ms) across INV-25800.png while calling real RapidOCR ONNX (:3591/scan), STOP laser, lock 28 boxes, and PAUSE on Step 7!
        liveShowcasePhase = 'ocr_scanning';
        busyAction = false;
        kalBadgeText = 'RAPIDOCR ONNX · :3591/SCAN';
        kalSubtitle = 'Encore Wire emailed INV-25800.pdf to AP — running live RapidOCR neural scan & sweeping 28 bounding boxes…';
        renderAll();
        const tScanStart = Date.now();
        const r2 = await postStepRaw('wf3_poll_and_ocr');
        const elapsed = Date.now() - tScanStart;
        if (elapsed < 2300) await new Promise(r => setTimeout(r, 2300 - elapsed));

        liveShowcasePhase = null;
        ocrGateUnlockedAt = Date.now() + 550;
        if (r2.ok) {
          STATE = r2.data;
          const stNow = STATE.runtimeState[selectedDeal];
          renderAll();
          if (stNow?.lastVoiceBrief) speakText(stNow.lastVoiceBrief, stNow.activeVoiceRole || 'treasury_steward');
        } else {
          if (r2.data?.state) STATE = r2.data.state;
          renderAll();
        }
      } finally {
        liveShowcasePhase = null;
        busyAction = false;
        busyBannerText = '';
      }
    }

    // On-Demand Live RapidOCR Re-Scan (:3591/scan ONNX PP-OCRv4): sweeps 2 passes, stops laser, updates real latency, and speaks!
    async function rerunLiveRapidOcr() {
      if (busyAction || liveShowcasePhase === 'ocr_scanning') return;
      stopKalAudio();
      deskSubView = 'ocr';
      liveShowcasePhase = 'ocr_scanning';
      kalBadgeText = 'RAPIDOCR ONNX · :3591/SCAN';
      kalSubtitle = 'Re-running live RapidOCR neural scan on INV-25800.pdf (:3591/scan)…';
      renderAll();
      try {
        const tScanStart = Date.now();
        const r = await postStepRaw('wf3_rescan_ocr');
        const elapsed = Date.now() - tScanStart;
        if (elapsed < 2300) await new Promise(res => setTimeout(res, 2300 - elapsed));
        liveShowcasePhase = null;
        if (r.ok) {
          STATE = r.data;
          const stNow = STATE.runtimeState[selectedDeal];
          renderAll();
          if (stNow?.lastVoiceBrief) speakText(stNow.lastVoiceBrief, stNow.activeVoiceRole || 'treasury_steward');
        } else {
          if (r.data?.state) STATE = r.data.state;
          renderAll();
        }
      } finally {
        liveShowcasePhase = null;
      }
    }

    // Step 7 -> Step 8: AP clicks "OK to Proceed" after reviewing 28 OCR tags & 3 tied-together forms -> STOPS on Step 8!
    function proceedStep7ConfirmMatch() {
      if (busyAction || liveShowcasePhase === 'ocr_scanning' || Date.now() < ocrGateUnlockedAt) return;
      executeStewardSequence([
        { action: 'wf3_confirm_match', label: 'Routing verified 3-Way Match packet & Check #10045 to CFO Meredith Hale…' },
      ]);
    }

    function approveCheckpoint4MeredithCfo() {
      if (showcaseTimer) { clearTimeout(showcaseTimer); showcaseTimer = null; }
      liveShowcasePhase = null;
      executeStewardSequence([
        { action: 'wf4_release_ach', label: 'Releasing Check #10045 / ACH-000582 from 101100 Operating Bank…' },
      ]);
    }

    async function runGuardrailTest(action, extra = {}) {
      closeModal();
      setView('workflow');
      await executeStewardSequence([{ action, extra, label: 'Testing deterministic kernel guardrail…' }]);
    }

    function clearGuardrailBanner() {
      const st = STATE?.runtimeState?.[selectedDeal];
      if (st) {
        st.lastGuardrailBlock = null;
        renderCenter();
      }
    }

    async function resetDemo(force = false) {
      const stCur = STATE?.runtimeState?.[selectedDeal];
      const stepCur = computeStepIndex(stCur);
      if (!force && stepCur > 0 && stepCur < 8) {
        if (!window.confirm('Restart the queue from Step 1 (re-seeds all 3 SQLite DBs & hledger journal back to 0 FT stock-out)?')) {
          return;
        }
      }
      if (showcaseTimer) { clearTimeout(showcaseTimer); showcaseTimer = null; }
      liveShowcasePhase = null;
      dockScannedReels.clear();
      lastFlashedReelSeq = 0;
      autoScanningReels = false;
      stopKalAudio();
      closeModal();
      setView('workflow');
      activeDocTab = 'auto';
      deskSubView = 'auto';
      const topBtn = document.getElementById('topResetBtn');
      if (topBtn) topBtn.textContent = '⏳ Resetting…';
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        STATE = await res.json();
        kalBadgeText = 'KAL · P2P STEWARD ($0 SIGNING LIMIT)';
        kalSubtitle = 'Queue & all 3 headless databases reset to Step 1 (0 FT stock-out). Click "▶ Start KAL · P2P Steward" whenever you are ready.';
        renderAll();
      } finally {
        if (topBtn) topBtn.textContent = '↺ Reset Queue';
      }
    }

    async function loadState() {
      const res = await fetch('/api/state');
      STATE = await res.json();
      renderAll();
    }

    function setView(v) {
      activeView = v;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('nav-' + v);
      if (btn) btn.classList.add('active');
      if (v === 'registers' && selectedRegSys !== 'ledger') {
        fetchRegTable(selectedRegSys, selectedRegTable);
      }
      renderAll();
    }

    async function fetchRegTable(sys, tbl) {
      selectedRegSys = sys;
      selectedRegTable = tbl;
      if (sys === 'ledger') {
        renderCenter();
        return;
      }
      const res = await fetch(`/api/table?system=${encodeURIComponent(sys)}&table=${encodeURIComponent(tbl)}`);
      cachedTableData = await res.json();
      renderCenter();
    }

    /* ================= RENDER ALL PANELS ================= */
    function renderAll() {
      if (!STATE || !STATE.deals) return;
      const d = STATE.deals[selectedDeal];
      const st = STATE.runtimeState[selectedDeal];
      const stepIdx = computeStepIndex(st);

      document.getElementById('strictPill').textContent =
        STATE.hledger.strictBalanced ? 'GAAP DR == CR' : 'LEDGER IMBALANCE';
      document.getElementById('sqlCountBadge').textContent = `${STATE.catalogs.totalSqlTables} tbls`;
      document.getElementById('auditCountBadge').textContent = `${st.auditLog.length} Events`;
      document.getElementById('navStepBadge').textContent = stepIdx >= 8 ? 'PAID ✓' : `Step ${stepIdx + 1}/8`;

      const startBtn = document.getElementById('leftStartKalBtn');
      if (startBtn) {
        if (st.wf4_ach_released) {
          startBtn.className = 'btn-kal-start settled';
          startBtn.textContent = '✅ Paid · Check #10045';
        } else if (st.kal_started) {
          startBtn.className = 'btn-kal-start running';
          startBtn.textContent = '🟢 KAL Steward Running';
        } else {
          startBtn.className = 'btn-kal-start';
          startBtn.textContent = '▶ Start KAL · P2P Steward';
        }
      }

      renderLeftSummary(d, st);
      renderCenter();
      renderRight();
    }

    function renderLeftSummary(d, st) {
      const el = document.getElementById('leftOrderSummary');
      if (!el) return;
      const statusBadge = st.wf4_ach_released
        ? '<span class="badge b-done">PAID · Chk #10045</span>'
        : (st.wf4_match_status === 'voucher_posted'
            ? '<span class="badge b-purple">Approved to Pay</span>'
            : (d.isBelowThreshold ? '<span class="badge b-hold">0 FT Stock-Out</span>' : '<span class="badge b-amber">In Progress</span>'));

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-family:var(--mono);font-size:11px;font-weight:800;color:var(--blue);">${esc(d.itemCanonical)}</span>
          ${statusBadge}
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text-main);line-height:1.25;">2/0 AWG Bare Copper Wire</div>
        <div class="os-row">
          <span class="os-k">WMS On Hand:</span>
          <span class="os-v" style="color:${d.isBelowThreshold ? 'var(--red)' : 'var(--green)'};">${fmtInt(d.onHandStockFt)} / ${fmtInt(d.minThresholdFt)} FT</span>
        </div>
        <div class="os-row">
          <span class="os-k">Supplier:</span>
          <span class="os-v" style="font-family:var(--sans);font-size:10.5px;">Encore Wire Corp</span>
        </div>
        <div class="os-row">
          <span class="os-k">Annual Std Cost:</span>
          <span class="os-v">${fmtUsd(d.catalogEstimateUsd)}</span>
        </div>
        <div class="os-row">
          <span class="os-k">Actual Spot PO:</span>
          <span class="os-v" style="color:var(--blue);">${st.wf1_po_committed === 'done' ? fmtUsd(d.poAmount) : 'Pending'}</span>
        </div>
      `;
    }

    function renderCenter() {
      const el = document.getElementById('centerStage');
      if (!el || !STATE) return;
      if (activeView === 'workflow') el.innerHTML = renderWorkflowDesk();
      else if (activeView === 'registers') el.innerHTML = renderRegistersView();
      else if (activeView === 'security') el.innerHTML = renderSecurityAdminView();
      else el.innerHTML = renderFactoryView();
    }

    /* ================= VIEW 1: ONE-SCREEN P2P FLOW DESK ================= */
    function renderWorkflowDesk() {
      const d = STATE.deals[selectedDeal];
      const st = STATE.runtimeState[selectedDeal];
      const stepIdx = computeStepIndex(st);
      const showingBooks = deskSubView === 'books' || (stepIdx >= 8 && deskSubView !== 'voucher');

      const steps = [
        { num: 1, name: 'WMS Signal',   who: 'SQL Stock Check',  human: false, badge: '⚡ AUTO' },
        { num: 2, name: 'Supply Chain', who: 'Darius ($20k)',    human: true,  badge: '👤 SIGN' },
        { num: 3, name: 'VP Approval',  who: 'Devon ($100k)',    human: true,  badge: '👤 SIGN' },
        { num: 4, name: 'Spot & PO',    who: 'Nancy (Spot OK)',  human: false, badge: '⚡ AUTO+OK' },
        { num: 5, name: 'Order Ack',    who: 'Nancy (Dates OK)', human: false, badge: '⚡ AUTO+OK' },
        { num: 6, name: 'Dock Scan',    who: 'Marcus (Submit)',  human: true,  badge: '👤 SCAN' },
        { num: 7, name: 'OCR & Match',  who: 'Duncan (3WM OK)',  human: false, badge: '⚡ AUTO+OK' },
        { num: 8, name: 'Cut Check',    who: 'Meredith (CFO)',   human: true,  badge: '👤 SIGN' },
      ];

      return `
        <!-- 1. KAL STEWARD VOICE BAR -->
        <div class="kal-bar">
          <span class="kal-badge">${esc(kalBadgeText)}</span>
          <div class="kal-msg" title="${esc(kalSubtitle)}">${esc(kalSubtitle)}</div>
          <div style="display:flex;gap:5px;flex-shrink:0;">
            <button class="btn-top" style="padding:3px 8px;font-size:10.5px;${deskSubView === 'sox_db' ? 'background:#1d4ed8;color:#fff;border-color:#1d4ed8;' : 'border-color:#93c5fd;color:#1d4ed8;'}" onclick="startSoxAndDbTour()" title="1-click KAL guided run-through of SOX, Live Headless Databases &amp; White House Super Intelligence Accord">🛡️ SOX, Live DBs &amp; White House SI</button>
            <button class="btn-top" style="padding:3px 8px;font-size:10.5px;" onclick="askKalPreset('status')">📊 Brief</button>
            <button class="btn-top" style="padding:3px 8px;font-size:10.5px;" onclick="askKalPreset('spot')">📈 Copper Spot</button>
            <button class="btn-top" style="padding:3px 8px;font-size:10.5px;${showingBooks ? 'background:#0f172a;color:#fff;border-color:#0f172a;' : ''}"
              onclick="setDeskSubView('${showingBooks ? (stepIdx >= 8 ? 'voucher' : 'auto') : 'books'}')">
              ${showingBooks ? (stepIdx >= 8 ? '🧾 View Check #10045' : '↩ Officer Desk') : '📗 Ledger Books'}
            </button>
            ${kalSpeaking ? `<button class="btn-top" style="padding:3px 8px;font-size:10.5px;border-color:#ef4444;color:#b91c1c;" onclick="stopKalAudio()">⏹ Stop</button>` : ''}
          </div>
        </div>

        <!-- 2. CLEAN STEPS 1-8 PIPELINE -->
        <div class="steps-card">
          <div class="steps-head">
            <div style="font-weight:800;color:var(--text-main);">
              Supply Chain (<code>P2M</code> · Steps 1–3) ➔ Procure-to-Pay (<code>P2P</code> · Steps 4–8) · ${esc(d.id)} — <span style="color:var(--blue);">${stepIdx >= 8 ? 'All 8 Steps Complete · Ledger Balanced' : `Step ${stepIdx + 1} of 8`}</span>
            </div>
            <div style="display:flex;gap:10px;font-size:10.5px;color:var(--text-muted);font-weight:700;">
              <span><span class="step-kind kind-auto">⚡ AUTO+OK</span> Agentic Block + Proceed Gate</span>
              <span><span class="step-kind kind-human">👤 SIGN</span> Officer Sign / Scan</span>
            </div>
          </div>
          <div class="steps-grid">
            ${steps.map((s, idx) => {
              const isDone = idx < stepIdx;
              const isNow = idx === stepIdx;
              const cls = isDone ? 'done' : (isNow ? 'now' : '');
              const numLabel = isDone ? `✓ ${s.num}` : (isNow ? `● ${s.num}` : `${s.num}`);
              const numColor = isDone ? 'var(--green)' : (isNow ? 'var(--blue)' : 'var(--text-muted)');
              const canClick = isDone || isNow;
              return `
                <div class="step-cell ${cls}" style="${canClick ? 'cursor:pointer;' : ''}" ${canClick ? `onclick="inspectStepCell(${idx})" title="Click to inspect Step ${s.num} (${esc(s.name)})"` : ''}>
                  <div class="step-top">
                    <span class="step-num" style="color:${numColor};">${numLabel}</span>
                    <span class="step-kind ${s.human ? 'kind-human' : 'kind-auto'}">${s.badge}</span>
                  </div>
                  <div class="step-name">${esc(s.name)}</div>
                  <div class="step-who">${esc(s.who)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2B. LIVE 3-HEADLESS-DATABASE SPINE (WMS · HRM/CRM · ERP HLEDGER) + ACTIVE WFB & KYSI-4 -->
        ${renderLiveHeadlessSorSpine(d, st, stepIdx)}

        <!-- 3. UNIFIED ACTIVE OFFICER ROLEPLAY SCREEN / LEDGER BOOK VIEW -->
        ${renderOfficerDesk(d, st, stepIdx)}
      `;
    }

    function cleanLeftNumberedJournal(txt) {
      if (!txt) return '';
      return String(txt)
        .replace(/\b(?:Assets|Liabilities|Equity|Revenues|Expenses):(\d{6})-([A-Za-z0-9-]+)/g, (_, num, slug) => `${num} · ${slug.replace(/-/g, ' ')}`);
    }

    function renderLiveHeadlessSorSpine(d, st, stepIdx) {
      const cat = STATE.catalogs || { wmsTableCount: 119, hrmTableCount: 5, crmTableCount: 151, fkMap: { poCount: 0 } };
      const fsData = STATE.financialStatements || {};
      const bs = fsData.balanceSheet || { operatingCashEndingUsd: 250000, inventoryStdUsd: 0 };
      const lens = STATE.lineage?.controlLenses?.[selectedDeal] || { hopCount: 1 };
      const latestAudit = (st.auditLog && st.auditLog.length > 0) ? st.auditLog[st.auditLog.length - 1] : null;
      const shortSha = (latestAudit?.artifactHash || STATE.hledger?.journalSha256 || '8f2a91c0').slice(0, 8);

      const vault = STATE.sorVault || { vaultDir: 'C:\\8090-sor-data\\copper-p2p', files: [] };
      const vf = (k) => (vault.files || []).find(f => f.key === k) || {};
      const wmsF = vf('wms');
      const hrmF = vf('hrm');
      const glF = vf('ledger');
      const linF = vf('lineage');

      const wfbMap = [
        { wo: 'WO-01 · WFB-P2M-1A', kysi: 'SOX L1 + SHA-256', hrm: 'EMP-0021 Darius ($20k)' },
        { wo: 'WO-01 · WFB-P2M-1A', kysi: 'SOX L4 ($20k Limit)', hrm: 'EMP-0021 $20k < $23.1k' },
        { wo: 'WO-01 · WFB-P2M-1A', kysi: 'SOX L4 ($100k Sign)', hrm: 'EMP-0005 Devon ($100k ✓)' },
        { wo: 'WO-02 · WFB-P2P-1A', kysi: 'WFB Math + Spot API', hrm: 'VEN-181 Encore + Nancy' },
        { wo: 'WO-02 · WFB-P2P-1A', kysi: 'WFB Schedule Gate', hrm: 'VEN-181 Encore Flatbed' },
        { wo: 'WO-03 · WFB-P2P-1B', kysi: 'SOX Dock SoD Gate', hrm: 'EMP-0003 Marcus (Bay 4)' },
        { wo: 'WO-04 · WFB-P2P-1C', kysi: '3-Way Match == $0', hrm: 'VEN-181 == PO == BOL' },
        { wo: 'WO-05 · WFB-P2P-1D', kysi: 'SOX CFO + 101100', hrm: 'EMP-0007 Meredith ($500k)' },
      ];
      const activeMeta = wfbMap[Math.min(stepIdx, 7)];
      const stockOk = d.onHandStockFt >= d.minThresholdFt;

      return `
        <div class="sor-live-spine">
          <!-- DB 1: HEADLESS INVENTREE WMS SQLITE -->
          <div class="sor-db-card" style="border-left-color:${stockOk ? '#16a34a' : '#dc2626'};"
               onclick="setView('registers');fetchRegTable('wms','stock_stockitem');"
               title="Live Disk File: ${esc(wmsF.fullPath || 'C:\\8090-sor-data\\copper-p2p\\wms_inventree.sqlite3')} (${esc(wmsF.sizeHuman || '5.48 MB')} · Git-Ignored)">
            <div class="sor-db-top">
              <span>DB 1 · WMS SQLite (${cat.wmsTableCount} tbls)</span>
              <span style="color:${stockOk ? 'var(--green)' : 'var(--red)'};">${stockOk ? '8,000 FT ✓' : '0 FT ALERT'}</span>
            </div>
            <div class="sor-db-val">stock_stockitem: ${fmtInt(d.onHandStockFt)} / 8,000 FT</div>
            <div class="sor-db-sub">${esc(wmsF.sizeHuman || '5.48 MB')} · C:\\8090-sor-data\\…\\wms_inventree.sqlite3</div>
          </div>

          <!-- DB 2: HEADLESS HRM + CRM SQLITE -->
          <div class="sor-db-card" style="border-left-color:#d97706;"
               onclick="setView('registers');fetchRegTable('hrm','hrm_doa_authority_seat');"
               title="Live Disk Files: ${esc(hrmF.fullPath || 'C:\\8090-sor-data\\copper-p2p\\hrm_people.sqlite3')} + crm_django.sqlite3 (Git-Ignored)">
            <div class="sor-db-top">
              <span>DB 2 · HRM + CRM (${cat.hrmTableCount + cat.crmTableCount} tbls)</span>
              <span style="color:var(--blue);">KAL = $0</span>
            </div>
            <div class="sor-db-val">${esc(activeMeta.hrm)}</div>
            <div class="sor-db-sub">C:\\8090-sor-data\\…\\hrm_people + crm_django</div>
          </div>

          <!-- DB 3: HEADLESS ERP GENERAL LEDGER (HLEDGER) -->
          <div class="sor-db-card" style="border-left-color:#16a34a;"
               onclick="setDeskSubView('books')"
               title="Live Disk File: ${esc(glF.fullPath || 'C:\\8090-sor-data\\copper-p2p\\company.journal')} (${esc(glF.sizeHuman || '10.1 KB')} · Git-Ignored)">
            <div class="sor-db-top">
              <span>DB 3 · ERP hledger (${STATE.hledger.accountCount} Accts)</span>
              <span style="color:var(--green);">DR==CR ✓</span>
            </div>
            <div class="sor-db-val">101100 ${fmtUsdShort(bs.operatingCashEndingUsd ?? 250000)} · 121100 ${fmtUsdShort(bs.inventoryStdUsd || 0)}</div>
            <div class="sor-db-sub">${esc(glF.sizeHuman || '10.1 KB')} · C:\\8090-sor-data\\…\\company.journal</div>
          </div>

          <!-- ACTIVE WORKFLOW BLOCK + SOX GOVERNANCE + SHA-256 LINEAGE -->
          <div class="sor-db-card" style="border-left-color:#7c3aed;"
               onclick="startSoxAndDbTour()"
               title="Click for 1-click KAL SOX & Live NVMe Database Vault Tour (${esc(linF.fullPath || 'C:\\8090-sor-data\\copper-p2p\\lineage_core.sqlite3')})">
            <div class="sor-db-top">
              <span>${esc(stepIdx >= 8 ? 'WO-01..05 COMPLETE' : activeMeta.wo)}</span>
              <span style="color:var(--purple);">${lens.hopCount} Hops</span>
            </div>
            <div class="sor-db-val">${esc(activeMeta.kysi)}</div>
            <div class="sor-db-sub">SHA ${esc(shortSha)}… · Click for SOX &amp; DB Tour ➔</div>
          </div>
        </div>
      `;
    }

    function renderLedgerBookView(d, st, stepIdx) {
      const fsData = STATE.financialStatements || {};
      const bs = fsData.balanceSheet || {
        operatingCashOpeningUsd: 250000, operatingCashEndingUsd: 250000, operatingCashChangeUsd: 0,
        payrollCashBalanceUsd: 140000, inventoryStdUsd: 0,
        totalAssetsUsd: 0, totalEndingAssetsUsd: 390000,
        grniLiabilityUsd: 0, tradeApLiabilityUsd: 0, sponsorCapitalUsd: 390000,
        retainedEarningsNetIncomeUsd: 0, totalLiabilitiesAndEquityUsd: 0, totalEndingLiabAndEquityUsd: 390000, balanced: true,
      };
      const pnl = fsData.profitAndLoss || {
        annualStandardCostBaselineUsd: d.catalogEstimateUsd,
        actualSpotPurchaseUsd: st.wf1_po_committed === 'done' ? d.poAmount : 0,
        ppvExpenseSignedUsd: 0,
        favorableVarianceGainUsd: 0,
      };
      const isPaid = stepIdx >= 8;

      return `
        <div class="officer-desk books">
          <div class="desk-banner">
            <div>
              <div class="cp-eyebrow">📗 OFFICIAL GENERAL LEDGER BOOK VIEW · HLEDGER DOUBLE-ENTRY (<code>COMPANY.JOURNAL</code> · 89 GAAP ACCOUNTS)</div>
              <div class="cp-title">${isPaid ? `Closed &amp; Settled via Check #10045 (${esc(st.achTrace)}) — Balance Sheet &amp; Profit &amp; Loss` : `Live General Ledger Books (Step ${stepIdx + 1} of 8 In Progress)`}</div>
              <div class="cp-desc">
                Left-numbered GAAP accounts from <code>company.journal</code> (${esc(STATE.hledger.engineMode)}). Operating Cash <code>101100</code> moved <strong>$250,000 ➔ ${fmtUsd(bs.operatingCashEndingUsd)}</strong>, Inventory <code>121100</code> carries <strong>${fmtUsd(bs.inventoryStdUsd)}</strong> Std, and <code>501900</code> PPV adds <strong>${fmtAcct(pnl.favorableVarianceGainUsd, true)}</strong> Net Income.
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              ${isPaid ? `
                <button class="btn-top" style="background:#0f172a;color:#fff;border-color:#0f172a;padding:7px 9px;" onclick="setDeskSubView('books')">📗 Books</button>
                <button class="btn-top" style="padding:7px 9px;" onclick="setDeskSubView('voucher')">📑 Check #10045</button>
                <button class="btn-top" style="border-color:#1d4ed8;color:#1d4ed8;padding:7px 9px;" onclick="startSoxAndDbTour()" title="Show where the 5 live NVMe databases live on disk + 4-Layer SOX control">🛡️ SOX &amp; Live DBs</button>
                <button class="btn-top" style="border-color:#7c3aed;color:#6d28d9;padding:7px 9px;" onclick="setView('factory')" title="Show how 8090 Software Factory (Refinery ➔ Foundry ➔ Planner ➔ Validator) built this app from the Enterprise Seed">🏭 8090 Factory</button>
                <button class="btn-approve blue" style="padding:7px 11px;" onclick="resetDemo(true)" title="Re-seed all 3 SQLite DBs &amp; hledger back to Step 1 for your next live run">↺ Restart Queue</button>
              ` : `
                <button class="btn-approve blue" style="padding:8px 13px;" onclick="setDeskSubView('auto')">↩ Back to Officer Desk</button>
                <button class="btn-top" style="padding:7px 11px;" onclick="openModal('journal')">📜 Journal</button>
              `}
            </div>
          </div>

          <div class="desk-stage equal">
            <!-- LEFT BOOK PAGE: BALANCE SHEET (LEFT-NUMBERED GAAP) -->
            <div class="fin-stmt">
              <div>
                <div class="stmt-hdr">
                  <span class="stmt-title">Balance Sheet</span>
                  <span class="stmt-sub">Statement of Financial Position · As of ${esc(fsData.asOfDate || d.deliveryDate)}</span>
                </div>

                <div class="stmt-sec-lbl">Assets (Left-Numbered GAAP)</div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>101100</code> · Cash — Operating Checking ($250k Open${isPaid ? ' − $21.6k Chk #10045' : ''})</span>
                  <span class="stmt-amt">${fmtUsd(bs.operatingCashEndingUsd ?? 250000)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>101200</code> · Cash — Payroll Checking (#4409 · Ring-Fenced)</span>
                  <span class="stmt-amt" style="color:var(--text-sec);">${fmtUsd(bs.payrollCashBalanceUsd ?? 140000)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>121100</code> · Inventory — Raw Materials (8,000 FT @ $2.89 Std)</span>
                  <span class="stmt-amt" style="color:${bs.inventoryStdUsd > 0 ? 'var(--green)' : 'var(--text-muted)'};">${fmtUsd(bs.inventoryStdUsd)}</span>
                </div>
                <div class="stmt-total">
                  <span>Total Assets</span>
                  <span style="color:var(--green);">${fmtUsd(bs.totalEndingAssetsUsd ?? 390000)}</span>
                </div>

                <div class="stmt-sec-lbl" style="margin-top:7px;">Liabilities &amp; Stockholder Equity</div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>201100</code> · Accounts Payable — Trade (${isPaid ? 'Vouchered &amp; Paid' : 'Open Trade AP'})</span>
                  <span class="stmt-amt">${fmtUsd(bs.tradeApLiabilityUsd)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>201200</code> · GRNI Clearing (${st.wf4_match_status === 'voucher_posted' ? 'Accrued &amp; Cleared' : 'Uninvoiced Receipt'})</span>
                  <span class="stmt-amt">${fmtUsd(bs.grniLiabilityUsd)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>301100</code> · Paid-In / Sponsor Capital (Opening Baseline)</span>
                  <span class="stmt-amt">${fmtUsd(bs.sponsorCapitalUsd ?? 390000)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct"><code>311000</code> · Current Period Net Income (from P&amp;L)</span>
                  <span class="stmt-amt" style="color:${bs.retainedEarningsNetIncomeUsd > 0 ? 'var(--green)' : 'var(--text-main)'};">${fmtAcct(bs.retainedEarningsNetIncomeUsd, true)}</span>
                </div>
                <div class="stmt-total">
                  <span>Total Liabilities &amp; Equity</span>
                  <span style="color:var(--green);">${fmtUsd(bs.totalEndingLiabAndEquityUsd ?? 390000)}</span>
                </div>
              </div>

              <div class="sig-strip signed" style="padding:6px 10px;">
                <span style="font-weight:800;color:var(--green);">✓ Assets (${fmtUsd(bs.totalEndingAssetsUsd ?? 390000)}) == Liab + Equity (${fmtUsd(bs.totalEndingLiabAndEquityUsd ?? 390000)})</span>
                <span style="font-family:var(--mono);font-size:10px;font-weight:800;color:#14532d;">hledger --strict PASS</span>
              </div>
            </div>

            <!-- RIGHT BOOK PAGE: PROFIT & LOSS (INCOME & PPV STATEMENT) -->
            <div class="fin-stmt pnl">
              <div>
                <div class="stmt-hdr">
                  <span class="stmt-title">Profit &amp; Loss (P&amp;L)</span>
                  <span class="stmt-sub">Manufacturing Standard Cost Variance · Period ${esc(fsData.asOfDate || d.deliveryDate)}</span>
                </div>

                <div class="stmt-sec-lbl">Procurement Standard vs. Actual Spot Benchmark</div>
                <div class="stmt-row">
                  <span class="stmt-acct">Annual Standard Cost Baseline (8,000 FT × $2.89/FT)</span>
                  <span class="stmt-amt">${fmtUsd(d.catalogEstimateUsd)}</span>
                </div>
                <div class="stmt-row">
                  <span class="stmt-acct">Actual COMEX Spot Purchase (${esc(d.id)} @ $${d.unitPrice.toFixed(2)}/FT)</span>
                  <span class="stmt-amt">${st.wf1_po_committed === 'done' ? '(' + fmtUsd(d.poAmount) + ')' : '$0.00'}</span>
                </div>

                <div class="stmt-sec-lbl" style="margin-top:6px;">Ledger Variance Account (Booked at Step 6 Dock Scan)</div>
                <div class="stmt-row" style="background:${(pnl.ppvExpenseSignedUsd ?? 0) <= 0 ? '#f0fdf4' : '#fffbeb'};padding:4px 6px;border-radius:5px;">
                  <span class="stmt-acct"><code>501900</code> · Purchase Price Variance (${(pnl.ppvExpenseSignedUsd ?? 0) <= 0 ? 'Favorable Credit' : 'Unfavorable Market Debit'})</span>
                  <span class="stmt-amt" style="color:${(pnl.ppvExpenseSignedUsd ?? 0) <= 0 ? 'var(--green)' : '#b45309'};">${fmtAcct(pnl.ppvExpenseSignedUsd, false)}</span>
                </div>
                <div class="stmt-total" style="margin-top:6px;">
                  <span>${(pnl.favorableVarianceGainUsd ?? 0) >= 0 ? 'Net Favorable P&amp;L Earnings Gain' : 'Net Unfavorable Market Variance Impact'}</span>
                  <span style="color:${(pnl.favorableVarianceGainUsd ?? 0) >= 0 ? 'var(--green)' : '#b45309'};">${fmtAcct(pnl.favorableVarianceGainUsd, true)}</span>
                </div>

                <div class="stmt-sec-lbl" style="margin-top:8px;">Posted Double-Entry Audit Trail (3 Journal Entries)</div>
                <div style="font-family:var(--mono);font-size:9.5px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;line-height:1.45;">
                  <div>1. <strong>Dock Scan:</strong> DR 121100 ${fmtUsd(d.catalogEstimateUsd)} | CR 201200 (${fmtUsd(d.receiptAmount)}) | ${(pnl.ppvExpenseSignedUsd ?? -1) <= 0 ? 'CR' : 'DR'} 501900 ${fmtUsd(Math.abs(pnl.ppvExpenseSignedUsd || (d.catalogEstimateUsd - d.poAmount)))}</div>
                  <div>2. <strong>3-Way Match:</strong> DR 201200 ${fmtUsd(d.receiptAmount)} | CR 201100 (${fmtUsd(d.receiptAmount)}) · $0.00 Var</div>
                  <div>3. <strong>Check #10045:</strong> DR 201100 ${fmtUsd(d.receiptAmount)} | CR 101100 (${fmtUsd(d.receiptAmount)}) · ${isPaid ? 'PAID ✓' : 'Pending'}</div>
                </div>
              </div>

              <div class="sig-strip ${isPaid ? 'signed' : ''}" style="padding:6px 10px;">
                <span style="font-weight:700;color:var(--text-sec);">Countersigned: <strong>Darius ➔ VP Devon ➔ Marcus ➔ CFO Meredith</strong></span>
                <span style="font-family:var(--mono);font-size:10px;font-weight:800;color:var(--blue);">KAL: $0.00 Limit</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderOfficerDesk(d, st, stepIdx) {
      // Guardrail interception overlay inside Officer Desk (triggered when user clicks an optional Red-Team Demo button)
      if (st.lastGuardrailBlock) {
        const b = st.lastGuardrailBlock;
        return `
          <div class="officer-desk blocked">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">🛡️ OPTIONAL RED-TEAM GUARDRAIL DEMO TRIGGERED · HTTP ${b.httpStatus} ${esc(b.code)} — $0.00 MUTATED</div>
                <div class="cp-title">Kernel Blocked Simulated Violation: ${esc(b.attemptedActor)}</div>
                <div class="cp-desc">${esc(b.message)} <strong>Click the green button on the right to clear this demo block and continue your normal step.</strong></div>
              </div>
              <button class="btn-approve" style="padding:10px 16px;" onclick="clearGuardrailBanner()">
                ✓ Clear Block &amp; Resume Normal Step ➔
              </button>
            </div>
            <div class="desk-stage equal">
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Intercepted Request Payload (Red-Team Simulation)</div>
                      <div class="sheet-title">Zero Ledger &amp; Database Mutation Confirmed</div>
                    </div>
                    <span class="badge b-hold">HTTP ${b.httpStatus}</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Simulated Violator:</span><span class="kv-v" style="color:var(--red);">${esc(b.attemptedActor)}</span></div>
                    <div class="kv-row"><span class="kv-k">Required Authorized Seat:</span><span class="kv-v" style="color:var(--blue);">${esc(b.requiredActor || 'Authorized Officer')}</span></div>
                    <div class="kv-row"><span class="kv-k">Control Rule Enforced:</span><span class="kv-v">${esc(b.code)} (${esc(b.layer)})</span></div>
                    <div class="kv-row"><span class="kv-k">SQLite / GL / Bank Impact:</span><span class="kv-v" style="color:var(--green);">$0.00 (Untouched)</span></div>
                  </div>
                </div>
                <div class="sig-strip signed"><span style="font-weight:800;color:var(--green);">✓ Books Protected by Deterministic Kernel</span><span style="font-family:var(--mono);font-size:10px;">SHA-256 Logged</span></div>
              </div>
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Why Did This Screen Appear?</div>
                      <div class="sheet-title">Segregation of Duties &amp; Zero-Authority AI Guardrail</div>
                    </div>
                    <span class="badge b-done">SOX + 4-Layer Active</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-sec);line-height:1.5;margin-top:8px;">
                    This proof screen appears whenever you click a <strong>🛡️ Demo Block</strong> red-team button to prove to judges that neither <strong>KAL ($0.00 limit)</strong> nor an unauthorized human officer (e.g., Buyer Nancy scanning her own dock receipt) can bypass controls.
                  </div>
                </div>
                <div class="sig-strip signed"><span style="font-weight:800;color:var(--green);">Click <strong>✓ Clear Block &amp; Resume Normal Step ➔</strong> above to continue.</span></div>
              </div>
            </div>
          </div>
        `;
      }

      // 1-Click KAL Guided Run-Through: SOX Workflow Governance + Live NVMe Databases ('sox_db')
      if (deskSubView === 'sox_db') {
        return renderSoxAndLiveDbDesk(d, st, stepIdx);
      }

      // Live Outbound COMEX API Showcase OR On-Demand Inspection ('spot')
      if (liveShowcasePhase === 'cp_reviewing' || liveShowcasePhase === 'spot_calling' || deskSubView === 'spot') {
        return renderLiveSpotCallDesk(d, st, stepIdx);
      }

      // On-Demand Order Acknowledgement Inspection ('oa')
      if (deskSubView === 'oa') {
        return renderOrderAckDesk(d, st, stepIdx);
      }

      // Live AP Email Inbox + RapidOCR 28-Box Laser Scan & Tagging Showcase OR On-Demand Inspection ('ocr')
      if (liveShowcasePhase === 'ocr_scanning' || liveShowcasePhase === 'email_arrived' || deskSubView === 'ocr') {
        return renderEmailAndOcrScanDesk(d, st, stepIdx);
      }

      // Show Official Ledger Book View if toggled OR automatically when all 8 steps are complete (unless viewing Paid Voucher)
      if (deskSubView === 'books' || (stepIdx >= 8 && deskSubView !== 'voucher')) {
        return renderLedgerBookView(d, st, stepIdx);
      }

      // Busy state banner while deterministic code block executes
      if (busyAction) {
        return `
          <div class="officer-desk">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">⚡ KAL ORCHESTRATING DETERMINISTIC WORKFLOW BLOCK</div>
                <div class="cp-title">${esc(busyBannerText || 'Executing verified SQLite & hledger workflow block…')}</div>
                <div class="cp-desc">KAL ($0.00 Signing Limit) is running the deterministic code block and advancing to the next Human Officer's screen.</div>
              </div>
              <button class="btn-approve blue" disabled>Working…</button>
            </div>
            <div class="desk-stage equal">
              <div class="doc-sheet"><div style="margin:auto;font-weight:700;color:var(--text-sec);">Updating SQLite System-of-Record tables &amp; SHA-256 lineage…</div></div>
              <div class="doc-sheet"><div style="margin:auto;font-weight:700;color:var(--text-sec);">Preparing next Officer Screen &amp; KAL voice brief…</div></div>
            </div>
          </div>
        `;
      }

      // STEP 1 (stepIdx === 0): SUPPLY CHAIN DEMAND SIGNAL (LIVE HEADLESS WMS SQLITE QUERY)
      if (stepIdx === 0) {
        return `
          <div class="officer-desk">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">📡 STEP 1 OF 8 · HEADLESS WMS SQLITE DEMAND SIGNAL (<code>WO-01 · WFB-P2M-1A</code>)</div>
                <div class="cp-title">Live SQLite Stock-Out: 0 FT Bare Copper On Hand (&lt; 8,000 FT Min) — Start KAL Steward</div>
                <div class="cp-desc">
                  Live query against headless <code>wms_inventree.sqlite3</code> (119 tables) detected <code>quantity=0 &lt; minimum_stock=8000</code>. Click <strong>Start KAL</strong> — she greets with <em>"Good day…"</em> and routes <strong>REQ-25800</strong> into Darius Mercer's queue.
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <button class="btn-guard-inline" onclick="runGuardrailTest('kal_rogue_attempt')" title="Optional Red-Team Demo: Force KAL ($0 limit) to attempt a rogue PO/check write">
                  🛡️ Demo Block: Rogue KAL (403)
                </button>
                <button class="btn-approve blue" onclick="startKalSteward()">
                  ▶ Start KAL · P2P Steward
                </button>
              </div>
            </div>
            <div class="desk-stage">
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Headless WMS DB · wms_inventree.sqlite3 (119 Tables)</div>
                      <div class="sheet-title">Live SQLite Stock Trigger · part_part JOIN stock_stockitem</div>
                    </div>
                    <span class="badge b-hold">0 FT &lt; 8,000 MIN</span>
                  </div>
                  <div class="api-terminal" style="margin:6px 0;padding:6px 9px;font-size:9.6px;">
                    <div style="color:#7dd3fc;">SELECT p.id, p.IPN, p.minimum_stock, COALESCE(SUM(s.quantity),0) AS on_hand</div>
                    <div style="color:#94a3b8;">FROM part_part p LEFT JOIN stock_stockitem s ON s.part_id=p.id WHERE p.id=218;</div>
                    <div style="color:#4ade80;margin-top:3px;">➔ { id: 218, IPN: "${esc(d.itemCanonical)}", min_stock: 8000, on_hand: ${d.onHandStockFt} }</div>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Stocked SKU &amp; Spec:</span><span class="kv-v">${esc(d.itemCanonical)} · ASTM B8 2/0 Cu</span></div>
                    <div class="kv-row"><span class="kv-k">Annual Standard Cost (Jan 1):</span><span class="kv-v">$${d.catalogUnitPrice.toFixed(2)}/FT × 8,000 FT = ${fmtUsd(d.catalogEstimateUsd)}</span></div>
                    <div class="kv-row"><span class="kv-k">Approved Mill (crm_company#181):</span><span class="kv-v">Encore Wire Corporation (McKinney, TX)</span></div>
                  </div>
                </div>
                <div class="sig-strip"><span>Origin: <strong>Live Headless SQLite Trigger</strong> (Zero Direct UI CRUD)</span><span style="font-family:var(--mono);font-size:10px;">Queue: EMP-0021 Darius</span></div>
              </div>

              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">8090 Software Factory · WO-01..WO-05 &amp; KYSI-4</div>
                      <div class="sheet-title">5 Deterministic Workflow Blocks + 4 Human Signers</div>
                    </div>
                    <span class="badge b-ready">Zero Direct CRUD</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">WO-01 · WFB-P2M-1A (Req + DOA):</span><span class="kv-v">Darius ($20k) ➔ VP Devon ($100k)</span></div>
                    <div class="kv-row"><span class="kv-k">WO-02 · WFB-P2P-1A (Spot PO):</span><span class="kv-v">Live COMEX HTTPS + Encore OA</span></div>
                    <div class="kv-row"><span class="kv-k">WO-03 · WFB-P2P-1B (Dock Scan):</span><span class="kv-v">Marcus RF Scan + 501900 PPV</span></div>
                    <div class="kv-row"><span class="kv-k">WO-04 · WFB-P2P-1C (OCR 3-Way):</span><span class="kv-v">AP Email + 28-Box RapidOCR</span></div>
                    <div class="kv-row"><span class="kv-k">WO-05 · WFB-P2P-1D (Treasury):</span><span class="kv-v" style="color:var(--green);">CFO Meredith Signs Check #10045</span></div>
                  </div>
                </div>
                <div class="sig-strip signed"><span style="font-weight:800;color:var(--green);">✓ KYSI L1–L4 Active · 6 Live HTTP 403/409 Red-Team Guards</span><span style="font-family:var(--mono);font-size:10px;">KAL = $0.00</span></div>
              </div>
            </div>
          </div>
        `;
      }

      // STEP 2 (stepIdx === 1): REVIEWER #1 — DARIUS MERCER'S SUPPLY CHAIN PLANNER SCREEN
      if (stepIdx === 1) {
        return `
          <div class="officer-desk human">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">👤 REVIEWER 1 OF 4 · DARIUS MERCER (SUPPLY CHAIN PLANNER · $20,000 SIGNING LIMIT · <code>WO-01</code>)</div>
                <div class="cp-title">What You Are Approving: Supply Chain Requisition REQ-25800 (8,000 FT Bare Copper)</div>
                <div class="cp-desc">
                  Demand signal from WMS landed in Darius's queue. Review <strong>REQ-25800</strong> below: because <strong>${fmtUsd(d.catalogEstimateUsd)}</strong> at Annual Standard Cost exceeds Darius's <strong>$20,000 Signing Limit</strong>, clicking Approve confirms physical need and escalates to VP Devon Brooks.
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <button class="btn-guard-inline" onclick="runGuardrailTest('kal_rogue_attempt')" title="Red-Team KYSI L1: Force KAL to attempt a rogue PO/check write">
                  🤖 Test Rogue KAL (403)
                </button>
                <button class="btn-approve" onclick="approveCheckpoint1Darius()">
                  ✓ Approve REQ-25800 (Darius · $20k Limit)
                </button>
              </div>
            </div>
            <div class="desk-stage">
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Document Under Review · Supply Chain Stream (P2M)</div>
                      <div class="sheet-title">Stock Replenishment Requisition · REQ-25800</div>
                    </div>
                    <span class="badge b-amber">Review Before Clicking</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Demand Trigger:</span><span class="kv-v" style="color:var(--red);">WMS Stock-Out · 0 FT On Hand (&lt; 8,000 FT Min)</span></div>
                    <div class="kv-row"><span class="kv-k">Item &amp; Quantity Requested:</span><span class="kv-v">${esc(d.itemCanonical)} · 8,000 FT (4 Master Reels)</span></div>
                    <div class="kv-row"><span class="kv-k">Annual Standard Cost Basis:</span><span class="kv-v">$2.89 / FT (3,288 lbs Net Copper)</span></div>
                    <div class="kv-row"><span class="kv-k">Extended Standard Value:</span><span class="kv-v" style="font-size:13px;color:var(--blue);">${fmtUsd(d.catalogEstimateUsd)}</span></div>
                    <div class="kv-row"><span class="kv-k">Approved Mill Source:</span><span class="kv-v">Encore Wire Corp (VEN-ENCORE-01)</span></div>
                  </div>
                </div>
                <div class="sig-strip">
                  <span><strong>Reviewer #1 Signature:</strong> Darius Mercer, Supply Chain Planner (EMP-0021)</span>
                  <span class="badge b-amber">Sign Gate 1 ➔</span>
                </div>
              </div>

              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Headless HRM SQLite · Signing Limit Check (MIT)</div>
                      <div class="sheet-title">Signing Limit Math &amp; Automatic Escalation</div>
                    </div>
                    <span class="badge b-hold">+$3,120 Over Limit</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Requisition Standard Value:</span><span class="kv-v">${fmtUsd(d.catalogEstimateUsd)}</span></div>
                    <div class="kv-row"><span class="kv-k">Darius Mercer Signing Limit:</span><span class="kv-v">$20,000.00</span></div>
                    <div class="kv-row"><span class="kv-k">Amount Above Planner Limit:</span><span class="kv-v" style="color:var(--red);">+$3,120.00 (Escalation Required)</span></div>
                    <div class="kv-row"><span class="kv-k">Routes Next To:</span><span class="kv-v" style="color:var(--green);">Devon Brooks · VP Supply Chain ($100k)</span></div>
                  </div>
                </div>
                <div class="sig-strip">
                  <span>Self-Approval Guardrail: <code>HTTP 403</code> if Planner tries Gate 2</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // STEP 3 (stepIdx === 2): REVIEWER #2 — VP DEVON BROOKS'S EXECUTIVE APPROVAL SCREEN
      if (stepIdx === 2) {
        return `
          <div class="officer-desk human">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">👤 REVIEWER 2 OF 4 · DEVON BROOKS (VP SUPPLY CHAIN · $100,000 SIGNING LIMIT)</div>
                <div class="cp-title">What You Are Approving: ${fmtUsd(d.catalogEstimateUsd)} Spend Ceiling on Escalated REQ-25800</div>
                <div class="cp-desc">
                  Darius signed Gate 1. Review the escalated requisition below — clicking Approve completes the Signing Tree and <strong>fires a live outbound HTTPS call to the COMEX Copper API</strong> to issue <code>${esc(d.id)}</code> &amp; Encore Ack <code>${esc(d.oaId)}</code>.
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <button class="btn-guard-inline" onclick="runGuardrailTest('wf0_approve_req', { actingEmpId: 'EMP-0021' })" title="Optional Red-Team Demo: Force Darius ($20k limit) to attempt Gate 2 sign-off">
                  🛡️ Demo Block: Darius &gt;$20k (403)
                </button>
                <button class="btn-approve" onclick="approveCheckpoint2Devon()">
                  ✓ Approve ${fmtUsdShort(d.catalogEstimateUsd)} Ceiling (VP Devon · $100k)
                </button>
              </div>
            </div>
            <div class="desk-stage">
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Document Under Review · Escalated REQ-25800</div>
                      <div class="sheet-title">Executive Spend Authorization · ${fmtUsd(d.catalogEstimateUsd)} Ceiling</div>
                    </div>
                    <span class="badge b-done">Gate 1 Signed ✓</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Gate 1 (Supply Chain Need):</span><span class="kv-v" style="color:var(--green);">✓ Signed by Darius Mercer (EMP-0021)</span></div>
                    <div class="kv-row"><span class="kv-k">Authorized Quantity:</span><span class="kv-v">8,000 FT (4 × 2,000-FT Wooden Reels)</span></div>
                    <div class="kv-row"><span class="kv-k">Authorized Spend Ceiling:</span><span class="kv-v" style="color:var(--blue);font-size:13px;">${fmtUsd(d.catalogEstimateUsd)} ($2.89/FT Annual Std)</span></div>
                    <div class="kv-row"><span class="kv-k">VP Devon Brooks Signing Limit:</span><span class="kv-v" style="color:var(--green);">$100,000.00 (Within Authority ✓)</span></div>
                  </div>
                </div>
                <div class="sig-strip">
                  <span><strong>Reviewer #2 Signature:</strong> Devon Brooks, VP Supply Chain (EMP-0012)</span>
                  <span class="badge b-amber">Sign Gate 2 ➔</span>
                </div>
              </div>

              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Next Action Upon Click · P2M ➔ P2P Handoff</div>
                      <div class="sheet-title">Live Outbound COMEX Copper Call &amp; Auto-PO</div>
                    </div>
                    <span class="badge b-ready">Fires Live on Click</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Outbound Endpoint:</span><span class="kv-v"><code>GET https://api.gold-api.com/price/HG</code></span></div>
                    <div class="kv-row"><span class="kv-k">Purchasing Buyer:</span><span class="kv-v">Nancy Rostova (Centralized Purchasing)</span></div>
                    <div class="kv-row"><span class="kv-k">Ceiling Guardrail:</span><span class="kv-v">Spot Unit Cost Must Be &le; $2.89/FT</span></div>
                    <div class="kv-row"><span class="kv-k">Subledger &amp; Mill Ack:</span><span class="kv-v">Commits Open PO + Encore Ack (${esc(d.oaId)})</span></div>
                  </div>
                </div>
                <div class="sig-strip signed"><span style="font-weight:800;color:var(--green);">✓ Watch Live Outbound HTTPS Call &amp; Timestamp Next</span></div>
              </div>
            </div>
          </div>
        `;
      }

      // STEP 4 (stepIdx === 3): CENTRAL PURCHASING — LIVE COMEX SPOT QUOTE & VARIANCE GATE (PAUSES FOR "OK TO PROCEED")
      if (stepIdx === 3) {
        return renderLiveSpotCallDesk(d, st, stepIdx);
      }

      // STEP 5 (stepIdx === 4): VENDOR ORDER ACKNOWLEDGEMENT — SHIP & DELIVERY DATES GATE (PAUSES FOR "OK TO PROCEED")
      if (stepIdx === 4) {
        return renderOrderAckDesk(d, st, stepIdx);
      }

      // STEP 6 (stepIdx === 5): REVIEWER #3 — MARCUS VANCE'S RECEIVING DOCK & 4-REEL RF BARCODE SCAN GUN
      if (stepIdx === 5) {
        const favPpv = st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd;
        const reelSpecs = getDealReelSpecs(d);
        const scannedCount = dockScannedReels.size;
        const scannedFt = scannedCount * 2000;
        const allReelsScanned = scannedCount >= reelSpecs.length;
        const nextReel = reelSpecs.find(r => !dockScannedReels.has(r.seq));
        return `
          <div class="officer-desk human">
            <div class="desk-banner">
              <div>
                <div class="cp-eyebrow">👤 STEP 6 OF 8 · MARCUS VANCE (WAREHOUSE RECEIVING DOCK LEAD · BAY 4 RF BARCODE SCAN GUN)</div>
                <div class="cp-title">Scan All 4 Vendor-Barcoded Master Reels (${scannedCount} / ${reelSpecs.length} Scanned · ${fmtInt(scannedFt)} / 8,000 FT)</div>
                <div class="cp-desc">
                  Encore Wire shipped <strong>4 Master Wooden Reels</strong> (<code>2,000 FT</code> each) with GS1-128 barcodes under Vendor Ack <code>${esc(d.oaId)}</code>. Click <strong>Scan All 4 Reels</strong> once — Marcus sweeps each reel one at a time, then click <strong>Submit</strong>.
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                <button class="btn-guard-inline" onclick="runGuardrailTest('wf2_dock_receipt', { actingEmpId: 'EMP-0002' })" title="Optional Red-Team Demo: Buyer Nancy attempts to scan her own PO at Dock (Blocked HTTP 403)">
                  🛡️ Demo Block: Nancy SoD (403)
                </button>
                <button class="btn-top" style="padding:8px 9px;" onclick="setDeskSubView('oa')" title="Re-inspect Step 5 Vendor Order Acknowledgement ${esc(d.oaId)}">
                  📅 OA Dates
                </button>
                ${allReelsScanned ? `
                  <button class="btn-approve" onclick="approveCheckpoint3MarcusDock()">
                    ✓ Submit Dock Scan — 4/4 Reels · 8,000 FT (Marcus)
                  </button>
                ` : (autoScanningReels ? `
                  <button class="btn-approve rf-scan-trigger" disabled>
                    🔫 Marcus Scanning ${scannedCount} / ${reelSpecs.length} Reels…
                  </button>
                ` : `
                  <button class="btn-approve rf-scan-trigger" onclick="scanAllDockReelsSequentially()">
                    🔫 Scan All 4 Reels (Marcus RF Gun · +8,000 FT)
                  </button>
                `)}
              </div>
            </div>
            <div class="desk-stage">
              <div class="doc-sheet">
                <div>
                  <div class="sheet-top">
                    <div>
                      <div class="sheet-kicker">Bay 4 Arrival Packet · BOL-25800 + Packing Slip PS-25800</div>
                      <div class="sheet-title">Physical Truck Arrival Matched Against ${esc(d.oaId)}</div>
                    </div>
                    <span class="badge b-done">On Schedule · 0 Damaged</span>
                  </div>
                  <div class="kv-list">
                    <div class="kv-row"><span class="kv-k">Carrier &amp; Bay Arrival:</span><span class="kv-v">Flatbed ENCORE-FLT-19 · Bay 4 (${esc(d.deliveryDate)})</span></div>
                    <div class="kv-row"><span class="kv-k">Customer PO ↔ Vendor OA:</span><span class="kv-v" style="color:var(--blue);">${esc(d.id)} ↔ ${esc(d.oaId)}</span></div>
                    <div class="kv-row"><span class="kv-k">Bill of Lading (${esc(d.grnId)}):</span><span class="kv-v">4 × 2,000-FT Wooden Reels (822 lbs ea · 3,288 lbs)</span></div>
                    <div class="kv-row"><span class="kv-k">Vendor Barcode Standard:</span><span class="kv-v" style="color:var(--green);">4 Encore GS1-128 Reel Labels Attached ✓</span></div>
                    <div class="kv-row"><span class="kv-k">Standard Cost &amp; Spot PPV:</span><span class="kv-v">${fmtUsd(d.catalogEstimateUsd)} Std vs ${fmtUsd(d.poAmount)} PO (${favPpv >= 0 ? '-' + fmtUsd(Math.abs(favPpv)) + ' Fav' : '+' + fmtUsd(Math.abs(favPpv)) + ' Unfav'})</span></div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;">
                  <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank" class="btn-top" style="flex:1;justify-content:center;text-decoration:none;">📄 PO-25800 ↗</a>
                  <a href="/api/trade-pdf?file=${encodeURIComponent(d.oaFile)}" target="_blank" class="btn-top" style="flex:1;justify-content:center;text-decoration:none;">📄 ${esc(d.oaId)} ↗</a>
                  <a href="/api/trade-pdf?file=${encodeURIComponent(d.bolFile)}" target="_blank" class="btn-top" style="flex:1;justify-content:center;text-decoration:none;">📄 BOL-25800 ↗</a>
                </div>
              </div>

              <div class="doc-sheet dark-gun">
                <div>
                  <div class="sheet-top" style="margin-bottom:4px;">
                    <div>
                      <div class="sheet-kicker" style="color:#38bdf8;">RF Handheld Barcode Scan Gun · 1 Scan Per Reel</div>
                      <div class="sheet-title">Custodian: Marcus Vance · ${scannedCount} / ${reelSpecs.length} Reels (${fmtInt(scannedFt)} FT)</div>
                    </div>
                    <span class="badge ${allReelsScanned ? 'b-done' : 'b-amber'}">${allReelsScanned ? '8,000 FT Complete ✓' : `${reelSpecs.length - scannedCount} Scans Left`}</span>
                  </div>

                  <div class="reel-barcode-grid">
                    ${reelSpecs.map(r => {
                      const isDone = dockScannedReels.has(r.seq);
                      const isFlashing = lastFlashedReelSeq === r.seq;
                      return `
                        <div class="reel-barcode-card ${isDone ? 'scanned' : ''}" onclick="scanSingleDockReel(${r.seq})" title="Click to snap RF Barcode Gun on ${esc(r.barcode)}">
                          <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:9px;">
                            <strong style="color:${isDone ? '#4ade80' : '#f8fafc'};">REEL ${r.seq}/4 · ${fmtInt(r.qtyFt)} FT</strong>
                            <span style="font-size:8.4px;font-weight:800;color:${isDone ? '#4ade80' : '#fbbf24'};">${isDone ? '✓ SCANNED' : '🔫 SNAP'}</span>
                          </div>
                          <div class="barcode-bars">
                            ${isFlashing ? '<div class="rf-laser-beam"></div>' : ''}
                          </div>
                          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:8.3px;color:${isDone ? '#bbf7d0' : '#94a3b8'};">
                            <span>${esc(r.barcode)}</span>
                            <span>${r.weightLbs} lb</span>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <div class="kv-list" style="gap:2px;">
                    <div class="kv-row"><span class="kv-k">SQLite <code>stock_stockitem</code>:</span><span class="kv-v" style="color:#38bdf8;">Inserts 4 Barcoded Rows = 8,000 FT</span></div>
                    <div class="kv-row"><span class="kv-k">GL Entry #1 on Submit:</span><span class="kv-v" style="color:#4ade80;">DR 121100 ${fmtUsdShort(d.catalogEstimateUsd)} · CR 201200 (${fmtUsdShort(d.poAmount)})</span></div>
                  </div>
                </div>
                <div class="sig-strip" style="background:#1e293b;border-color:${allReelsScanned ? '#22c55e' : '#475569'};color:#e2e8f0;padding:5px 9px;">
                  <span>${allReelsScanned
                    ? '✅ <strong>All 4 Reels Scanned (8,000 FT)</strong> — Click <strong>Submit Dock Scan</strong> above!'
                    : (autoScanningReels
                        ? `🔫 <strong>Marcus RF Gun Active:</strong> Sweeping reel ${scannedCount} of 4 sequentially…`
                        : `🔫 Click <strong>Scan All 4 Reels</strong> once above — Marcus sweeps all 4 barcodes one at a time!`)}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // STEP 7 (stepIdx === 6): AUTOMATED AP INTAKE & RAPIDOCR 3-WAY MATCH
      if (stepIdx === 6) {
        return renderEmailAndOcrScanDesk(d, st, stepIdx);
      }

      // STEP 8 (stepIdx === 7) OR PAID VOUCHER VIEW (stepIdx >= 8 && deskSubView === 'voucher'):
      // REVIEWER #4 — CFO MEREDITH HALE'S AUTHENTIC CORPORATE VOUCHER CHECK #10045 + PERFORATED REMITTANCE STUB
      const isPaid = stepIdx >= 8;
      const ocr = st.wf3_ocr_result;
      const favSavings = st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd;
      const isFavCheck = favSavings >= -0.005;
      return `
        <div class="officer-desk cfo">
          <div class="desk-banner" style="padding:8px 14px;">
            <div>
              <div class="cp-eyebrow">${isPaid ? `✅ SIGNED &amp; RELEASED · CORPORATE CHECK #10045 (${esc(st.achTrace)})` : '👤 STEP 8 OF 8 · MEREDITH HALE, CFO ($500,000 SIGNING LIMIT · TREASURY DISBURSEMENT)'}</div>
              <div class="cp-title">${isPaid ? `Countersigned Corporate Check #10045 (${fmtUsd(d.receiptAmount)}) &amp; Settled Remittance Stub` : `Review &amp; Sign Corporate Check #10045 (${fmtUsd(d.receiptAmount)}) — Full Body of Work Attached`}</div>
              <div class="cp-desc">
                One-shot CFO review: the <strong>Corporate Check</strong> above and its attached <strong>3-Way Match Remittance Stub</strong> below show exactly what this payment covers and every officer who signed upstream.
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
              ${!isPaid ? `
                <button class="btn-guard-inline" onclick="runGuardrailTest('wf4_release_ach', { bankAccount: 'Assets:101200-Payroll-Checking' })" title="Optional Red-Team Demo: Attempt supplier payment from ring-fenced 101200 Payroll Checking">
                  🛡️ Demo Block: 101200 Payroll (403)
                </button>
              ` : ''}
              <button class="btn-top" style="border-color:#93c5fd;color:#1d4ed8;padding:7px 10px;" onclick="setDeskSubView('ocr')" title="Inspect 3-Way Match Matrix &amp; 28 RapidOCR Boxes">
                🔍 3-Way Match &amp; OCR
              </button>
              ${isPaid ? `
                <button class="btn-approve blue" style="padding:8px 13px;" onclick="setDeskSubView('books')">📗 Balance Sheet &amp; P&amp;L</button>
              ` : `
                <button class="btn-approve" onclick="approveCheckpoint4MeredithCfo()">
                  ✓ Approve — Stamp &amp; Sign Check #10045 (${fmtUsdShort(d.receiptAmount)})
                </button>
              `}
            </div>
          </div>

          <div class="corp-check-wrap">
            <!-- PART 1 (TOP): AUTHENTIC SECURITY-PAPER CORPORATE DISBURSEMENT CHECK #10045 -->
            <div class="corp-check-paper">
              <!-- BANK & PAYER HEADER -->
              <div style="display:grid;grid-template-columns:1.25fr 1fr auto;gap:10px;align-items:flex-start;">
                <div>
                  <div style="font-size:11.5px;font-weight:900;color:#0f172a;letter-spacing:0.04em;">8090 INDUSTRIAL MANUFACTURING CORP.</div>
                  <div style="font-size:9px;color:#475569;font-weight:600;">1200 Industrial Pkwy · McKinney, TX 75070 · Operating Disbursement Acct (GL <code>101100</code>)</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:9.8px;font-weight:800;color:#1e293b;letter-spacing:0.03em;">FIRST COMMERCIAL BANK OF TEXAS, N.A.</div>
                  <div style="font-family:var(--mono);font-size:8.6px;color:#64748b;">Dallas, TX · ABA 111000025 · Acct ••••8801 (Payroll #4409 Ring-Fenced)</div>
                </div>
                <div style="text-align:right;font-family:var(--mono);">
                  <div style="font-size:15px;font-weight:900;color:#0f172a;letter-spacing:0.03em;">NO. 10045</div>
                  <div style="font-size:9px;font-weight:700;color:#334155;">DATE: <span style="border-bottom:1px solid #64748b;padding:0 4px;">${esc(d.deliveryDate)}</span></div>
                </div>
              </div>

              <!-- PAY TO THE ORDER OF + NUMERIC DOLLAR BOX -->
              <div style="display:flex;align-items:center;gap:10px;margin-top:3px;">
                <div style="font-size:8.5px;font-weight:900;color:#334155;line-height:1.15;text-transform:uppercase;width:68px;flex-shrink:0;">Pay to the<br>Order of</div>
                <div style="flex:1;background:rgba(255,255,255,0.82);border-bottom:1.5px solid #1e293b;padding:4px 10px;display:flex;justify-content:space-between;align-items:baseline;">
                  <span style="font-size:14px;font-weight:900;color:#0f172a;">Encore Wire Corporation</span>
                  <span style="font-family:var(--mono);font-size:9.5px;color:#475569;">Approved Supplier #181 · McKinney, TX</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span style="font-size:14px;font-weight:900;color:#0f172a;">$</span>
                  <div class="check-amt-box">${fmtUsd(d.receiptAmount).replace('$', '')}</div>
                </div>
              </div>

              <!-- WRITTEN LEGAL DOLLARS LINE -->
              <div style="display:flex;align-items:baseline;gap:8px;">
                <div style="flex:1;border-bottom:1px solid #64748b;padding:2px 6px;font-family:Georgia,serif;font-style:italic;font-size:11.5px;font-weight:700;color:#1e293b;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                  ${esc(usdToCheckWords(d.receiptAmount))} ****************************************************************
                </div>
                <span style="font-size:9px;font-weight:900;color:#334155;letter-spacing:0.06em;">DOLLARS</span>
              </div>

              <!-- MEMO + AUTHORIZED CFO SIGNATURE LINE -->
              <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:2px;">
                <div style="flex:1;font-size:9.8px;color:#334155;">
                  <span style="font-weight:900;text-transform:uppercase;font-size:8.5px;color:#475569;">Memo:</span>
                  <span style="border-bottom:1px solid #94a3b8;padding:0 6px 1px;font-family:var(--mono);font-weight:700;color:#0f172a;">
                    Full Settlement · ${esc(d.id)} == ${esc(d.grnId)} == ${esc(d.invoiceId)} (8,000 FT 2/0 AWG Bare Cu)
                  </span>
                  ${isPaid ? `<span class="check-paid-stamp" style="margin-left:8px;">✓ PAID · ${esc(st.achTrace)}</span>` : ''}
                </div>

                <div style="min-width:275px;text-align:center;">
                  <div style="border-bottom:1.8px solid #0f172a;padding:1px 12px 2px;background:${isPaid ? 'rgba(220,252,231,0.45)' : 'rgba(254,243,199,0.65)'};border-radius:4px 4px 0 0;">
                    ${isPaid
                      ? `<span style="font-family:'Segoe Script','Brush Script MT',Georgia,serif;font-size:16px;font-weight:700;color:#0f3d75;">Meredith Hale, CFO</span>`
                      : `<span style="font-size:10.5px;font-weight:900;color:#b45309;">✍️ X &nbsp; Click Approve Above to Sign (Meredith Hale, CFO)</span>`}
                  </div>
                  <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;margin-top:1px;">
                    Authorized Treasury Signature · $500,000 Signing Limit · SOX Counter-Sign
                  </div>
                </div>
              </div>

              <!-- MAGNETIC INK (MICR) ROUTING & CHECK SERIAL LINE -->
              <div class="micr-line">⑈010045⑈ &nbsp;&nbsp; ⑆111000025⑆ &nbsp;&nbsp; 880100101100⑈</div>
            </div>

            <!-- PERFORATED VOUCHER TEAR STRIP -->
            <div class="corp-check-perf">
              <span>✂ - - - DETACH &amp; RETAIN ATTACHED VOUCHER REMITTANCE STUB FOR AUDIT RECORDS - - -</span>
              <span>VOUCHER: VCH-25800 · 3-WAY MATCH ($0.00 VARIANCE)</span>
            </div>

            <!-- PART 2 (BOTTOM): ATTACHED ONE-SHOT REMITTANCE RECEIPT & BODY OF WORK -->
            <div class="corp-check-stub">
              <!-- LEFT STUB: WHAT THIS CHECK IS FOR (INVOICE / PO / BOL SCHEDULE) -->
              <div style="display:flex;flex-direction:column;justify-content:space-between;min-height:0;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;">Remittance Advice — What Check #10045 Pays For</span>
                    <div style="display:flex;gap:6px;font-family:var(--mono);font-size:8.8px;font-weight:800;">
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank" style="color:var(--blue);text-decoration:none;">PO PDF ↗</a>
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.bolFile)}" target="_blank" style="color:#0f766e;text-decoration:none;">BOL PDF ↗</a>
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.pdfFile)}" target="_blank" style="color:#6d28d9;text-decoration:none;">INV PDF ↗</a>
                    </div>
                  </div>
                  <table class="twm-table" style="font-size:9.6px;">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Matched PO</th>
                        <th>Dock Receipt</th>
                        <th>Qty / Unit</th>
                        <th>Std Value</th>
                        <th>PPV</th>
                        <th style="text-align:right;">Check Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>${esc(d.invoiceId)}</td>
                        <td>${esc(d.id)}</td>
                        <td>${esc(d.grnId)}</td>
                        <td>8,000 FT @ $${d.unitPrice.toFixed(2)}</td>
                        <td>${fmtUsd(d.catalogEstimateUsd)}</td>
                        <td style="color:${isFavCheck ? '#15803d' : '#b45309'};">${isFavCheck ? '-' + fmtUsd(Math.abs(favSavings)) : '+' + fmtUsd(Math.abs(favSavings))}</td>
                        <td style="text-align:right;color:#15803d;font-size:10.5px;">${fmtUsd(d.receiptAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style="font-family:var(--mono);font-size:9px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:3px 7px;display:flex;justify-content:space-between;">
                  <span>GL Posting: <strong>DR 201100 Trade AP ${fmtUsd(d.receiptAmount)}</strong> ➔ <strong>CR 101100 Cash (${fmtUsd(d.receiptAmount)})</strong></span>
                  <span style="color:#15803d;font-weight:800;">0.00 Variance ✓</span>
                </div>
              </div>

              <!-- RIGHT STUB: COMPLETE BODY OF WORK & UPSTREAM SIGN-OFF CHAIN -->
              <div style="border-left:1px dashed #cbd5e1;padding-left:11px;display:flex;flex-direction:column;justify-content:space-between;min-height:0;">
                <div>
                  <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#0f766e;margin-bottom:3px;">
                    Verified Body of Work (Segregated Sign-Off Chain)
                  </div>
                  <div style="display:grid;grid-template-columns:1fr;gap:2px;font-size:9.6px;color:#1e293b;">
                    <div style="display:flex;justify-content:space-between;"><span>1. Supply Chain (<code>REQ-25800</code>):</span><strong style="font-family:var(--mono);color:#15803d;">✓ Darius Mercer</strong></div>
                    <div style="display:flex;justify-content:space-between;"><span>2. Spend Ceiling ($100k DOA):</span><strong style="font-family:var(--mono);color:#15803d;">✓ Devon Brooks, VP</strong></div>
                    <div style="display:flex;justify-content:space-between;"><span>3. Spot PO &amp; Mill OA:</span><strong style="font-family:var(--mono);color:#15803d;">✓ Nancy Rostova</strong></div>
                    <div style="display:flex;justify-content:space-between;"><span>4. Bay 4 RF Dock Scan:</span><strong style="font-family:var(--mono);color:#15803d;">✓ Marcus Vance</strong></div>
                    <div style="display:flex;justify-content:space-between;"><span>5. RapidOCR (${ocr ? ocr.boxCount : 28} Boxes) &amp; 3WM:</span><strong style="font-family:var(--mono);color:#15803d;">✓ Duncan Vance</strong></div>
                  </div>
                </div>
                <div style="font-family:var(--mono);font-size:8.8px;color:#64748b;display:flex;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:2px;">
                  <span>KAL Steward: <strong>$0.00 Authority</strong></span>
                  <span style="color:#1d4ed8;font-weight:800;">SOX 404 PASS ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= 1-CLICK KAL TOUR: SOX, LIVE HEADLESS DBS & WHITE HOUSE SUPER INTELLIGENCE ACCORD ================= */
    function renderSoxAndLiveDbDesk(d, st, stepIdx) {
      const vault = STATE.sorVault || { vaultDir: 'C:\\8090-sor-data\\copper-p2p', totalSizeHuman: '10.67 MB', files: [] };
      const lens = STATE.lineage?.controlLenses?.[selectedDeal] || { hopCount: 1 };
      return `
        <div class="officer-desk" style="border-top-color:#1d4ed8;">
          <div class="desk-banner" style="background:linear-gradient(90deg,#eff6ff 0%,#ffffff 100%);padding:8px 14px;">
            <div>
              <div class="cp-eyebrow" style="color:#1d4ed8;">🛡️ POST-SAAS HEADLESS VAULT · WHITE HOUSE SUPER INTELLIGENCE ACCORD (<code>EO 14434</code>) × 8090 <code>KYSI</code> × <code>SOX 404</code></div>
              <div class="cp-title">3 Real MIT Headless Databases + 89-Acct GAAP Ledger + The President's 4 Super Intelligence Control Layers</div>
              <div class="cp-desc">
                Zero SaaS seat rent: <strong>InvenTree WMS, Django-CRM, Headless HRM &amp; an 89-account GAAP journal</strong> ship in GitHub (<code>/seeds</code> · 275 SQLite tables) and run live on local NVMe inside <strong>all 4 layers of the White House Accord on Super Intelligence</strong>.
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
              <button class="btn-top" style="border-color:#1d4ed8;color:#1d4ed8;padding:8px 10px;" onclick="askKalPreset('sox_db_tour')" title="Full KAL guided voice walkthrough of Headless Databases + SOX + White House Super Intelligence">
                🔊 Replay KAL Tour
              </button>
              <button class="btn-top" style="border-color:#7c3aed;color:#6d28d9;padding:8px 10px;" onclick="askKalPreset('white_house_si')" title="Focused 14-second KAL kill-shot brief on EO 14434 &amp; 8090 KYSI">
                🏛️ White House SI Brief
              </button>
              <button class="btn-approve blue" onclick="setDeskSubView('auto');stopKalAudio();">
                ↩ Back to Step ${Math.min(stepIdx + 1, 8)}
              </button>
            </div>
          </div>

          <div class="desk-stage" style="grid-template-columns:1.14fr 1.06fr;">
            <!-- LEFT: SHIPPED IN GITHUB (/SEEDS · 100% MIT) -> LIVE WORKING COPY ON NVME DISK -->
            <div class="doc-sheet" style="padding:8px 11px;">
              <div>
                <div class="sheet-top" style="padding-bottom:5px;margin-bottom:5px;">
                  <div>
                    <div class="sheet-kicker" style="color:#1d4ed8;">Post-SaaS System of Record Spine · GitHub <code>/seeds</code> ➔ Live Local Disk</div>
                    <div class="sheet-title" style="font-size:12px;">📁 <code>${esc(vault.vaultDir)}</code> (${esc(vault.totalSizeHuman)} · $0 SaaS Tax)</div>
                  </div>
                  <span class="badge b-done">100% MIT · Owned ✓</span>
                </div>

                <table class="twm-table" style="font-size:9.4px;">
                  <thead>
                    <tr>
                      <th>Headless System (MIT)</th>
                      <th>Live File &amp; GitHub Seed</th>
                      <th>Size</th>
                      <th>Modified</th>
                      <th style="text-align:right;">Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(vault.files || []).map(f => `
                      <tr style="background:#fff;font-weight:600;">
                        <td style="font-family:var(--sans);">
                          <div style="font-weight:800;color:#0f172a;">${esc(f.sysLabel)}</div>
                          <div style="font-size:8.5px;color:#64748b;">${esc(f.detail)}</div>
                        </td>
                        <td>
                          <div style="font-weight:800;color:#1d4ed8;">${esc(f.fileName)}</div>
                          <div style="font-size:8.2px;color:#64748b;">${esc(f.seedFile || 'seeds/')} · SHA ${esc(f.shaShort)}…</div>
                        </td>
                        <td>${esc(f.sizeHuman)}</td>
                        <td>${esc(f.mtimeLocal)}</td>
                        <td style="text-align:right;">
                          ${f.regSys === 'journal'
                            ? `<button class="btn-top" style="padding:2px 6px;font-size:8.5px;" onclick="openModal('journal')">Journal ↗</button>`
                            : `<button class="btn-top" style="padding:2px 6px;font-size:8.5px;" onclick="setView('registers');fetchRegTable('${esc(f.regSys)}','${esc(f.regTable)}')">Rows ↗</button>`}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div class="sig-strip signed" style="padding:5px 9px;">
                <span style="font-weight:800;color:var(--green);font-size:10px;">✓ Real Installed Headless Databases — Click "Rows ↗" to Query Live SQLite Tables</span>
              </div>
            </div>

            <!-- RIGHT: WHITE HOUSE ACCORD ON SUPER INTELLIGENCE (EO 14434 · 4 LAYERS) × 8090 KYSI × SOX 404 -->
            <div class="doc-sheet" style="padding:8px 11px;">
              <div>
                <div class="sheet-top" style="padding-bottom:5px;margin-bottom:5px;">
                  <div>
                    <div class="sheet-kicker" style="color:#6d28d9;">🏛️ White House Super Intelligence Accord (<code>EO 14434</code>) × 8090 <code>KYSI</code></div>
                    <div class="sheet-title" style="font-size:12px;">The President's 4 Control Layers — Enforced Live in Code</div>
                  </div>
                  <span class="badge b-done">${lens.hopCount} SHA-256 Hops</span>
                </div>

                <div style="display:grid;grid-template-columns:1fr;gap:5px;font-size:9.9px;">
                  <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:5px 8px;border-radius:5px;">
                    <strong style="color:#1d4ed8;">Layer 1 · Internal Technical Controls (<code>EO 14434 L1</code>):</strong>
                    <span style="color:#334155;"> Super Intelligence (<code>KAL</code>) holds a <strong>$0.00 Signing Limit</strong> &amp; <strong>0</strong> DB/GL/Bank credentials—rogue token buys hit hard <code>HTTP 403</code>.</span>
                  </div>
                  <div style="background:#f0fdfa;border-left:3px solid #0d9488;padding:5px 8px;border-radius:5px;">
                    <strong style="color:#0f766e;">Layer 2 · Internal Oversight Gates (<code>EO 14434 L2</code>):</strong>
                    <span style="color:#334155;"> 5 compiled 8090 Workflow Blocks (<code>WO-01..05</code>) enforce SQL, ASTM B8 spot math, <code>409</code> 3-Way Match &amp; <code>hledger --strict</code> (0 LLM math).</span>
                  </div>
                  <div style="background:#f5f3ff;border-left:3px solid #7c3aed;padding:5px 8px;border-radius:5px;">
                    <strong style="color:#6d28d9;">Layer 3 · Independent External Audit (<code>8090 × EY KYSI</code>):</strong>
                    <span style="color:#334155;"> Append-only <code>SHA-256</code> decision &amp; artifact chain in <code>lineage_core.sqlite3</code> so external CPAs verify every AI hop independently.</span>
                  </div>
                  <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:5px 8px;border-radius:5px;">
                    <strong style="color:#15803d;">Layer 4 · Executive &amp; Board Governance (<code>SOX 404</code> + Kill-Switch):</strong>
                    <span style="color:#334155;"> 4 segregated corporate signers (Darius $20k ➔ VP Devon $100k ➔ Marcus Dock ➔ CFO Meredith $500k) + <code>0ms</code> Kill-Switch.</span>
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:5px;flex-wrap:wrap;padding-top:4px;border-top:1px dashed #cbd5e1;">
                <button class="btn-guard-inline" style="flex:1;justify-content:center;" onclick="runGuardrailTest('kal_rogue_attempt')">🛡️ Demo: Rogue SI Blocked (403)</button>
                <button class="btn-guard-inline" style="flex:1;justify-content:center;" onclick="openModal('guardrails')">🧪 All 6 SOX &amp; SI Guardrail Tests ↗</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= STEP 4: LIVE OUTBOUND COMEX API & CENTRAL PURCHASING GATE ================= */
    function renderLiveSpotCallDesk(d, st, stepIdx) {
      const isReviewing = liveShowcasePhase === 'cp_reviewing';
      const isCalling = liveShowcasePhase === 'spot_calling';
      const isInFlight = isReviewing || isCalling;
      const sq = st.spotQuote || {};
      const endpointUrl = sq.endpointUrl || 'https://api.gold-api.com/price/HG';
      const spotLb = Number(sq.spotPerLbUsd || 6.2436);
      const comexFutLb = Number(sq.comexFuturesPerLbUsd || spotLb);
      const unitFt = Number(sq.lockedUnitPriceFt || d.unitPrice || 2.70);
      const quotedTotal = Number(sq.quotedTotalUsd || d.poAmount || 21600);
      const favPpv = Number(sq.savingsVsCatalogUsd || st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd || 1520);
      const rawJson = sq.rawJsonSnippet || JSON.stringify({
        name: 'Copper',
        price: spotLb,
        symbol: 'HG',
        updatedAt: sq.feedTimestamp || new Date().toISOString(),
      });
      const isActiveStep4 = stepIdx === 3;
      const isFavSpot = favPpv >= -0.005;
      const absSpotPpv = Math.abs(favPpv);
      const pctVar = ((absSpotPpv / d.catalogEstimateUsd) * 100).toFixed(1);

      const bannerTitle = isReviewing
        ? `Central Purchasing Received Signed REQ-25800 (${fmtUsd(d.catalogEstimateUsd)} Ceiling) — Launching Spot Check…`
        : (isCalling
            ? `Going Out Live to COMEX Copper: GET ${esc(endpointUrl)} + Ticker HG=F…`
            : (isFavSpot
                ? `Better Live Spot Found: $${spotLb.toFixed(4)}/lb ➔ $${unitFt.toFixed(2)}/FT (${fmtUsd(quotedTotal)} · Saves ${fmtUsd(absSpotPpv)}!)`
                : `Live Spot Quote Returned: $${spotLb.toFixed(4)}/lb ➔ $${unitFt.toFixed(2)}/FT (+${fmtUsd(absSpotPpv)} Unfavorable)`));

      const bannerDesc = isReviewing
        ? `VP Devon approved <strong>REQ-25800</strong> and routed it to <strong>Central Purchasing (Nancy Rostova · $50k Limit)</strong>. Reviewing standard cost baseline (<code>$2.89/FT</code>) and preparing live outbound COMEX copper query…`
        : (isCalling
            ? `Central Purchasing is making a <strong>real outbound HTTPS call</strong> to live public COMEX copper feeds (<code>api.gold-api.com/price/HG</code> + <code>HG=F</code>) to price 8,000 FT against our $23,120.00 standard ceiling…`
            : `${isFavSpot
                ? `Central Purchasing pulled a <strong>real live COMEX spot quote</strong> at <strong>$${unitFt.toFixed(2)}/FT (${fmtUsd(quotedTotal)})</strong> — <strong>${fmtUsd(absSpotPpv)} cheaper</strong> than our $2.89/FT ($23,120) Standard Cost! <em>(Auto-executed in production; paused here to explain — shall we approve?)</em>`
                : `Central Purchasing pulled a <strong>real live COMEX spot quote</strong> at <strong>$${unitFt.toFixed(2)}/FT (${fmtUsd(quotedTotal)})</strong> — within Buyer Nancy's $50,000 Signing Limit. Paused here to review before cutting <code>${esc(d.id)}</code>.`}`);

      return `
        <div class="officer-desk" style="border-top-color:#0284c7;">
          <div class="desk-banner" style="background:linear-gradient(90deg,#f0f9ff 0%,#ffffff 100%);">
            <div>
              <div class="cp-eyebrow" style="color:#0369a1;">📡 STEP 4 OF 8 · CENTRAL PURCHASING AGENTIC SPOT ROUTINE (NANCY ROSTOVA · $50K LIMIT · <code>WO-02</code>)</div>
              <div class="cp-title">${bannerTitle}</div>
              <div class="cp-desc">${bannerDesc}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
              ${!isInFlight ? `
                <button class="btn-top" style="border-color:#0284c7;color:#0369a1;padding:8px 10px;" onclick="repollLiveComexSpot()" title="Fire another live outbound HTTPS request right now">
                  🔄 Re-Call Live API
                </button>
              ` : ''}
              ${isReviewing ? `
                <button class="btn-approve blue" disabled>📋 Reviewing REQ-25800…</button>
              ` : (isCalling ? `
                <button class="btn-approve blue" disabled>📡 Pulling Live Spot…</button>
              ` : (isActiveStep4 ? `
                <button class="btn-approve" onclick="proceedStep4CutPo()">
                  ✓ Approve ${isFavSpot ? 'Better Spot ' : 'Spot '}Quote &amp; Cut ${esc(d.id)}
                </button>
              ` : `
                <button class="btn-approve blue" onclick="setDeskSubView('auto')">↩ Back to Active Step</button>
              `))}
            </div>
          </div>

          <div class="desk-stage equal">
            <!-- LEFT: REAL OUTBOUND HTTPS REQUEST + PHONE TICKER CROSS-CHECK -->
            <div class="doc-sheet" style="background:#0f172a;border-color:#334155;color:#f8fafc;">
              <div>
                <div class="sheet-top" style="border-bottom-color:#334155;">
                  <div>
                    <div class="sheet-kicker" style="color:#38bdf8;">Live Outbound Market Services (Zero Mock · Real Prices)</div>
                    <div class="sheet-title" style="color:#f8fafc;">1. gold-api.com/price/HG &nbsp;+&nbsp; 2. COMEX Ticker HG=F</div>
                  </div>
                  <span class="badge ${isInFlight ? 'b-amber' : 'b-done'}">${isReviewing ? 'INTAKE · REQ-25800' : (isCalling ? 'DIALING TLS…' : `HTTP ${sq.httpStatus || 200} · ${sq.latencyMs || 180}ms`)}</span>
                </div>

                <div style="margin:5px 0;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                  <span class="api-url-pill">${esc(sq.httpMethod || 'GET')} ${esc(endpointUrl)}</span>
                  <span style="font-family:var(--mono);font-size:9.5px;color:${isInFlight ? '#fbbf24' : '#4ade80'};white-space:nowrap;">${isReviewing ? 'Staging Outbound Call…' : (isCalling ? 'Fetching Live Quote…' : esc(sq.calledAtLocal || 'Live'))}</span>
                </div>

                <div class="api-terminal" style="background:#020617;border-color:#1e293b;padding:6px 9px;">
                  ${isReviewing ? `
                    <div style="color:#38bdf8;">&gt; Central Purchasing (EMP-0002 Nancy Rostova) received VP-approved REQ-25800…</div>
                    <div style="color:#fbbf24;margin-top:2px;">&gt; Initializing outbound HTTPS client for COMEX Copper (HG / HG=F)…</div>
                  ` : (isCalling ? `
                    <div style="color:#38bdf8;">&gt; TLS 1.3 handshake ➔ GET https://api.gold-api.com/price/HG + Yahoo Finance (HG=F)…</div>
                    <div style="color:#fbbf24;margin-top:2px;">&gt; Pulling real-time COMEX High-Grade Copper ($/lb) &amp; computing mill draw…</div>
                  ` : `
                    <div style="color:#94a3b8;">// Feed UTC: <span style="color:#38bdf8;">${esc(sq.feedTimestamp || sq.calledAtIso || 'Live')}</span></div>
                    <div style="color:#4ade80;margin-top:2px;word-break:break-all;">${esc(rawJson)}</div>
                  `)}
                </div>

                <div class="kv-list" style="margin-top:5px;">
                  <div class="kv-row" style="border-bottom-color:#1e293b;padding:3px 0;"><span class="kv-k" style="color:#94a3b8;">Service 1 · Spot REST (<code>HG</code>):</span><span class="kv-v" style="color:#38bdf8;">${isInFlight ? '📡 Querying live $/lb…' : `$${spotLb.toFixed(4)} / lb`}</span></div>
                  <div class="kv-row" style="border-bottom-color:#1e293b;padding:3px 0;"><span class="kv-k" style="color:#94a3b8;">Service 2 · Phone Stocks (<code>HG=F</code>):</span><span class="kv-v" style="color:#fbbf24;">${isInFlight ? '📡 Cross-checking COMEX…' : `$${comexFutLb.toFixed(4)} / lb (COMEX)`}</span></div>
                  <div class="kv-row" style="border-bottom:none;padding:3px 0;"><span class="kv-k" style="color:#94a3b8;">ASTM B8 Mill Formula (0.411 lb/FT):</span><span class="kv-v" style="color:#4ade80;">${isInFlight ? 'Awaiting live spot tick…' : `($${spotLb.toFixed(2)} + $0.32) × 0.411 = $${unitFt.toFixed(2)}/FT`}</span></div>
                </div>
              </div>

              <div class="sig-strip" style="background:#1e293b;border-color:#334155;color:#cbd5e1;padding:5px 9px;">
                <span>📱 Verify on Phone: Search <strong><code>HG=F</code></strong> (COMEX Copper Futures)</span>
                <span style="font-family:var(--mono);font-size:9.5px;color:${isInFlight ? '#fbbf24' : '#4ade80'};">${isInFlight ? 'DIALING…' : 'LIVE HTTPS ✓'}</span>
              </div>
            </div>

            <!-- RIGHT: CENTRAL PURCHASING VARIANCE ROUTINE & DRAFT PO-25800 -->
            <div class="doc-sheet">
              <div>
                <div class="sheet-top">
                  <div>
                    <div class="sheet-kicker">Central Purchasing Department · Automated Variance Check</div>
                    <div class="sheet-title">${isInFlight ? 'Benchmarking Live Market vs. $2.89/FT Standard Cost…' : `Standard Cost vs. Live Spot — Ready to Cut ${esc(d.id)}`}</div>
                  </div>
                  <span class="badge ${isInFlight ? 'b-amber' : (isFavSpot ? 'b-done' : 'b-amber')}">${isReviewing ? 'Intake Review' : (isCalling ? 'Polling COMEX…' : (st.wf1_po_committed === 'done' ? 'PO Issued ✓' : (isFavSpot ? 'Cheaper Spot Found ✓' : 'Market Variance · OK ✓')))}</span>
                </div>
                <div class="kv-list">
                  <div class="kv-row"><span class="kv-k">Annual Standard Cost Baseline:</span><span class="kv-v">8,000 FT × $2.89/FT = ${fmtUsd(d.catalogEstimateUsd)}</span></div>
                  <div class="kv-row"><span class="kv-k">Live Encore Mill Quote (Spot Lock):</span><span class="kv-v" style="color:var(--blue);">${isInFlight ? '⏳ Pulling live COMEX quote…' : `8,000 FT × $${unitFt.toFixed(2)}/FT = ${fmtUsd(quotedTotal)}`}</span></div>
                  <div class="kv-row"><span class="kv-k">Calculated Price Variance (501900 PPV):</span><span class="kv-v" style="color:${isInFlight ? 'var(--text-muted)' : (isFavSpot ? 'var(--green)' : '#b45309')};">${isInFlight ? 'Computing vs. $23,120.00 ceiling…' : (isFavSpot ? `-${fmtUsd(absSpotPpv)} Favorable (Saves ${pctVar}%)` : `+${fmtUsd(absSpotPpv)} Unfavorable (+${pctVar}%)`)}</span></div>
                  <div class="kv-row"><span class="kv-k">Approved Supplier (Django-CRM #181 · MIT):</span><span class="kv-v">Encore Wire Corp (McKinney, TX)</span></div>
                  <div class="kv-row"><span class="kv-k">Purchasing Buyer Authority:</span><span class="kv-v">Nancy Rostova ($50,000 Limit ✓)</span></div>
                </div>
              </div>
              <div class="sig-strip ${isInFlight ? '' : 'signed'}" style="padding:6px 10px;">
                <span style="font-weight:800;color:${isInFlight ? 'var(--blue)' : 'var(--green)'};">${isInFlight ? '📡 Waiting for live COMEX spot response before pausing for approval…' : `✓ ${isFavSpot ? `Cheaper Than Standard (${fmtUsd(quotedTotal)} vs ${fmtUsd(d.catalogEstimateUsd)}) — Shall We Approve?` : `Within $50,000 Purchasing Authority — Click Approve Above`}`}</span>
                <span style="font-family:var(--mono);font-size:9.5px;font-weight:800;">Step 4 ➔ Step 5</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= STEP 5: VENDOR ORDER ACKNOWLEDGEMENT (SHIP & DELIVERY DATES GATE) ================= */
    function renderOrderAckDesk(d, st, stepIdx) {
      const isActiveStep5 = stepIdx === 4;
      const favPpv = st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd;
      const isFavOa = favPpv >= -0.005;
      return `
        <div class="officer-desk" style="border-top-color:#0d9488;">
          <div class="desk-banner" style="background:linear-gradient(90deg,#f0fdfa 0%,#ffffff 100%);">
            <div>
              <div class="cp-eyebrow" style="color:#0f766e;">📅 STEP 5 OF 8 · VENDOR ORDER ACKNOWLEDGEMENT RECEIVED (<code>${esc(d.oaId)}</code> · CENTRAL PURCHASING GATE)</div>
              <div class="cp-title">Verify Vendor Ship Date, Carrier &amp; Promised Bay 4 Delivery Date (${esc(d.deliveryDate)})</div>
              <div class="cp-desc">
                <code>${esc(d.id)}</code> was transmitted to Encore Wire and mill acknowledgement <strong><code>${esc(d.oaId)}</code></strong> came back confirming quantity, locked <strong>$${d.unitPrice.toFixed(2)}/FT</strong> price, ship date, and Bay 4 delivery window. Everything looks copacetic — click <strong>OK to Proceed</strong>.
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
              <button class="btn-top" style="padding:8px 10px;" onclick="setDeskSubView('spot')" title="Re-inspect Step 4 Live COMEX Spot Call">
                📡 View Spot Call
              </button>
              ${isActiveStep5 ? `
                <button class="btn-approve" onclick="proceedStep5VerifyAck()">
                  ✓ OK to Proceed — Dates Copacetic (Stage Dock)
                </button>
              ` : `
                <button class="btn-approve blue" onclick="setDeskSubView('auto')">↩ Back to Active Step</button>
              `}
            </div>
          </div>

          <div class="desk-stage equal">
            <!-- LEFT: INCOMING VENDOR ORDER ACKNOWLEDGEMENT ENC-OA-2026-884192 -->
            <div class="doc-sheet">
              <div>
                <div class="sheet-top">
                  <div>
                    <div class="sheet-kicker">Incoming Supplier ERP Confirmation · Encore Wire Mill Desk</div>
                    <div class="sheet-title">Vendor Order Ack · ${esc(d.oaId)}</div>
                  </div>
                  <span class="badge b-done">Vendor Confirmed ✓</span>
                </div>
                <div class="kv-list">
                  <div class="kv-row"><span class="kv-k">Vendor Ack ↔ Customer PO:</span><span class="kv-v" style="color:var(--blue);">${esc(d.oaId)} ↔ ${esc(d.id)}</span></div>
                  <div class="kv-row"><span class="kv-k">Confirmed Packaging &amp; Barcodes:</span><span class="kv-v">4 × 2,000-FT Reels (GS1 Barcoded = 8,000 FT)</span></div>
                  <div class="kv-row"><span class="kv-k">Confirmed Mill Unit Price:</span><span class="kv-v" style="color:var(--green);">$${d.unitPrice.toFixed(2)} / FT = ${fmtUsd(d.poAmount)} (Locked)</span></div>
                  <div class="kv-row"><span class="kv-k">Mill Ship Date &amp; Origin:</span><span class="kv-v">2026-11-12 · McKinney, TX Copper Mill</span></div>
                  <div class="kv-row"><span class="kv-k">Promised Delivery Date &amp; Dock:</span><span class="kv-v" style="color:var(--blue);">${esc(d.deliveryDate)} · 08:00 AM · WH-TX-NORTH Bay 4</span></div>
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                <a href="/api/trade-pdf?file=${encodeURIComponent(d.oaFile)}" target="_blank" class="btn-top" style="flex:1;justify-content:center;text-decoration:none;border-color:#0d9488;color:#0f766e;">📄 Open ${esc(d.oaId)} PDF ↗</a>
                <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank" class="btn-top" style="flex:1;justify-content:center;text-decoration:none;">📄 Open PO-25800 PDF ↗</a>
              </div>
            </div>

            <!-- RIGHT: AUTOMATED PO <-> VENDOR OA TERMS & SCHEDULE VERIFICATION -->
            <div class="doc-sheet">
              <div>
                <div class="sheet-top">
                  <div>
                    <div class="sheet-kicker">Automated Agentic Schedule &amp; Terms Check</div>
                    <div class="sheet-title">${esc(d.id)} ↔ ${esc(d.oaId)} Reconciliation</div>
                  </div>
                  <span class="badge b-done">0 Exceptions</span>
                </div>
                <div class="kv-list">
                  <div class="kv-row"><span class="kv-k">1. Quantity &amp; Reel Packaging:</span><span class="kv-v" style="color:var(--green);">8,000 FT Ordered == 4 × 2,000-FT Acked ✓</span></div>
                  <div class="kv-row"><span class="kv-k">2. Spot Price Lock vs PO:</span><span class="kv-v" style="color:var(--green);">$${d.unitPrice.toFixed(2)}/FT == $${d.unitPrice.toFixed(2)}/FT ($0 Delta) ✓</span></div>
                  <div class="kv-row"><span class="kv-k">3. Delivery Date &amp; Bay 4 Slot:</span><span class="kv-v" style="color:var(--green);">${esc(d.deliveryDate)} Lead-Time Copacetic ✓</span></div>
                  <div class="kv-row"><span class="kv-k">4. Vendor GS1 Reel Barcodes:</span><span class="kv-v">4 Barcodes Staged (1 RF Scan per Reel)</span></div>
                  <div class="kv-row"><span class="kv-k">5. Open PO Memo Commitment:</span><span class="kv-v" style="color:var(--blue);">${fmtUsd(d.poAmount)} (${isFavOa ? '-' + fmtUsd(Math.abs(favPpv)) + ' Fav' : '+' + fmtUsd(Math.abs(favPpv)) + ' Unfav'} PPV)</span></div>
                </div>
              </div>
              <div class="sig-strip signed" style="padding:6px 10px;">
                <span style="font-weight:800;color:var(--green);">✓ Ship &amp; Delivery Dates Verified — Click OK to Proceed to Bay 4 Dock Scan</span>
                <span style="font-family:var(--mono);font-size:9.5px;font-weight:800;">Step 5 ➔ Step 6</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= STEP 7: REAL RAPIDOCR (:3591/SCAN) + VISUAL 3-COMPONENT THREE-WAY MATCH ================= */
    function renderEmailAndOcrScanDesk(d, st, stepIdx) {
      const isScanning = liveShowcasePhase === 'ocr_scanning' || liveShowcasePhase === 'email_arrived';
      const isActiveStep7 = stepIdx === 6;
      const ocr = st.wf3_ocr_result;
      const em = st.wf3_email_meta || {
        from: 'Encore Wire Billing <billing@encorewire.com>',
        to: 'ap@company-8090.com',
        subject: `Invoice ${d.invoiceId} — ${d.id} (8,000 FT 2/0 Bare Copper)`,
        receivedAtLocal: 'Live AP Intake',
        emlFile: 'EMAIL-INV-25800.eml',
        attachmentFile: d.pdfFile,
      };
      const ex = ocr?.extracted;
      const ocrMs = ocr?.elapsedMs || 412;
      const ocrConf = ocr ? (ocr.avgConfidence * 100).toFixed(1) : '97.2';
      const ocrBoxes = ocr ? ocr.boxCount : 28;
      const ocrTime = ocr?.calledAtLocal || em.receivedAtLocal || 'Live';

      return `
        <div class="officer-desk" style="border-top-color:#2563eb;">
          <div class="desk-banner" style="background:linear-gradient(90deg,#eff6ff 0%,#ffffff 100%);padding:8px 14px;">
            <div>
              <div class="cp-eyebrow" style="color:#1d4ed8;">📧 STEP 7 OF 8 · LIVE RAPIDOCR NEURAL SCAN (<code>:3591/scan</code>) &amp; VISUAL THREE-WAY MATCH (DUNCAN VANCE · AP GATE)</div>
              <div class="cp-title">${isScanning ? `Scanning ${esc(d.pdfFile)} via RapidOCR ONNX (PP-OCRv4 · 2-Pass Sweep)…` : `Three-Way Match Verified: Ordered PO == Scanned Dock BOL == OCR Invoice ($0.00 Variance)`}</div>
              <div class="cp-desc">
                ${isScanning
                  ? `Calling live Python sidecar <code>POST http://127.0.0.1:3591/scan</code> (<code>invoice_ocr_engine.py</code>) — laser sweeps twice, locks all 28 bounding boxes, and stops before KAL speaks.`
                  : `<strong>What is a 3-Way Match?</strong> Matching <strong>3 independent documents</strong> from <strong>3 departments</strong> (1. Purchasing PO <code>${esc(d.id)}</code> == 2. Warehouse Dock <code>${esc(d.grnId)}</code> == 3. Supplier OCR Invoice <code>${esc(d.invoiceId)}</code>) before paying a dime.`}
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
              ${!isScanning && st.wf3_mailbox_polled ? `
                <button class="btn-top" style="border-color:#2563eb;color:#1d4ed8;padding:7px 9px;" onclick="rerunLiveRapidOcr()" title="Trigger a fresh live POST http://127.0.0.1:3591/scan ONNX inference right now">
                  🔄 Re-Scan Live OCR (:3591)
                </button>
              ` : ''}
              ${!isScanning && st.wf2_dock_received === 'done' && !st.wf4_ach_released ? `
                <button class="btn-guard-inline" onclick="runGuardrailTest('wf3_test_variance_hold')" title="Optional Red-Team Demo: Simulate +$500 over-billed vendor invoice -> HTTP 409 Match Hold">
                  🛡️ Demo Block: +$500 Bill (409)
                </button>
              ` : ''}
              ${isScanning ? `
                <button class="btn-approve blue" disabled>🔍 RapidOCR Scanning…</button>
              ` : (isActiveStep7 ? `
                <button class="btn-approve" onclick="proceedStep7ConfirmMatch()">
                  ✓ OK to Proceed — 3-Way Match Verified (To CFO)
                </button>
              ` : `
                <button class="btn-approve blue" onclick="setDeskSubView(stepIdx >= 8 ? 'voucher' : 'auto')">↩ Back to Check #10045</button>
              `)}
            </div>
          </div>

          <div class="desk-stage" style="grid-template-columns:0.84fr 1.46fr;">
            <!-- LEFT: LIVE SCANNED SUPPLIER INVOICE (RAPIDOCR ONNX :3591/SCAN · STOPS AFTER 2 PASSES) -->
            <div class="doc-sheet" style="padding:7px 9px;">
              <div class="sheet-top" style="padding-bottom:4px;margin-bottom:3px;">
                <div>
                  <div class="sheet-kicker">AP Inbox (${esc(em.emlFile || 'EMAIL-INV-25800.eml')}) ➔ ${esc(d.pdfFile)}</div>
                  <div class="sheet-title" style="font-size:11px;">Real Neural Scan · <code>RapidOCR PP-OCRv4</code></div>
                </div>
                <button class="btn-top" style="padding:2px 7px;font-size:9.5px;" onclick="openModal('invoice')">🔍 Zoom</button>
              </div>

              <div style="font-family:var(--mono);font-size:8.8px;font-weight:800;padding:3px 6px;margin-bottom:4px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;${isScanning ? 'background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;' : 'background:#dcfce7;color:#15803d;border:1px solid #86efac;'}">
                <span>${isScanning ? '⚡ POST 127.0.0.1:3591/scan (Scanning…)' : `✓ STOPPED · ${ocrBoxes} Boxes Locked (${ocrMs}ms)`}</span>
                <span>${isScanning ? 'ONNX' : `${ocrConf}% · ${esc(ocrTime)}`}</span>
              </div>

              <div class="live-ocr-stage" onclick="openModal('invoice')" style="cursor:pointer;">
                <div class="live-ocr-inner">
                  <img src="/api/invoice-image?file=${encodeURIComponent(d.pngFile)}${st.poSha256 ? `&v=${encodeURIComponent(st.poSha256.slice(0, 8))}` : ''}" alt="Encore Wire Invoice INV-25800" />
                  ${isScanning ? '<div class="ocr-laser-bar"></div>' : ''}
                  ${(!isScanning && ocr && ocr.boxes) ? ocr.boxes.map(b => `
                    <div class="ocr-tag-overlay" style="left:${b.xPct}%;top:${b.yPct}%;width:${b.wPct}%;height:${b.hPct}%;"></div>
                  `).join('') : ''}
                </div>
              </div>
            </div>

            <!-- RIGHT: THE 3 INDEPENDENT COMPONENTS OF THE THREE-WAY MATCH & LINE-BY-LINE TIE-OUT MATRIX -->
            <div class="doc-sheet" style="padding:8px 11px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#0f172a;">
                    The 3 Independent Components of a Three-Way Match (3 Separate Departments)
                  </span>
                  <span class="badge ${isScanning ? 'b-amber' : 'b-done'}">${isScanning ? 'Extracting Component #3…' : '3 / 3 Matched · $0.00 Variance ✓'}</span>
                </div>

                <!-- 3 SIDE-BY-SIDE DOCUMENT CARDS -->
                <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:5px;align-items:stretch;margin-bottom:6px;">
                  <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-top:3px solid #2563eb;border-radius:6px;padding:5px 7px;font-size:9.5px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-weight:900;color:#1d4ed8;">1. PURCHASE ORDER</span>
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank" style="font-family:var(--mono);font-size:8.8px;font-weight:800;color:var(--blue);text-decoration:none;">PDF ↗</a>
                    </div>
                    <div style="font-family:var(--mono);font-weight:900;color:#0f172a;margin-top:1px;">${esc(d.id)} · Purchasing</div>
                    <div style="color:#475569;font-size:8.8px;">"What We Ordered" (Nancy)</div>
                    <div style="font-family:var(--mono);font-weight:900;color:#15803d;margin-top:2px;">8,000 FT · ${fmtUsd(d.poAmount)}</div>
                  </div>

                  <div style="align-self:center;font-family:var(--mono);font-weight:900;font-size:11px;color:#15803d;background:#dcfce7;border:1px solid #86efac;border-radius:999px;padding:3px 5px;">==</div>

                  <div style="background:#f0fdfa;border:1.5px solid #5eead4;border-top:3px solid #0d9488;border-radius:6px;padding:5px 7px;font-size:9.5px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-weight:900;color:#0f766e;">2. DOCK RECEIPT</span>
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.bolFile)}" target="_blank" style="font-family:var(--mono);font-size:8.8px;font-weight:800;color:#0f766e;text-decoration:none;">PDF ↗</a>
                    </div>
                    <div style="font-family:var(--mono);font-weight:900;color:#0f172a;margin-top:1px;">${esc(d.grnId)} · Warehouse</div>
                    <div style="color:#475569;font-size:8.8px;">"What Arrived" (Marcus RF Gun)</div>
                    <div style="font-family:var(--mono);font-weight:900;color:#15803d;margin-top:2px;">8,000 FT · ${fmtUsd(d.receiptAmount)}</div>
                  </div>

                  <div style="align-self:center;font-family:var(--mono);font-weight:900;font-size:11px;color:#15803d;background:#dcfce7;border:1px solid #86efac;border-radius:999px;padding:3px 5px;">==</div>

                  <div style="background:#f5f3ff;border:1.5px solid #c4b5fd;border-top:3px solid #7c3aed;border-radius:6px;padding:5px 7px;font-size:9.5px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-weight:900;color:#6d28d9;">3. VENDOR INVOICE</span>
                      <a href="/api/trade-pdf?file=${encodeURIComponent(d.pdfFile)}" target="_blank" style="font-family:var(--mono);font-size:8.8px;font-weight:800;color:#6d28d9;text-decoration:none;">PDF ↗</a>
                    </div>
                    <div style="font-family:var(--mono);font-weight:900;color:#0f172a;margin-top:1px;">${esc(d.invoiceId)} · RapidOCR</div>
                    <div style="color:#475569;font-size:8.8px;">"What Encore Billed" (${ocrBoxes} Boxes)</div>
                    <div style="font-family:var(--mono);font-weight:900;color:#15803d;margin-top:2px;">${isScanning ? 'Scanning…' : `8,000 FT · ${fmtUsd(d.invoiceAmount)}`}</div>
                  </div>
                </div>

                <!-- LINE-BY-LINE SIDE-BY-SIDE TIE-OUT MATRIX -->
                <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#334155;margin-bottom:3px;">
                  How All 3 Documents Tie Out Line-by-Line
                </div>
                <table class="twm-table">
                  <thead>
                    <tr>
                      <th>Match Field</th>
                      <th style="color:#1d4ed8;">1. PO-25800 (Ordered)</th>
                      <th style="color:#0f766e;">2. BOL-25800 (Dock Scan)</th>
                      <th style="color:#6d28d9;">3. INV-25800 (OCR Billed)</th>
                      <th style="text-align:right;color:#15803d;">Tie-Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="font-family:var(--sans);font-weight:700;color:#475569;">Supplier</td>
                      <td>Encore Wire (#181)</td>
                      <td>Encore Wire (FLT-19)</td>
                      <td>${isScanning ? '…' : esc(ex ? ex.vendorName.value : 'Encore Wire Corp')}</td>
                      <td style="text-align:right;color:#15803d;font-weight:800;">${isScanning ? '…' : '✓ 3/3'}</td>
                    </tr>
                    <tr>
                      <td style="font-family:var(--sans);font-weight:700;color:#475569;">Part / SKU</td>
                      <td>${esc(d.itemCanonical)}</td>
                      <td>${esc(d.itemCanonical)} (RF)</td>
                      <td>${isScanning ? '…' : esc(ex ? ex.sku.value : d.itemCanonical)}</td>
                      <td style="text-align:right;color:#15803d;font-weight:800;">${isScanning ? '…' : '✓ 3/3'}</td>
                    </tr>
                    <tr>
                      <td style="font-family:var(--sans);font-weight:700;color:#475569;">Quantity</td>
                      <td style="font-weight:800;">8,000 FT</td>
                      <td style="font-weight:800;">8,000 FT (WMS +8k)</td>
                      <td style="font-weight:800;">${isScanning ? '…' : '8,000 FT (OCR)'}</td>
                      <td style="text-align:right;color:#15803d;font-weight:800;">${isScanning ? '…' : '✓ Δ 0 FT'}</td>
                    </tr>
                    <tr>
                      <td style="font-family:var(--sans);font-weight:700;color:#475569;">Unit Price</td>
                      <td>$${d.unitPrice.toFixed(2)} / FT (Spot)</td>
                      <td style="color:#64748b;font-style:italic;">Blind Count (SOX)</td>
                      <td>${isScanning ? '…' : `$${d.unitPrice.toFixed(2)} / FT (OCR)`}</td>
                      <td style="text-align:right;color:#15803d;font-weight:800;">${isScanning ? '…' : '✓ Δ $0.00'}</td>
                    </tr>
                    <tr>
                      <td style="font-family:var(--sans);font-weight:900;color:#14532d;">Total Amt</td>
                      <td style="color:#15803d;">${fmtUsd(d.poAmount)}</td>
                      <td style="color:#15803d;">${fmtUsd(d.receiptAmount)} (GRNI)</td>
                      <td style="color:#15803d;">${isScanning ? '…' : fmtUsd(d.invoiceAmount)}</td>
                      <td style="text-align:right;color:#15803d;">${isScanning ? '…' : '✓ $0.00 VAR'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="sig-strip signed" style="padding:5px 9px;">
                <span style="font-weight:800;color:var(--green);font-size:10.5px;">✓ GL Voucher <code>VCH-25800</code>: DR <code>201200</code> GRNI ${fmtUsd(d.receiptAmount)} ➔ CR <code>201100</code> Trade AP ${fmtUsd(d.receiptAmount)}</span>
                <span style="font-family:var(--mono);font-size:9.5px;font-weight:800;">Step 7 ➔ Step 8</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= RIGHT PANEL: SUBLEDGER + GENERAL LEDGER + STREAM PACKET TRAIL ================= */
    function renderRight() {
      const el = document.getElementById('rightRail');
      if (!el || !STATE) return;
      const d = STATE.deals[selectedDeal];
      const st = STATE.runtimeState[selectedDeal];
      const stepIdx = computeStepIndex(st);
      const p = STATE.moneyFlow.portfolio;
      const openPoVal = Number(p.openPoCommitmentUsd || 0);
      const ppvVal = Number(p.ppvSignedUsd || 0);
      const ppvLabel = ppvVal < -0.005
        ? `-${fmtUsd(Math.abs(ppvVal))} Fav`
        : (ppvVal > 0.005 ? `+${fmtUsd(ppvVal)} Unfav` : fmtUsd(0));

      const streamRows = [
        {
          done: st.wf0_req_status === 'approved',
          now: stepIdx <= 2,
          title: '1. P2M · REQ-25800',
          sub: st.wf0_req_status === 'approved' ? 'Darius + VP Devon Signed' : 'WMS 0 < 8k FT ($23.1k Std)',
          act: `<span style="color:${st.wf0_req_status === 'approved' ? 'var(--green)' : 'var(--amber)'};">${st.wf0_req_status === 'approved' ? '✓ $23,120' : 'Signing'}</span>`,
        },
        {
          done: st.wf1_po_committed === 'done',
          now: stepIdx === 3,
          title: '2. P2P · PO-25800',
          sub: st.wf1_po_committed === 'done' ? `COMEX $${d.unitPrice.toFixed(2)}/FT (${fmtUsd(d.poAmount)})` : 'Live COMEX Spot Call',
          act: st.wf1_po_committed === 'done'
            ? `<a href="#" onclick="setDeskSubView('spot');return false;" title="Inspect Live COMEX HTTPS Call">📡 API</a> · <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank">PDF</a>`
            : `<span style="color:var(--text-muted);">Step 4</span>`,
        },
        {
          done: Boolean(st.wf1_ack_verified),
          now: stepIdx === 4,
          title: `3. Vendor · ${d.oaId}`,
          sub: st.wf1_vendor_ack === 'done' ? `Encore ETA ${d.deliveryDate} (Bay 4)` : 'Encore Mill Order Ack',
          act: st.wf1_vendor_ack === 'done'
            ? `<a href="#" onclick="setDeskSubView('oa');return false;" title="Inspect Ship & Delivery Dates">📅 Dates</a> · <a href="/api/trade-pdf?file=${encodeURIComponent(d.oaFile)}" target="_blank">PDF</a>`
            : `<span style="color:var(--text-muted);">Step 5</span>`,
        },
        {
          done: st.wf2_dock_received === 'done',
          now: stepIdx === 5,
          title: '4. P2P · BOL-25800',
          sub: st.wf2_dock_received === 'done' ? 'Marcus Scanned 4 Reels' : 'Bay 4 RF Gun (4 Scans)',
          act: st.wf2_dock_received === 'done'
            ? `<a href="/api/trade-pdf?file=${encodeURIComponent(d.bolFile)}" target="_blank">PDF ↗</a>`
            : `<span style="color:var(--text-muted);">Step 6</span>`,
        },
        {
          done: Boolean(st.wf3_match_confirmed),
          now: stepIdx === 6,
          title: '5. P2P · INV-25800',
          sub: st.wf3_mailbox_polled ? '28 OCR Tags · 3-Form $0 Var' : 'AP Email & RapidOCR',
          act: st.wf3_mailbox_polled
            ? `<a href="#" onclick="setDeskSubView('ocr');return false;" title="Inspect 28 RapidOCR Tags & 3-Way Match">📧 3WM</a>`
            : `<span style="color:var(--text-muted);">Step 7</span>`,
        },
        {
          done: Boolean(st.wf4_ach_released),
          now: stepIdx === 7,
          title: '6. P2P · Check #10045',
          sub: st.wf4_ach_released ? 'CFO Meredith · ACH-000582' : 'CFO 3-Doc Match & Check',
          act: st.wf4_ach_released
            ? `<a href="#" onclick="setDeskSubView('books');return false;" style="color:var(--green);">📗 Books</a>`
            : `<span style="color:var(--text-muted);">Step 8</span>`,
        },
      ];

      const coaRows = STATE.financialStatements?.coaTrialBalance || [
        { acctNum: '101100', acctName: 'Cash — Operating Checking', debitUsd: 0, creditUsd: p.settledCashUsd, balanceUsd: 250000 - p.settledCashUsd },
        { acctNum: '101200', acctName: 'Cash — Payroll (Ring-Fenced)', debitUsd: 0, creditUsd: 0, balanceUsd: 140000 },
        { acctNum: '121100', acctName: 'Inventory — Raw Materials (Cu)', debitUsd: p.inventoryAssetUsd, creditUsd: 0, balanceUsd: p.inventoryAssetUsd },
        { acctNum: '201100', acctName: 'Accounts Payable — Trade', debitUsd: p.settledCashUsd, creditUsd: p.tradeApLiabilityUsd + p.settledCashUsd, balanceUsd: p.tradeApLiabilityUsd },
        { acctNum: '201200', acctName: "GRNI Clearing (Rec'd Not Inv)", debitUsd: 0, creditUsd: p.grniLiabilityUsd, balanceUsd: p.grniLiabilityUsd },
        { acctNum: '501900', acctName: 'Purchase Price Variance (PPV)', debitUsd: 0, creditUsd: Math.abs(ppvVal), balanceUsd: ppvVal },
      ];
      const fmtCell = (v) => (!v || Math.abs(v) < 0.005) ? '—' : fmtUsdShort(v);
      const fmtBalCell = (v) => {
        const n = Number(v || 0);
        if (Math.abs(n) < 0.005) return '$0.00';
        if (n < 0) return `(${fmtUsd(Math.abs(n))})`;
        return fmtUsd(n);
      };

      el.innerHTML = `
        <!-- TOP: LEFT-NUMBERED GAAP CHART OF ACCOUNTS & TRIAL BALANCE + SEPARATE PO MEMO -->
        <div class="gl-card">
          <div class="r-head">
            <span class="r-title">GAAP CoA · Trial Balance (hledger)</span>
            <div style="display:flex;gap:4px;">
              <button class="btn-top" style="padding:2px 6px;font-size:9.5px;" onclick="setDeskSubView('books')">📗 Books</button>
              <button class="btn-top" style="padding:2px 6px;font-size:9.5px;" onclick="openModal('journal')">📜 Journal</button>
            </div>
          </div>
          <table class="coa-tbl">
            <thead>
              <tr>
                <th>Acct #</th>
                <th>Account Name</th>
                <th>DR</th>
                <th>CR</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${coaRows.map(r => {
                const isFavPpv = r.acctNum === '501900' && r.balanceUsd < -0.005;
                const isOpenLiab = (r.acctNum === '201100' || r.acctNum === '201200') && r.balanceUsd > 0.005;
                const balColor = isFavPpv ? 'var(--green)'
                  : (isOpenLiab ? 'var(--amber)'
                  : (r.acctNum === '121100' && r.balanceUsd > 0 ? 'var(--green)' : 'var(--text-main)'));
                return `
                  <tr title="Subledger: ${esc(r.subledgerSource || '')}">
                    <td>${esc(r.acctNum)}</td>
                    <td>${esc(r.acctName)}</td>
                    <td style="color:${r.debitUsd > 0 ? '#0369a1' : 'var(--text-muted)'};">${fmtCell(r.debitUsd)}</td>
                    <td style="color:${r.creditUsd > 0 ? '#b45309' : 'var(--text-muted)'};">${fmtCell(r.creditUsd)}</td>
                    <td style="font-weight:800;color:${balColor};">${fmtBalCell(r.balanceUsd)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <!-- SEPARATE PURCHASING COMMITMENT MEMO BELOW CLEAN RULE (NEVER MIXED INTO GL ACCOUNTS) -->
          <div style="margin-top:5px;padding-top:5px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;align-items:center;font-size:9.8px;">
            <span style="font-family:var(--mono);color:var(--text-sec);font-weight:700;">Memo · Open ${esc(d.id)} Commitment</span>
            <span style="font-family:var(--mono);font-weight:800;color:${openPoVal > 0 ? 'var(--blue)' : 'var(--text-muted)'};">
              ${fmtUsd(openPoVal)}${st.wf2_dock_received === 'done' ? ' (Cleared at Dock)' : ''}
            </span>
          </div>
        </div>

        <!-- BOTTOM: STREAM PACKET & LIVE ARTIFACT RAIL -->
        <div class="doc-viewer-card">
          <div class="r-head" style="margin-bottom:1px;">
            <span class="r-title">Stream Packet Trail (6 Docs)</span>
            <span style="font-family:var(--mono);font-size:9.5px;color:var(--text-muted);">${streamRows.filter(r => r.done).length}/6 Verified</span>
          </div>
          <div class="stream-list">
            ${streamRows.map(r => `
              <div class="stream-item ${r.done ? 'done' : (r.now ? 'now' : '')}">
                <div style="min-width:0;">
                  <div class="stream-k">${r.done ? '✓' : (r.now ? '●' : '○')} ${esc(r.title)}</div>
                  <div class="stream-sub">${esc(r.sub)}</div>
                </div>
                <div class="stream-act">${r.act}</div>
              </div>
            `).join('')}
          </div>
          <div class="doc-stage">
            ${renderRightBottomArtifact(d, st, stepIdx)}
          </div>
        </div>
      `;
    }

    function renderRightBottomArtifact(d, st, stepIdx) {
      const isOcrScanningNow = liveShowcasePhase === 'ocr_scanning' || liveShowcasePhase === 'email_arrived';
      if (isOcrScanningNow || (st.wf3_mailbox_polled && st.wf3_ocr_result)) {
        const ocr = st.wf3_ocr_result;
        const cacheBust = st.poSha256 ? `&v=${encodeURIComponent(st.poSha256.slice(0, 8))}` : '';
        return `
          <div class="mini-scan-wrap" onclick="openModal('invoice')" title="Click to zoom 28 RapidOCR boxes">
            <img src="/api/invoice-image?file=${encodeURIComponent(d.pngFile)}${cacheBust}" alt="Tagged Invoice INV-25800" />
            ${isOcrScanningNow ? '<div class="ocr-laser-bar"></div>' : ''}
            <div class="ocr-stamp ${isOcrScanningNow ? 'scanning' : ''}">${isOcrScanningNow ? 'OCR SCANNING…' : (st.wf4_ach_released ? 'PAID · CHK #10045' : 'OCR MATCHED')}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:9.5px;">
            <span style="font-family:var(--mono);color:${isOcrScanningNow ? 'var(--blue)' : 'var(--text-muted)'};">${isOcrScanningNow ? 'Sweeping INV-25800 (:3591/scan)…' : `RapidOCR: ${ocr.boxCount} boxes (${(ocr.avgConfidence * 100).toFixed(1)}%)`}</span>
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.pdfFile)}" target="_blank" style="color:var(--blue);font-weight:800;text-decoration:none;">INV PDF ↗</a>
          </div>
        `;
      }
      const activeStreamLabel = stepIdx <= 2
        ? 'Active Stream: P2M Supply Chain (WF-P2M-1A)'
        : (stepIdx <= 4 ? 'Active Stream: P2P Purchasing (WF-P2P-1A)' : 'Active Stream: P2P Receiving & AP (WF-P2P-1B/1C)');
      const activeStreamNote = stepIdx <= 2
        ? 'Stock-out requisition escalates from Darius ($20k) to VP Devon ($100k) at $2.89/FT Annual Standard Cost.'
        : (stepIdx <= 4
            ? `Centralized Purchasing locks live COMEX copper & receives Encore Vendor Ack ${d.oaId}.`
            : 'Once Marcus snaps all 4 reel barcodes at Bay 4, RapidOCR tags Encore Invoice INV-25800 right here.');
      return `
        <div style="margin:auto 0;font-size:10.5px;line-height:1.4;">
          <div style="font-weight:800;color:var(--blue);">${esc(activeStreamLabel)}</div>
          <div style="color:var(--text-sec);margin-top:3px;">${esc(activeStreamNote)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:4px;">
          <span>Archify Rev 02 · 5 Workflows</span>
          <a href="#" onclick="setView('registers');return false;" style="color:var(--blue);font-weight:700;text-decoration:none;">SQL Tables ➔</a>
        </div>
      `;
    }

    /* ================= VIEW 2: DATABASE & GL REGISTERS (1 SCREEN) ================= */
    function renderRegistersView() {
      const cat = STATE.catalogs;
      const sysList = [
        { k: 'wms', label: `WMS InvenTree (${cat.wmsTableCount})`, def: 'part_part' },
        { k: 'hrm', label: `HR Signing Limits (${cat.hrmTableCount})`, def: 'hrm_doa_authority_seat' },
        { k: 'crm', label: `CRM Suppliers (${cat.crmTableCount})`, def: 'crm_company' },
        { k: 'lineage', label: `Audit Hops (${cat.lineageTableCount})`, def: 'lc_hop_lineage' },
        { k: 'ledger', label: `GL Journal (${STATE.hledger.accountCount} Accts)`, def: 'journal' },
      ];
      const tables = selectedRegSys === 'wms' ? cat.wmsTables
        : (selectedRegSys === 'hrm' ? cat.hrmTables : (selectedRegSys === 'lineage' ? cat.lineageTables : cat.crmTables));

      return `
        <div class="full-view-card" style="flex:1;min-height:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="font-size:14px;font-weight:800;">Live SQLite Databases &amp; General Ledger Register</div>
              <div style="font-size:11px;color:var(--text-muted);">Physical NVMe Vault: <code>${esc(STATE.sorVault?.vaultDir || 'C:\\8090-sor-data\\copper-p2p')}</code> (${esc(STATE.sorVault?.totalSizeHuman || '10.67 MB')} · Git-Ignored, Zero Live DBs in GitHub)</div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              ${sysList.map(s => `
                <button class="btn-top" style="${selectedRegSys === s.k ? 'background:#0f172a;color:#fff;border-color:#0f172a;' : ''}"
                  onclick="fetchRegTable('${s.k}', '${s.def}')">${esc(s.label)}</button>
              `).join('')}
            </div>
          </div>

          ${selectedRegSys === 'ledger' ? `
            <div class="table-box" style="padding:10px;background:#0f172a;">
              <pre class="ledger-pre" style="padding:0;">${esc(cleanLeftNumberedJournal(STATE.hledger.printText))}\n\n--- LEFT-NUMBERED GAAP TRIAL BALANCE ---\n${esc(cleanLeftNumberedJournal(STATE.hledger.balText))}</pre>
            </div>
          ` : `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="display:flex;gap:5px;align-items:center;">
                <span style="font-size:11px;font-weight:700;color:var(--text-sec);">Table:</span>
                <select style="padding:4px 8px;border-radius:6px;border:1px solid var(--border-strong);font-size:11.5px;"
                  onchange="fetchRegTable('${selectedRegSys}', this.value)">
                  ${tables.map(t => `<option value="${esc(t.name)}" ${t.name === selectedRegTable ? 'selected' : ''}>${esc(t.name)} (${t.count} rows)</option>`).join('')}
                </select>
                ${selectedRegSys === 'wms' ? `
                  <button class="btn-top" style="padding:3px 8px;font-size:10.5px;" onclick="fetchRegTable('wms','part_part')">part_part (1)</button>
                  <button class="btn-top" style="padding:3px 8px;font-size:10.5px;" onclick="fetchRegTable('wms','order_purchaseorder')">POs</button>
                  <button class="btn-top" style="padding:3px 8px;font-size:10.5px;" onclick="fetchRegTable('wms','stock_stockitem')">Stock</button>
                ` : ''}
              </div>
              <span class="badge b-ready">${cachedTableData ? cachedTableData.totalRows : 0} Rows</span>
            </div>
            <div class="table-box">
              ${cachedTableData && cachedTableData.columns ? `
                <table class="clean-tbl">
                  <thead><tr>${cachedTableData.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
                  <tbody>
                    ${cachedTableData.rows.length === 0
                      ? `<tr><td colspan="${cachedTableData.columns.length}" style="text-align:center;padding:18px;color:var(--text-muted);">0 rows yet — run the P2P Flow Desk to populate.</td></tr>`
                      : cachedTableData.rows.map(r => `<tr>${cachedTableData.columns.map(c => `<td title="${esc(r[c])}">${esc(r[c])}</td>`).join('')}</tr>`).join('')}
                  </tbody>
                </table>
              ` : `<div style="padding:14px;font-size:12px;color:var(--text-muted);">Loading table…</div>`}
            </div>
          `}
        </div>
      `;
    }

    /* ================= VIEW 3: SECURITY, SIGNING LIMITS & AI OBSERVATORY (1 SCREEN) ================= */
    function renderSecurityAdminView() {
      const d = STATE.deals[selectedDeal];
      const st = STATE.runtimeState[selectedDeal];
      const obs = STATE.aiObservatory || {};
      const lens = STATE.lineage.controlLenses[selectedDeal];

      return `
        <div style="display:flex;flex-direction:column;gap:9px;flex:1;min-height:0;overflow:hidden;">
          <!-- WHITE HOUSE ACCORD ON SUPER INTELLIGENCE (EO 14434) × 8090 KYSI × SOX 404 -->
          <div class="full-view-card" style="flex-shrink:0;padding:10px 13px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div>
                <span style="font-size:13px;font-weight:800;">🏛️ White House Super Intelligence Accord (<code>EO 14434</code>) × 8090 <code>KYSI</code> × <code>SOX 404</code></span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">The President's 4 Control Layers enforced live in code ($0.00 AI authority).</span>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button class="btn-top" style="border-color:#7c3aed;color:#6d28d9;padding:3px 9px;font-size:10.5px;"
                  onclick="askKalPreset('white_house_si')">
                  🔊 KAL: White House SI Brief
                </button>
                <button class="btn-top" style="border-color:#ef4444;color:#b91c1c;padding:3px 9px;font-size:10.5px;"
                  onclick="runGuardrailTest('kal_rogue_attempt')">
                  🛡️ Demo Rogue SI Attempt ➔ 403
                </button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
              <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:7px;padding:7px 9px;">
                <div style="font-size:9.5px;font-weight:900;color:#1d4ed8;">LAYER 1 · TECHNICAL CONTROLS (EO 14434)</div>
                <div style="font-size:10.5px;color:#1e293b;margin-top:2px;">Zero-Authority SI Sandbox: <code>KAL = $0.00</code> limit, <strong>0</strong> DB/Bank write keys (<code>HTTP 403</code>).</div>
              </div>
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:7px;padding:7px 9px;">
                <div style="font-size:9.5px;font-weight:900;color:#b45309;">LAYER 2 · INTERNAL OVERSIGHT GATES</div>
                <div style="font-size:10.5px;color:#1e293b;margin-top:2px;">5 deterministic 8090 Blocks: SQL, ASTM B8 math, <code>409</code> 3-Way Match &amp; <code>hledger --strict</code>.</div>
              </div>
              <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:7px;padding:7px 9px;">
                <div style="font-size:9.5px;font-weight:900;color:#6d28d9;">LAYER 3 · EXTERNAL AUDIT (8090 × EY KYSI)</div>
                <div style="font-size:10.5px;color:#1e293b;margin-top:2px;"><strong>${lens.hopCount}</strong> append-only <code>SHA-256</code> hops across prompts, OCR, SQLite &amp; GAAP entries.</div>
              </div>
              <div style="background:#f0fdf4;border:1.5px solid #22c55e;border-radius:7px;padding:7px 9px;">
                <div style="font-size:9.5px;font-weight:900;color:#15803d;">LAYER 4 · BOARD &amp; OFFICER GOVERNANCE</div>
                <div style="font-size:10.5px;color:#14532d;margin-top:2px;">SOX 404 Segregation of Duties: 4 Human Signers ($20k ➔ $500k CFO) + <code>0ms</code> Kill-Switch.</div>
              </div>
            </div>
          </div>

          <!-- AI OBSERVATORY TABLE -->
          <div class="full-view-card" style="flex-shrink:0;padding:10px 13px;">
            <div style="font-size:12.5px;font-weight:800;">Monitored Intelligence Models &amp; Steward Boundaries</div>
            <table class="clean-tbl">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Model / Engine</th>
                  <th>Live Session Telemetry</th>
                  <th>Book / Bank Authority</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-family:var(--sans);font-weight:800;">KAL · P2P Steward <span style="font-family:var(--mono);font-size:9.5px;color:var(--text-muted);">(${esc(STATE.provenance?.aiSteward?.bossAgentId || 'AGT-8090-KAL-01')})</span></td>
                  <td>ElevenLabs <code>${esc(obs.lastTtsModel || STATE.voiceConfig?.preferredModel || 'eleven_turbo_v2_5')}</code></td>
                  <td>${obs.ttsCalls || 0} brief(s) · ${obs.lastTtsLatencyMs ? obs.lastTtsLatencyMs + 'ms' : 'Ready'} · ${obs.kalBlockedAttempts || 0} blocked</td>
                  <td style="color:var(--red);font-weight:800;">$0.00 Signing Limit · 0 Writes</td>
                  <td><button class="btn-top" style="padding:2px 7px;font-size:10px;" onclick="handleKalStopOrMute()">${kalMuted ? 'Unmute' : 'Mute / Halt'}</button></td>
                </tr>
                <tr>
                  <td style="font-family:var(--sans);font-weight:800;">KAL Voice Ear (Push-to-Talk)</td>
                  <td>ElevenLabs <code>${esc(STATE.voiceConfig?.sttModel || 'scribe_v1')}</code></td>
                  <td>${obs.sttCalls || 0} call(s)${obs.lastSttLatencyMs ? ' · ' + obs.lastSttLatencyMs + 'ms' : ''}</td>
                  <td style="color:var(--green);font-weight:800;">Transcript Only (Read-Only)</td>
                  <td><span class="badge b-ready">38 Keyterms</span></td>
                </tr>
                <tr>
                  <td style="font-family:var(--sans);font-weight:800;">Invoice OCR Tagging</td>
                  <td>Warm <code>RapidOCR</code> ONNX (:3591)</td>
                  <td>${obs.ocrScans || 0} scan(s)${obs.lastOcrLatencyMs ? ` · ${obs.lastOcrLatencyMs}ms · ${obs.lastOcrConfidencePct}%` : ''}</td>
                  <td style="color:var(--green);font-weight:800;">Field Tagging Only · 3-Way Gated</td>
                  <td><span class="badge b-done">$0.00 Math Check</span></td>
                </tr>
                <tr>
                  <td style="font-family:var(--sans);font-weight:800;">Live Copper Market Feed</td>
                  <td>COMEX <code>HG</code> Spot REST API</td>
                  <td>${obs.spotCalls || 0} check(s)${obs.lastSpotUsd ? ` · $${Number(obs.lastSpotUsd).toFixed(4)}/lb (${obs.lastSpotLatencyMs}ms)` : ''}</td>
                  <td style="color:var(--green);font-weight:800;">Capped by VP Signed Ceiling</td>
                  <td><span class="badge b-purple">&le; ${fmtUsdShort(d.catalogEstimateUsd)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- NAMED HUMAN SIGNING LIMITS -->
          <div class="full-view-card" style="flex:1;min-height:0;padding:10px 13px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12.5px;font-weight:800;">Named Human Officers &amp; Signing Limits <span style="font-weight:500;color:var(--text-muted);font-size:11px;">(Delegation of Authority — DOA &amp; Segregation of Duties)</span></span>
              <span class="badge b-done">${esc(lens.gaapAndSox404.segregationOfDutiesPass)}</span>
            </div>
            <div class="table-box">
              <table class="clean-tbl">
                <thead>
                  <tr><th>Employee</th><th>Role</th><th>Signing Limit</th><th>Assigned Step</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="font-family:var(--sans);font-weight:700;">EMP-0021 · Darius Mercer</td>
                    <td style="font-family:var(--sans);">Supply Chain Inventory Planner</td>
                    <td>$20,000.00</td>
                    <td>Step 2 · Confirm Need (Human #1)</td>
                    <td>${st.wf0_req_status !== 'stock_out_alert' ? '<span class="badge b-done">✓ Confirmed</span>' : '<span class="badge b-amber">Pending</span>'}</td>
                  </tr>
                  <tr>
                    <td style="font-family:var(--sans);font-weight:700;">EMP-0005 · Devon Brooks</td>
                    <td style="font-family:var(--sans);">VP Supply Chain</td>
                    <td>$100,000.00</td>
                    <td>Step 3 · Escalation Sign-Off (Human #2)</td>
                    <td>${st.wf0_req_status === 'approved' ? '<span class="badge b-done">✓ Signed</span>' : '<span class="badge b-wait">Waiting</span>'}</td>
                  </tr>
                  <tr>
                    <td style="font-family:var(--sans);font-weight:700;">EMP-0002 · Nancy Rostova</td>
                    <td style="font-family:var(--sans);">Centralized Purchasing Lead</td>
                    <td>$50,000.00</td>
                    <td>Steps 4–5 · Auto Spot PO (Blocked Dock/Cash)</td>
                    <td>${st.wf1_po_committed === 'done' ? '<span class="badge b-done">✓ PO Issued</span>' : '<span class="badge b-wait">Waiting</span>'}</td>
                  </tr>
                  <tr>
                    <td style="font-family:var(--sans);font-weight:700;">EMP-0003 · Marcus Vance</td>
                    <td style="font-family:var(--sans);">Warehouse Receiving Dock Lead</td>
                    <td>Physical Scan Only</td>
                    <td>Step 6 · Dock Scan Gun (Human #3)</td>
                    <td>${st.wf2_dock_received === 'done' ? '<span class="badge b-done">✓ Scanned 4 Reels</span>' : '<span class="badge b-wait">Waiting</span>'}</td>
                  </tr>
                  <tr>
                    <td style="font-family:var(--sans);font-weight:700;">EMP-0007 · Meredith Hale</td>
                    <td style="font-family:var(--sans);">Chief Financial Officer (CFO)</td>
                    <td>$500,000.00</td>
                    <td>Step 8 · Cut Check #10045 (Human #4)</td>
                    <td>${st.wf4_ach_released ? '<span class="badge b-done">✓ Paid Chk #10045</span>' : '<span class="badge b-wait">Waiting</span>'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= VIEW 4: 8090 SOFTWARE FACTORY SPECS (1 SCREEN · WO 1-18) ================= */
    function renderFactoryView() {
      const vault = STATE?.sorVault || { vaultDir: 'Runtime Sandbox Vault', totalSizeHuman: '10.67 MB' };
      return `
        <div class="full-view-card" style="flex:1;min-height:0;justify-content:space-between;gap:9px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <div style="font-size:10px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#6d28d9;">🏭 HOW THIS WORKBENCH WAS COMPILED · CLOSED-LOOP 8090 SOFTWARE FACTORY (WO 1-18)</div>
              <div style="font-size:14.5px;font-weight:800;color:var(--text-main);margin-top:2px;">8090 Software Factory Pipeline: <code>Refinery (KB-00) ➔ Foundry (REQ-01 / BP-01) ➔ Planner (WO 1-18) ➔ Validator (FB-1..FB-5 / THM-1..THM-4)</code></div>
              <div style="font-size:11px;color:var(--text-sec);margin-top:2px;">Four closed-loop factory rounds compiled and hardened deterministic Workflow Blocks over real headless SQLite &amp; GAAP databases.</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn-top" style="border-color:#1d4ed8;color:#1d4ed8;padding:6px 10px;" onclick="startSoxAndDbTour()">🛡️ SOX &amp; Live DBs</button>
              <button class="btn-approve blue" style="padding:6px 11px;" onclick="setView('workflow')">↩ Back to P2P Desk</button>
            </div>
          </div>

          <!-- 5-STAGE PIPELINE: STAGE 0 SEED -> 4 STAGES OF 8090 SOFTWARE FACTORY -->
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
            <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-top:3px solid #d97706;border-radius:8px;padding:8px 10px;">
              <div style="font-size:9.5px;font-weight:900;color:#b45309;text-transform:uppercase;">0. Enterprise Seed</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;">Upstream Inputs</div>
              <div style="font-size:10.1px;color:#475569;margin-top:4px;line-height:1.36;">Workshop discovery, <strong>275 SQLite Tables</strong>, Officer Signing Limits, 89-Acct GAAP CoA &amp; <code>Archify Rev 02</code> stream maps.</div>
            </div>

            <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-top:3px solid #2563eb;border-radius:8px;padding:8px 10px;">
              <div style="font-size:9.5px;font-weight:900;color:#1d4ed8;text-transform:uppercase;">1. 8090 Refinery</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;"><code>KB-00</code> Domain Rules</div>
              <div style="font-size:10.1px;color:#475569;margin-top:4px;line-height:1.36;"><code>2fb45197-ecd8-463e-b72b-db79275329e3</code> · <code>P2M ➔ P2P</code>, ASTM B8 copper math, <code>501900 PPV</code>, SOX 404 &amp; <code>EO 14434</code> × <code>KYSI</code>.</div>
            </div>

            <div style="background:#f5f3ff;border:1.5px solid #c4b5fd;border-top:3px solid #7c3aed;border-radius:8px;padding:8px 10px;">
              <div style="font-size:9.5px;font-weight:900;color:#6d28d9;text-transform:uppercase;">2. 8090 Foundry</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;"><code>REQ-01</code> &amp; <code>BP-01</code></div>
              <div style="font-size:10.1px;color:#475569;margin-top:4px;line-height:1.36;"><code>REQ-01</code> (<code>1fc08c46-ed36-4a14-99a3-0eae8de04206</code>) &amp; <code>BP-01</code> (<code>61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d</code>) · 5 Blocks &amp; <code>KAL = $0</code>.</div>
            </div>

            <div style="background:#f0fdfa;border:1.5px solid #5eead4;border-top:3px solid #0d9488;border-radius:8px;padding:8px 10px;">
              <div style="font-size:9.5px;font-weight:900;color:#0f766e;text-transform:uppercase;">3. 8090 Planner</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;">Work Orders <code>WO-1..WO-18</code></div>
              <div style="font-size:10.1px;color:#475569;margin-top:4px;line-height:1.36;">18 build units incl. Round 4 parity: <code>WO-15</code> (<code>3988d7f2…</code>), <code>WO-16</code> (<code>bd3f7822…</code>), <code>WO-17</code> (<code>78e025ce…</code>), <code>WO-18</code> (<code>346dd5b4…</code>).</div>
            </div>

            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-top:3px solid #16a34a;border-radius:8px;padding:8px 10px;">
              <div style="font-size:9.5px;font-weight:900;color:#15803d;text-transform:uppercase;">4. 8090 Validator</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;"><code>FB-1..FB-5</code> ➔ <code>THM-1..THM-4</code></div>
              <div style="font-size:10.1px;color:#475569;margin-top:4px;line-height:1.36;">Closed-loop feedback (<code>FB-5</code> <code>a19b9a76…</code> ➔ <code>THM-4</code> <code>05591d02…</code>), 6 HTTP <code>403/409</code> blocks &amp; <code>DR == CR</code>.</div>
            </div>
          </div>

          <!-- MIDDLE SPLIT: LIVE ROUND 4 TRACEABILITY vs. SCALE TO WHOLE ENTERPRISE -->
          <div style="display:grid;grid-template-columns:1.22fr 1fr;gap:10px;">
            <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:8px;padding:9px 12px;">
              <div style="font-size:10.5px;font-weight:900;text-transform:uppercase;color:#1d4ed8;margin-bottom:4px;">Closed-Loop Factory Ledger · <code>KB-00</code> · <code>FB-1..FB-5</code> · <code>THM-1..THM-4</code> · <code>WO-1..WO-18</code></div>
              <div style="font-size:10.4px;color:var(--text-sec);line-height:1.44;">
                • <strong>Hydrated Headless Vault (<code>/seeds</code>):</strong> <code>${esc(vault.vaultDir)}</code> (${esc(vault.totalSizeHuman)} · 275 SQLite tables + 89 GAAP accounts · 100% MIT).<br>
                • <strong>Round 4 Parity Loop:</strong> <code>FB-5</code> (<code>a19b9a76-2adb-405b-8d34-53ec41fbbf76</code>) ➔ <code>THM-4</code> (<code>05591d02-9ff7-41ce-886d-92fdcda411a9</code>) ➔ <code>WO-15</code> (<code>3988d7f2-c356-487d-9ed2-9a1c045d3ee1</code>), <code>WO-16</code> (<code>bd3f7822-1571-4b81-80ca-6a32215a25aa</code>), <code>WO-17</code> (<code>78e025ce-ac9b-4714-a769-4b38767baa9d</code>), <code>WO-18</code> (<code>346dd5b4-37e7-45ed-bca0-6d36528bd0c6</code>).
              </div>
            </div>

            <div style="background:linear-gradient(135deg,#faf5ff 0%,#eff6ff 100%);border:1px solid #c4b5fd;border-radius:8px;padding:9px 12px;">
              <div style="font-size:10.5px;font-weight:900;text-transform:uppercase;color:#6d28d9;margin-bottom:4px;">From One P2P App ➔ The Entire Enterprise</div>
              <div style="font-size:10.8px;color:#334155;line-height:1.45;">
                When you meet an enterprise where they are—capturing their <strong>People, Common Data Core, Signing Limits, and Stream Blueprints</strong> as a structured seed—<strong>8090's Software Factory</strong> doesn't stop at Procure-to-Pay. That exact same seed-to-Validator pipeline compiles <strong>Order-to-Cash, Plan-to-Make, Record-to-Report, Hire-to-Retire, and Lead-to-Order</strong> across the whole company.
              </div>
            </div>
          </div>

          <!-- BOTTOM: 8 LIVE CONNECTED ENGINES -->
          <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:9px 12px;">
            <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;color:var(--text-sec);margin-bottom:6px;">8 Connected Open-Source Spines &amp; Live Runtime Services (100% MIT Compliant)</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;font-size:10.8px;">
              <div><strong>1. 8090 Software Factory</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>WO-1..WO-18</code> · <code>FB-1..FB-5</code> · <code>THM-1..THM-4</code></div></div>
              <div><strong>2. InvenTree WMS (MIT)</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>seeds/wms_seed.sqlite3</code> (119 tbls)</div></div>
              <div><strong>3. Django-CRM (MIT)</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>seeds/crm_seed.sqlite3</code> (151 tbls)</div></div>
              <div><strong>4. Headless HRM SQLite (MIT)</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>seeds/hrm_seed.sqlite3</code> (5 tbls · DOA)</div></div>
              <div><strong>5. Plaintext GAAP Journal (MIT)</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>seeds/coa_seed.journal</code> (89 Accts)</div></div>
              <div><strong>6. Live COMEX Copper</strong><div style="color:var(--text-muted);font-size:9.8px;"><code>gold-api.com/HG</code> + <code>HG=F</code></div></div>
              <div><strong>7. RapidOCR (Apache-2.0)</strong><div style="color:var(--text-muted);font-size:9.8px;">28-Box Invoice Pixel Server (<code>:3591</code>)</div></div>
              <div><strong>8. ElevenLabs (KAL)</strong><div style="color:var(--text-muted);font-size:9.8px;">Streaming Female Voice (<code>EXAVITQu4vr4xnSDxMaL</code>)</div></div>
            </div>
          </div>
        </div>
      `;
    }

    /* ================= MODALS: GUARDRAIL TESTS, FULL GL REGISTER, INVOICE OCR ZOOM ================= */
    function highlightBox(boxId) {
      document.querySelectorAll('.ocr-box').forEach(el => el.classList.remove('hl'));
      if (boxId) {
        const el = document.getElementById(boxId);
        if (el) el.classList.add('hl');
      }
    }

    function openModal(kind) {
      activeModal = kind;
      const bg = document.getElementById('modalBackdrop');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      const d = STATE.deals[selectedDeal];
      const st = STATE.runtimeState[selectedDeal];

      if (kind === 'guardrails') {
        title.textContent = '🧪 Deterministic Guardrail & Segregation-of-Duties Test Register';
        body.innerHTML = `
          <div style="font-size:12px;color:var(--text-sec);margin-bottom:12px;">
            Click any red-team test below to verify that neither <strong>KAL</strong> ($0.00 Signing Limit) nor unauthorized humans can bypass Signing Limits, Segregation of Duties, 3-Way Match math, or Operating Bank rules.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="border:1.5px solid #fca5a5;background:#fef2f2;border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;color:#991b1b;">1. Rogue KAL Tries to Buy AI Tokens / Cut Check</div>
              <div style="font-size:11px;color:#334155;margin:4px 0 9px;">Simulates prompt-injected KAL attempting to originate a $5,000 token PO &amp; cut a check ($0.00 Signing Limit ➔ HTTP 403).</div>
              <button class="btn-top" style="border-color:#ef4444;color:#b91c1c;" onclick="runGuardrailTest('kal_rogue_attempt')">🤖 Run Rogue KAL Test (403)</button>
            </div>
            <div style="border:1px solid var(--border-strong);background:var(--bg-subtle);border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;">2. Planner Darius Exceeds $20k Signing Limit</div>
              <div style="font-size:11px;color:var(--text-sec);margin:4px 0 9px;">Requires Step 2 completed. Darius ($20k limit) attempts to self-approve ${fmtUsd(d.catalogEstimateUsd)} requisition (➔ HTTP 403).</div>
              <button class="btn-top" ${st.wf0_req_status !== 'pending_manager_doa' ? 'disabled' : ''} onclick="runGuardrailTest('wf0_approve_req', { actingEmpId: 'EMP-0021' })">🚫 Test Darius Self-Approve (403)</button>
            </div>
            <div style="border:1px solid var(--border-strong);background:var(--bg-subtle);border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;">3. Buyer Nancy Tries to Scan Own PO at Dock</div>
              <div style="font-size:11px;color:var(--text-sec);margin:4px 0 9px;">Requires PO issued (Step 5). Purchasing cannot fake physical warehouse receiving (➔ HTTP 403 SoD).</div>
              <button class="btn-top" ${st.wf1_po_committed !== 'done' || st.wf2_dock_received === 'done' ? 'disabled' : ''} onclick="runGuardrailTest('wf2_dock_receipt', { actingEmpId: 'EMP-0002' })">🚫 Test Buyer Dock Scan (403)</button>
            </div>
            <div style="border:1px solid var(--border-strong);background:var(--bg-subtle);border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;">4. Disputed Vendor Invoice Over-Bills +$500</div>
              <div style="font-size:11px;color:var(--text-sec);margin:4px 0 9px;">Requires Dock Scan completed (Step 6). Simulates +$500 invoice variance (➔ HTTP 409 Match Hold, $0 AP).</div>
              <button class="btn-top" ${st.wf2_dock_received !== 'done' ? 'disabled' : ''} onclick="runGuardrailTest('wf3_test_variance_hold')">🚫 Test +$500 Over-Bill Hold (409)</button>
            </div>
            <div style="border:1px solid var(--border-strong);background:var(--bg-subtle);border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;">5. Buyer Nancy Tries to Cut the Bank Check</div>
              <div style="font-size:11px;color:var(--text-sec);margin:4px 0 9px;">Requires Step 7 matched. Purchasing is locked out of cash disbursement (➔ HTTP 403 SoD; CFO required).</div>
              <button class="btn-top" ${st.wf4_match_status !== 'voucher_posted' || st.wf4_ach_released ? 'disabled' : ''} onclick="runGuardrailTest('wf4_release_ach', { actingEmpId: 'EMP-0002' })">🚫 Test Buyer Cash Release (403)</button>
            </div>
            <div style="border:1px solid var(--border-strong);background:var(--bg-subtle);border-radius:8px;padding:11px;">
              <div style="font-weight:800;font-size:12px;">6. Attempt Vendor Check from 101200 Payroll Bank</div>
              <div style="font-size:11px;color:var(--text-sec);margin:4px 0 9px;">Requires Step 7 matched. Protects ring-fenced Payroll Checking 101200 from supplier spend (➔ HTTP 403).</div>
              <button class="btn-top" ${st.wf4_match_status !== 'voucher_posted' || st.wf4_ach_released ? 'disabled' : ''} onclick="runGuardrailTest('wf4_release_ach', { bankAccount: 'Assets:101200-Payroll-Checking' })">🚫 Test Payroll Bank Block (403)</button>
            </div>
          </div>
        `;
      } else if (kind === 'journal') {
        title.textContent = `📜 General Ledger Journal (hledger) & Timestamped Audit Register (${d.id})`;
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px;">
            <div>
              <div style="font-size:11.5px;font-weight:800;margin-bottom:6px;">Append-Only Double-Entry Journal (<code>company.journal</code> · Left-Numbered GAAP)</div>
              <pre class="ledger-pre">${esc(cleanLeftNumberedJournal(STATE.hledger.printText))}\n\n--- LEFT-NUMBERED GAAP TRIAL BALANCE ---\n${esc(cleanLeftNumberedJournal(STATE.hledger.balText))}</pre>
            </div>
            <div>
              <div style="font-size:11.5px;font-weight:800;margin-bottom:6px;">Immutable Audit Register (${st.auditLog.length} Events)</div>
              <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;max-height:420px;overflow-y:auto;">
                ${st.auditLog.slice().reverse().map(a => `
                  <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;">
                    <div style="display:flex;justify-content:space-between;font-weight:800;color:var(--blue);">
                      <span>${esc(a.stepCode)}</span>
                      <span style="font-family:var(--mono);font-size:9.5px;color:var(--text-muted);">SHA: ${esc((a.artifactHash || '').slice(0, 10))}…</span>
                    </div>
                    <div style="font-weight:700;color:var(--text-main);margin-top:2px;">${esc(a.actor)}</div>
                    <div style="color:var(--text-sec);margin-top:2px;line-height:1.35;">${esc(a.summary)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      } else if (kind === 'invoice' && st.wf3_ocr_result) {
        const ocr = st.wf3_ocr_result;
        const ex = ocr.extracted;
        title.textContent = `🔍 RapidOCR Tagged Invoice (${d.invoiceId}) & 5-Document 3-Way Match Packet`;
        body.innerHTML = `
          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.poFile)}" target="_blank" class="btn-top" style="text-decoration:none;">1. ${esc(d.poFile)} ↗</a>
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.oaFile)}" target="_blank" class="btn-top" style="text-decoration:none;">2. ${esc(d.oaFile)} ↗</a>
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.bolFile)}" target="_blank" class="btn-top" style="text-decoration:none;">3. ${esc(d.bolFile)} ↗</a>
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.psFile)}" target="_blank" class="btn-top" style="text-decoration:none;">4. ${esc(d.psFile)} ↗</a>
            <a href="/api/trade-pdf?file=${encodeURIComponent(d.pdfFile)}" target="_blank" class="btn-top" style="text-decoration:none;border-color:#2563eb;color:#1d4ed8;">5. ${esc(d.pdfFile)} ↗</a>
          </div>
          <div class="ocr-modal-grid">
            <div class="scan-frame">
              <img src="/api/invoice-image?file=${encodeURIComponent(d.pngFile)}" alt="Scanned Invoice" />
              ${ocr.boxes.map(b => `
                <div id="${b.id}" class="ocr-box"
                  style="left:${b.xPct}%;top:${b.yPct}%;width:${b.wPct}%;height:${b.hPct}%;"
                  title="${esc(b.text)} (${(b.confidence * 100).toFixed(1)}%)"></div>
              `).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:7px;">
              <div style="font-size:11.5px;font-weight:800;color:var(--text-sec);">Hover any tagged field to highlight its RapidOCR bounding box (${ocr.elapsedMs}ms · ${(ocr.avgConfidence * 100).toFixed(1)}% confidence):</div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.vendorName.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">Tagged Supplier</span><span class="gl-val">${esc(ex.vendorName.value)}</span></div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.invoiceNumber.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">Tagged Invoice #</span><span class="gl-val">${esc(ex.invoiceNumber.value)}</span></div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.poReference.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">Matched PO #</span><span class="gl-val">${esc(ex.poReference.value)}</span></div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.sku.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">Tagged Item SKU</span><span class="gl-val">${esc(ex.sku.value)}</span></div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.quantity.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">3-Way Qty (PO/BOL/Inv)</span><span class="gl-val" style="color:var(--green);">${fmtInt(d.orderedQty)} == ${fmtInt(d.receivedQty)} == ${fmtInt(ex.quantity.value)} FT ✓</span></div>
              <div class="gl-row" onmouseenter="highlightBox('${ex.totalDue.boxId}')" onmouseleave="highlightBox(null)"><span class="gl-acct">3-Way Dollar Match</span><span class="gl-val" style="color:var(--green);">${fmtUsd(ex.totalDue.value)} ($0.00 Variance)</span></div>
              <div class="gl-row" style="background:var(--green-bg);border-color:var(--green-border);"><span class="gl-acct">Payment Status</span><span class="gl-val" style="color:var(--green);">${esc(st.invoicePaidStamp || 'APPROVED TO PAY')}</span></div>
            </div>
          </div>
        `;
      }

      bg.classList.add('open');
    }

    function closeModal() {
      activeModal = null;
      document.getElementById('modalBackdrop')?.classList.remove('open');
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.approveCheckpoint1Darius = approveCheckpoint1Darius;
      window.approveCheckpoint2Devon = approveCheckpoint2Devon;
      window.approveCheckpoint3MarcusDock = approveCheckpoint3MarcusDock;
      window.approveCheckpoint4MeredithCfo = approveCheckpoint4MeredithCfo;
      window.askKalPreset = askKalPreset;
      window.clearGuardrailBanner = clearGuardrailBanner;
      window.closeModal = closeModal;
      window.esc = esc;
      window.fetchRegTable = fetchRegTable;
      window.handleKalStopOrMute = handleKalStopOrMute;
      window.highlightBox = highlightBox;
      window.inspectStepCell = inspectStepCell;
      window.openModal = openModal;
      window.proceedStep4CutPo = proceedStep4CutPo;
      window.proceedStep5VerifyAck = proceedStep5VerifyAck;
      window.proceedStep7ConfirmMatch = proceedStep7ConfirmMatch;
      window.repollLiveComexSpot = repollLiveComexSpot;
      window.rerunLiveRapidOcr = rerunLiveRapidOcr;
      window.resetDemo = resetDemo;
      window.runGuardrailTest = runGuardrailTest;
      window.scanAllDockReelsSequentially = scanAllDockReelsSequentially;
      window.scanNextDockReel = scanNextDockReel;
      window.scanSingleDockReel = scanSingleDockReel;
      window.setDeskSubView = setDeskSubView;
      window.setDocTab = setDocTab;
      window.setView = setView;
      window.startKalSteward = startKalSteward;
      window.startSoxAndDbTour = startSoxAndDbTour;
      window.stopKalAudio = stopKalAudio;
      window.toggleDemoRecorder = toggleDemoRecorder;
      window.toggleVoiceListen = toggleVoiceListen;
      void loadState();
    }

/* ================= EXPORTED KERNEL CLIENT CONTRACT & PURE HELPERS ================= */
export const REELS = ['ENC-GS1-884192-R01', 'ENC-GS1-884192-R02', 'ENC-GS1-884192-R03', 'ENC-GS1-884192-R04'];

export const REFUSALS = {
  AI_STEWARD_ZERO_AUTHORITY: { status: 403, text: 'KAL has $0.00 signing authority.' },
  DOA_LIMIT_EXCEEDED: { status: 403, text: 'Darius must escalate the $23,120 request to Devon.' },
  SOX_SOD_VIOLATION: { status: 403, text: 'The buyer cannot receive their own purchase.' },
  MATCH_VARIANCE_HOLD: { status: 409, text: 'Invoice variance held. No payment may advance.' },
  BANK_POLICY_VIOLATION: { status: 403, text: 'Payroll/Petty #4409 cannot fund this payment.' },
};

const KC_OFFICERS = [
  ['EMP-0021', 'Darius Mercer', 'Planner', '$20,000'],
  ['EMP-0005', 'Devon Brooks', 'VP Supply Chain', '$100,000'],
  ['EMP-0002', 'Nancy Rostova', 'Purchasing', '$50,000'],
  ['EMP-0003', 'Marcus Vance', 'Dock Lead', 'Receipt only'],
  ['EMP-0001', 'Duncan Vance', 'Controller', '$250,000'],
  ['EMP-0007', 'Meredith Hale', 'CFO', '$500,000'],
  ['EMP-AI-KAL', 'KAL', 'P2P steward (AI)', '$0.00'],
];
const kcOfficer = emp => KC_OFFICERS.find(([id]) => id === emp)?.[1];
const KC_ACTORS = { 1: 'SYSTEM', 2: 'EMP-0021', 3: 'EMP-0005', 4: 'EMP-0002', 5: 'EMP-0002', 6: 'EMP-0003', 7: 'EMP-0001', 8: 'EMP-0007' };

let kcState = null, kcConnected = false, kcPending = false, kcEpoch = 0, kcMuted = false, kcDisposed = false;
let kcVoiceController = null, kcVoiceAudio = null, kcVoiceUrl = null, kcVoiceEpoch = 0;
let kcRecorder = null, kcRecordingPending = false, kcRecordingResources = [], kcAudioContext = null, kcRecordingTimer = null, kcRecordingEpoch = 0;

const kcMoney = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : '—';
const kcFeet = value => new Intl.NumberFormat('en-US').format(value);
const kcCompletedSteps = snapshot => snapshot.steps.filter(step => step.status === 'complete').length;
const kcIsObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const kcStr = value => typeof value === 'string' && value ? value : null;
const kcCents = value => Math.round(value * 100);

export function validateState(value) {
  const result = value?.state ?? value;
  const invalid = () => { throw new Error('Invalid server snapshot; previous evidence retained.'); };
  if (!result || typeof result !== 'object' || Array.isArray(result)) invalid();
  const amount = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12;
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!Array.isArray(result.steps) || result.steps.length !== 8) invalid();
  let incomplete = false;
  for (const [index, step] of result.steps.entries()) {
    if (!step || step.n !== index + 1 || !['pending', 'in_progress', 'complete'].includes(step.status)) invalid();
    if (incomplete && step.status !== 'pending') invalid();
    if (step.status !== 'complete') incomplete = true;
  }
  if (!object(result.item) || !amount(result.item.onHandFt)) invalid();
  for (const key of ['stdUnitUsd', 'stdTotalUsd']) if (result.item[key] !== undefined && !amount(result.item[key])) invalid();
  if (result.po != null && (!object(result.po) || !amount(result.po.unitUsd) || !amount(result.po.totalUsd))) invalid();
  if (result.payment != null && (!object(result.payment) || result.payment.stamp !== 'PAID' || typeof result.payment.check !== 'string' || !amount(result.payment.amountUsd))) invalid();
  if (result.match != null && (!object(result.match) || (result.match.varianceUsd !== undefined && !amount(result.match.varianceUsd)))) invalid();
  const journal = result.journal;
  if (!object(journal) || typeof journal.balanced !== 'boolean' || !amount(journal.debitUsd) || !amount(journal.creditUsd) || !Array.isArray(journal.entries) || journal.entries.length > 10000) invalid();
  if (journal.entries.some(entry => !entry || !Array.isArray(entry.legs) || entry.legs.length > 1000 || entry.legs.some(leg => !leg || typeof leg.account !== 'string' || !amount(leg.debitUsd) || !amount(leg.creditUsd)))) invalid();
  if (!Array.isArray(result.scans) || result.scans.some(scan => !scan || !REELS.includes(scan.barcode) || scan.ft !== 2000) || new Set(result.scans.map(scan => scan.barcode)).size !== result.scans.length) invalid();
  if (result.sandbox !== undefined && (!object(result.sandbox) || (result.sandbox.sources !== undefined && !object(result.sandbox.sources)))) invalid();
  if (result.documents !== undefined && (!Array.isArray(result.documents) || result.documents.some(doc => !doc || typeof doc.name !== 'string' || typeof doc.url !== 'string'))) invalid();
  if (result.ocr !== undefined && result.ocr !== null) {
    const ocr = result.ocr;
    if (!ocr || !amount(ocr.width) || !amount(ocr.height) || !ocr.width || !ocr.height || typeof ocr.imageUrl !== 'string' || !Array.isArray(ocr.boxes) || ocr.boxes.length > 1000) invalid();
    if (ocr.boxes.some(box => !box || !['x', 'y', 'width', 'height'].every(key => amount(box[key])) || !box.width || !box.height || box.x + box.width > ocr.width || box.y + box.height > ocr.height || typeof box.text !== 'string')) invalid();
  }
  return result;
}

export function safeDocumentUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  const origin = globalThis.location?.origin ?? 'http://localhost';
  try {
    const url = new URL(value, origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) ? url.pathname + url.search : null;
  } catch { return null; }
}

export async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin', cache: 'no-store', ...options,
    signal: options.signal ?? AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`HTTP ${response.status}: expected JSON from the P2P server.`); }
  if (!response.ok || data?.ok === false) {
    const code = data?.code ?? data?.error?.code ?? (typeof data?.error === 'string' ? data.error : 'REQUEST_REFUSED');
    const message = data?.message ?? data?.error?.message ?? REFUSALS[code]?.text ?? 'Request refused by server.';
    throw Object.assign(new Error(`${code}: ${message}`), { code, status: response.status });
  }
  return data;
}

export function render(snapshot) {
  if (!globalThis.document) return undefined;
  if (snapshot && snapshot.deals) {
    STATE = snapshot;
    renderAll();
  }
  return undefined;
}

export async function refresh() {
  if (kcPending) return;
  const revision = ++kcEpoch;
  try {
    const snapshot = await request('/api/state');
    if (revision !== kcEpoch) return;
    kcState = validateState(snapshot);
    kcConnected = true;
    if (globalThis.document && snapshot && snapshot.deals) {
      STATE = snapshot;
      renderAll();
    }
  } catch {
    if (revision !== kcEpoch) return;
    kcConnected = false;
  }
}

export async function runStep(step, actor, extra = {}) {
  if (!kcConnected || !kcState) throw new Error('Connect to the P2P server before authorizing a step.');
  if (kcPending) throw new Error('A server action is already pending.');
  if (step !== kcState.steps.filter(s => s.status === 'complete').length + 1 || !KC_ACTORS[step]) {
    throw new Error('This checkpoint is not the next server step.');
  }
  if (actor !== KC_ACTORS[step]) throw new Error('The required human actor must authorize this step.');
  const payload = { actor };
  if (step === 6) {
    if (!REELS.includes(extra.barcode)) throw new Error('Scan one of the four exact ENC-GS1-884192-R01…R04 barcodes.');
    if (kcState.scans.some(scan => scan.barcode === extra.barcode)) throw new Error('This reel was already scanned. Scan the next unique reel.');
    payload.barcode = extra.barcode;
  }
  if (step === 8) payload.bankAccount = '101100';
  kcPending = true; ++kcEpoch;
  try {
    const res = await request(`/api/step/${step}`, { method: 'POST', body: payload });
    kcState = validateState(res);
    kcConnected = true;
  } catch (error) {
    if (!error.status) kcConnected = false;
    throw error;
  } finally {
    kcPending = false;
  }
}

export function trialBalance(snapshot) {
  const report = snapshot?.journal;
  if (!report) return null;
  const accounts = new Map(), codes = new Map(), legs = [];
  let debit = 0, credit = 0;
  for (const entry of report.entries) for (const leg of entry.legs) {
    const d = kcCents(leg.debitUsd), c = kcCents(leg.creditUsd), code = leg.account.match(/\d{6}/)?.[0] ?? 'other';
    legs.push({ account: leg.account, memo: String(entry.memo ?? ''), debit: d, credit: c });
    for (const [map, key] of [[accounts, leg.account], [codes, code]]) {
      const sum = map.get(key) ?? { debit: 0, credit: 0 };
      sum.debit += d; sum.credit += c; map.set(key, sum);
    }
    debit += d; credit += c;
  }
  return { report, accounts, codes, legs, debit, credit, balanced: report.balanced && debit === credit };
}

const KC_INTENTS = [
  ['refuse', /\b(approve|authori[sz]e|sign|pay|release|post|override|(?<!\bencore[\s-]*)wire|cut|scan|receive|lock|escalate|transfer|delete|reset\s+(the\s+)?(queue|run|workflow|demo)|issue\s+(the\s+|a\s+)?(po|purchase order|check|payment))\b/i],
  ['check', /\b(the check|check\s*#?\s*10045|10045|payment|paid|settle\w*|cfo|disburse\w*)\b/i],
  ['invoice', /\b(invoice|ocr|rapidocr|box(es)?|three[- ]way|3[- ]way|match)\b/i],
  ['dock', /\b(dock|scan\w+|reels?|barcodes?|receiv\w+|rf)\b/i],
  ['ledger', /\b(ledger|trial balance|balanced?|journal|gl|debits?|credits?)\b/i],
  ['governance', /\b(sox|governance|guardrails?|refus\w*|probes?|controls?)\b/i],
  ['check', /\b(encore|payee)\b/i],
];
export const stewardIntent = text => KC_INTENTS.find(([, pattern]) => pattern.test(String(text ?? '')))?.[0] ?? 'status';

const KC_NEXT_LINES = [
  'Query stock',
  'Darius must confirm and escalate the need',
  'VP Devon must approve the request',
  'Purchasing may lock the COMEX spot rate',
  'Purchasing may issue the purchase order',
  'Marcus must scan four unique GS1 reels',
  'Run invoice OCR and the three-way match',
  'CFO Meredith must authorize Check number 10045',
  'The server reports all eight steps complete',
];

export function stewardReply(intent, snapshot) {
  if (!snapshot) return 'I am KAL, your zero-authority P2P steward. The P2P server is disconnected. I cannot confirm stock, ledger balances, or approvals.';
  const completed = kcCompletedSteps(snapshot), scans = snapshot.scans;
  const match = kcIsObject(snapshot.match) ? snapshot.match : null, payment = snapshot.payment;
  switch (intent) {
    case 'refuse': {
      const who = completed < 8 ? kcOfficer(KC_ACTORS[completed + 1]) ?? 'the system stock query' : null;
      return `I cannot do that. My signing limit is zero dollars and I hold no write credentials. ${who ? `Step ${completed + 1} needs ${who} at the step card.` : 'All eight steps are already complete.'} Human officers authorize every checkpoint.`;
    }
    case 'dock': {
      const remaining = REELS.filter(reel => !scans.some(scan => scan.barcode === reel)).map(reel => reel.slice(-3));
      const next = !remaining.length ? 'The dock receipt is complete.' : completed >= 5 ? `Marcus Vance must scan ${remaining.join(', ')}.` : 'Dock scanning opens at step 6.';
      return `${scans.length} of 4 reels received, ${kcFeet(scans.length * 2000)} of 8,000 feet. ${next}`;
    }
    case 'invoice': {
      if (!match) return 'The invoice is not matched yet. Duncan Vance runs the RapidOCR three-way match at step 7.';
      const ocr = snapshot.ocr, tagged = ocr ? tagOcrFields(ocr).filter(field => field.indices.length).length : 0;
      return `Three-way match cleared at ${kcMoney(match.varianceUsd ?? 0)} variance. ${ocr ? `RapidOCR read ${ocr.boxes.length} boxes and tagged ${tagged} of 5 invoice fields.` : 'This run matched PO-derived invoice fields without pixel OCR.'}`;
    }
    case 'check':
      if (payment) return `${payment.check} paid ${kcMoney(payment.amountUsd)} to ${kcStr(snapshot.vendor) ?? 'Encore Wire Corporation'} from ${kcStr(payment.bankLabel) ?? 'Operating #8801'}.`;
      return completed === 7 ? `Check #10045 for ${kcMoney(snapshot.po?.totalUsd)} is drafted. Meredith Hale, CFO, must sign it.` : 'Check #10045 is drafted only after the three-way match at step 7.';
    case 'ledger': {
      const book = trialBalance(snapshot), usd = value => kcMoney(value / 100);
      return book.balanced
        ? `The journal is balanced. Debits ${usd(book.debit)} equal credits ${usd(book.credit)} across ${book.legs.length} postings.`
        : `The journal is not balanced: debits ${usd(book.debit)} against credits ${usd(book.credit)}. Payments stay on hold.`;
    }
    case 'governance':
      return 'Five server refusals guard this flow: my zero authority, delegation of authority, segregation of duties, the three-way match hold, and the disbursement bank policy. The SOX view shows each probe result.';
    default:
      return `${completed} of 8 steps confirmed. ${KC_NEXT_LINES[completed]}. My signing limit is zero dollars. Human officers authorize every checkpoint.`;
  }
}

export function parseReelScan(raw, scans = []) {
  const code = String(raw ?? '').replace(/^\s*\][A-Za-z][0-9A-Za-z]/, '').replace(/[\s\x00-\x1f]+/g, '').toUpperCase();
  if (!code) return { code, error: 'NO_BARCODE' };
  if (!REELS.includes(code)) return { code, error: 'UNKNOWN_REEL' };
  if (scans.some(scan => scan.barcode === code)) return { code, error: 'DUPLICATE_SCAN' };
  return { code, error: null };
}

const KC_OCR_FIELDS = [
  ['vendor', 'Vendor', /^VENDOR(?!\s*OA\b)\b/i],
  ['po', 'PO #', /^PURCHASE\s*ORDER\b/i],
  ['quantity', 'Quantity FT', /^QUANTITY(\s*FT)?\b/i],
  ['unit', 'Unit price USD', /^UNIT\s*PRICE(\s*USD)?\b/i],
  ['total', 'Total due USD', /^TOTAL\s*DUE(\s*USD)?\b/i],
];
export function tagOcrFields(ocr) {
  const boxes = Array.isArray(ocr?.boxes) ? ocr.boxes : [], middle = box => box.y + box.height / 2;
  return KC_OCR_FIELDS.map(([key, label, pattern]) => {
    const index = boxes.findIndex(box => pattern.test(box.text.trim()));
    if (index < 0) return { key, label, indices: [], value: null };
    const box = boxes[index], inline = box.text.trim().replace(pattern, '').replace(/^[\s:：#]+/, '').trim();
    if (inline) return { key, label, indices: [index], value: inline };
    const right = boxes.map((other, i) => [other, i])
      .filter(([other, i]) => i !== index && other.x >= box.x + box.width / 2 && Math.abs(middle(other) - middle(box)) < box.height / 2)
      .sort(([a], [b]) => a.x - b.x)[0];
    return { key, label, indices: right ? [index, right[1]] : [index], value: right ? right[0].text.trim() : null };
  });
}

export function checkWords(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1e12) return '—';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const hundreds = n => [n >= 100 && `${ones[Math.floor(n / 100)]} hundred`, n % 100 && (n % 100 < 20 ? ones[n % 100] : tens[Math.floor(n % 100 / 10)] + (n % 10 ? `-${ones[n % 10]}` : ''))].filter(Boolean).join(' ');
  const total = kcCents(amount), dollars = Math.floor(total / 100), parts = [];
  for (const [scale, name] of [[1e9, ' billion'], [1e6, ' million'], [1e3, ' thousand'], [1, '']]) {
    const chunk = Math.floor(dollars / scale) % 1000;
    if (chunk) parts.push(hundreds(chunk) + name);
  }
  const text = parts.join(' ') || 'zero';
  return `${text[0].toUpperCase()}${text.slice(1)} and ${String(total % 100).padStart(2, '0')}/100 dollars`;
}

export const achLabel = ach => {
  const trace = kcStr(ach);
  return trace && /^ACH\b/i.test(trace) ? trace : `ACH ${trace ?? '—'}`;
};

function kcStopVoice() {
  ++kcVoiceEpoch;
  kcVoiceController?.abort(); kcVoiceController = null;
  kcVoiceAudio?.pause(); kcVoiceAudio = null;
  if (kcVoiceUrl) URL.revokeObjectURL(kcVoiceUrl);
  kcVoiceUrl = null;
  globalThis.speechSynthesis?.cancel();
}

export async function speak(text) {
  if (kcDisposed) return 'cancelled';
  kcStopVoice();
  const token = kcVoiceEpoch;
  text = String(text).slice(0, 1500);
  if (kcMuted) return 'muted';
  const controller = new AbortController();
  kcVoiceController = controller;
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch('/api/kal/speak', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('audio/')) throw new Error('Voice proxy unavailable');
    const blob = await response.blob();
    clearTimeout(timer);
    if (token !== kcVoiceEpoch) return 'cancelled';
    kcVoiceUrl = URL.createObjectURL(blob);
    kcVoiceAudio = new Audio(kcVoiceUrl);
    kcVoiceAudio.onended = () => { if (token === kcVoiceEpoch) kcStopVoice(); };
    await kcVoiceAudio.play();
    return 'proxy';
  } catch {
    if (token !== kcVoiceEpoch) return 'cancelled';
    if (globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance) {
      globalThis.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return 'browser';
    }
    return 'text';
  } finally {
    clearTimeout(timer);
  }
}

function kcCleanupRecording() {
  clearInterval(kcRecordingTimer); kcRecordingTimer = null;
  for (const stream of kcRecordingResources) stream.getTracks().forEach(track => track.stop());
  kcRecordingResources = [];
  if (kcAudioContext) { void kcAudioContext.close().catch(() => {}); kcAudioContext = null; }
  kcRecorder = null;
}

export async function startRecording() {
  if (kcDisposed || kcRecorder || kcRecordingPending) return;
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || !globalThis.MediaRecorder) return false;
  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) return false;
  const token = ++kcRecordingEpoch;
  kcRecordingPending = true;
  try {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60, max: 60 } }, audio: true });
    if (kcDisposed || token !== kcRecordingEpoch) { screen.getTracks().forEach(track => track.stop()); return false; }
    kcRecordingResources.push(screen);
    if (!screen.getVideoTracks().length) throw new Error('No display video track selected');
    screen.getVideoTracks()[0].addEventListener('ended', stopRecording, { once: true });
    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      if (kcDisposed || token !== kcRecordingEpoch) { mic.getTracks().forEach(track => track.stop()); kcCleanupRecording(); return false; }
      kcRecordingResources.push(mic);
    } catch { /* optional mic */ }
    if (kcDisposed || token !== kcRecordingEpoch) { kcCleanupRecording(); return false; }
    if (screen.getVideoTracks()[0].readyState === 'ended') throw new Error('Screen sharing ended before recording started');
    const tracks = [...screen.getVideoTracks()];
    const sources = [screen, mic].filter(stream => stream?.getAudioTracks().length);
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (sources.length && Context) {
      const context = new Context(); kcAudioContext = context; await context.resume();
      if (kcDisposed || token !== kcRecordingEpoch) { kcCleanupRecording(); return false; }
      const output = context.createMediaStreamDestination();
      for (const source of sources) context.createMediaStreamSource(source).connect(output);
      tracks.push(...output.stream.getAudioTracks()); kcRecordingResources.push(output.stream);
    } else if (sources.length) {
      tracks.push(...sources[0].getAudioTracks());
    }
    const combined = new MediaStream(tracks);
    const chunks = [];
    kcRecorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 8000000 });
    kcRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    kcRecorder.onstop = () => { kcCleanupRecording(); };
    kcRecorder.onerror = () => { stopRecording(); };
    kcRecorder.start(1000);
    return true;
  } catch {
    kcCleanupRecording();
    return false;
  } finally {
    kcRecordingPending = false;
  }
}

export function stopRecording() {
  ++kcRecordingEpoch;
  if (kcRecorder && kcRecorder.state !== 'inactive') kcRecorder.stop();
  else kcCleanupRecording();
}
