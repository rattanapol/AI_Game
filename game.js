(function () {
  // อ้างอิง DOM Elements
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const hudGameIcon = document.getElementById('hud-game-icon');
  const hudGameTitle = document.getElementById('hud-game-title');
  const aiStatusEl = document.getElementById('ai-status');
  const currentPlayerIdEl = document.getElementById('current-player-id');
  const scoreEl = document.getElementById('score-val');
  const comboEl = document.getElementById('combo-val');
  const timeEl = document.getElementById('time-val');
  const bestEl = document.getElementById('best-val');
  const gestureNameEl = document.getElementById('gesture-name');

  const overlayScreen = document.getElementById('overlay-screen');
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const playerIdInput = document.getElementById('player-id-input');
  const saveScoreBtn = document.getElementById('save-score-btn');
  const idFeedbackMsg = document.getElementById('id-feedback-msg');

  const finalScoreBox = document.getElementById('final-score-box');
  const finalGameLabel = document.getElementById('final-game-label');
  const finalScoreNumber = document.getElementById('final-score-number');
  const saveStatusText = document.getElementById('save-status-text');

  const gamesGrid = document.getElementById('games-grid');
  const selectedGameGuide = document.getElementById('selected-game-guide');
  const cameraMsg = document.getElementById('camera-msg');
  const startCamBtn = document.getElementById('start-cam-btn');
  const startMouseBtn = document.getElementById('start-mouse-btn');

  const inGameControls = document.getElementById('in-game-controls');
  const backMenuBtn = document.getElementById('back-menu-btn');
  const toggleCamBtn = document.getElementById('toggle-cam-btn');
  const restartQuickBtn = document.getElementById('restart-quick-btn');

  const openLeaderboardBtn = document.getElementById('open-leaderboard-btn');
  const leaderboardModal = document.getElementById('leaderboard-modal');
  const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
  const leaderboardTabs = document.getElementById('leaderboard-tabs');
  const searchIdInput = document.getElementById('search-id-input');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');

  // ข้อมูลของทั้ง 5 เกม
  const GAME_META = {
    ninja: {
      id: 'ninja',
      icon: '🍉',
      name: '1. AI Hand Ninja',
      guide:
        '<strong>วิธีเล่น (AI Hand Ninja):</strong> ขยับปลายนิ้วชี้ตัดผลไม้ (🍎 🍉 🍊 🍓) จีบนิ้วคว้าดาวโบนัส (⭐ +50) และห้ามโดนระเบิด (💣 -30)'
    },
    bubble: {
      id: 'bubble',
      icon: '🫧',
      name: '2. Bubble Popper',
      guide:
        '<strong>วิธีเล่น (Bubble Popper):</strong> ขยับนิ้วจิ้มฟองสบู่ (🫧 +15) เพชรสายฟ้า (💎 +35) นาฬิกาเพิ่มเวลา (⏱️ +3 วินาที) และระวังหนามพิษ (🦔 -25)'
    },
    catcher: {
      id: 'catcher',
      icon: '🧺',
      name: '3. Star Catcher',
      guide:
        '<strong>วิธีเล่น (Star Catcher):</strong> ขยับมือซ้าย-ขวาเพื่อเลื่อนตะกร้าพลังงานด้านล่างไปรับดาวตก (🌟 +15) เพชร (💎 +30) มงกุฎ (👑 +50) และหลบอุกกาบาต (☄️ -30)'
    },
    mole: {
      id: 'mole',
      icon: '🔨',
      name: '4. Whack-a-Mole',
      guide:
        '<strong>วิธีเล่น (Whack-a-Mole):</strong> ขยับมือไปทุบตุ่นน้อย (🐹 +15) และตุ่นราชา (👑 +40) ที่โผล่ขึ้นมาจาก 9 หลุมมิติให้ทันเวลา ห้ามทุบโดนระเบิด (💣 -30)!'
    },
    defender: {
      id: 'defender',
      icon: '🚀',
      name: '5. Space Defender',
      guide:
        '<strong>วิธีเล่น (Space Defender):</strong> ขยับมือบังคับยานอวกาศยิงเลเซอร์ใส่ฝูงเอเลี่ยน (👾 🛸 🪨) จีบนิ้ว/กำมือเพื่อยิงปืนพลาสม่า 3 ทิศทาง และเก็บแบตเตอรี่ (🔋 +40)!'
    }
  };

  // สถานะของระบบและเกม
  let selectedGame = 'ninja';
  let handLandmarker = null;
  let webcamRunning = false;
  let gameActive = false;
  let controlMode = 'webcam'; // 'webcam' | 'mouse'

  let playerId = localStorage.getItem('ai_arcade_player_id') || '';
  let score = 0;
  let lastFinishedScore = null;
  let lastFinishedGame = null;
  let currentRoundSaved = false;
  let combo = 1;
  let timeLeft = 60;

  let gameTimerInterval = null;
  let lastSpawnTime = 0;
  let lastShotTime = 0;
  let lastVideoTime = -1;
  let lastDetectTimestamp = 0;
  let activeLeaderboardFilter = 'all';

  // ตำแหน่งมือ/เมาส์ และออบเจกต์ในเกม
  const handCursors = [];
  const bladeTrail = [];
  const mouseState = { x: 400, y: 300, isDown: false, active: false };

  const targets = [];
  const lasers = [];
  const moles = [];
  const particles = [];
  const floatingTexts = [];
  let catcherBasketX = 400;
  let defenderShipPos = { x: 400, y: 450 };

  // สร้างหลุม 9 หลุมสำหรับเกมที่ 4 (Whack-a-Mole)
  function initMoleHoles() {
    moles.length = 0;
    for (let i = 0; i < 9; i++) {
      moles.push({
        index: i,
        state: 'empty', // 'empty' | 'up' | 'whacked'
        kind: 'mole',
        emoji: '🐹',
        points: 15,
        expireAt: 0,
        cooldownUntil: 0
      });
    }
  }
  initMoleHoles();

  // ระบบ Optical Motion AI สำรอง
  const motionCanvas = document.createElement('canvas');
  motionCanvas.width = 96;
  motionCanvas.height = 72;
  const motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
  let prevFrameData = null;
  let smoothMotionPos = { x: 0, y: 0, initialized: false };

  // เสียงสังเคราะห์ด้วย Web Audio API
  let audioCtx = null;
  function playTone(freq, type, duration, gainVal) {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        freq * 1.35,
        audioCtx.currentTime + (duration || 0.12)
      );

      gain.gain.setValueAtTime(gainVal || 0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.12));

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (duration || 0.12));
    } catch (_) {
      // ข้ามหากเบราว์เซอร์บล็อกเสียง
    }
  }

  // ปรับขนาด Canvas
  function resizeCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth || window.innerWidth;
    canvas.height = parent.clientHeight || window.innerHeight - 70;
    catcherBasketX = canvas.width / 2;
    defenderShipPos.x = canvas.width / 2;
    defenderShipPos.y = canvas.height - 90;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ==========================================
  // ระบบจัดการรหัสประจำตัวผู้เล่น 4 หลัก และบันทึกคะแนน
  // ==========================================
  function isValidPlayerId(idStr) {
    return /^\d{4}$/.test(idStr);
  }

  function getScoreHistory() {
    try {
      const raw = localStorage.getItem('ai_arcade_scores_v2');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveScoreRecord(id4Digit, gameKey, scoreValue) {
    if (!isValidPlayerId(id4Digit)) return false;
    const records = getScoreHistory();
    const meta = GAME_META[gameKey] || GAME_META.ninja;
    const now = new Date();
    const timeStr = now.toLocaleString('th-TH', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    records.push({
      playerId: id4Digit,
      gameId: gameKey,
      gameName: meta.name,
      gameIcon: meta.icon,
      score: Number(scoreValue),
      timestamp: now.getTime(),
      timeFormatted: timeStr
    });

    localStorage.setItem('ai_arcade_scores_v2', JSON.stringify(records));
    updateBestScoreDisplay();
    return true;
  }

  function updateBestScoreDisplay() {
    const records = getScoreHistory().filter((r) => r.gameId === selectedGame);
    let maxScore = 0;
    for (const r of records) {
      if (r.score > maxScore) maxScore = r.score;
    }
    bestEl.textContent = maxScore;
  }

  function syncPlayerIdUI() {
    const clean = (playerIdInput.value || '').replace(/\D/g, '').slice(0, 4);
    playerIdInput.value = clean;

    if (isValidPlayerId(clean)) {
      playerId = clean;
      localStorage.setItem('ai_arcade_player_id', playerId);
      currentPlayerIdEl.textContent = playerId;
      idFeedbackMsg.textContent = `✅ รหัสประจำตัว ${playerId} พร้อมสำหรับบันทึกคะแนน`;
      idFeedbackMsg.className = 'id-feedback valid';
    } else {
      currentPlayerIdEl.textContent = clean.padEnd(4, '-');
      idFeedbackMsg.textContent = '⚠️ กรุณากรอกตัวเลขให้ครบ 4 หลัก (เช่น 0001, 1234)';
      idFeedbackMsg.className = 'id-feedback invalid';
    }
  }

  if (playerId && isValidPlayerId(playerId)) {
    playerIdInput.value = playerId;
    syncPlayerIdUI();
  }

  playerIdInput.addEventListener('input', syncPlayerIdUI);

  saveScoreBtn.addEventListener('click', () => {
    syncPlayerIdUI();
    if (!isValidPlayerId(playerIdInput.value)) {
      idFeedbackMsg.textContent = '❌ ต้องกรอกรหัสประจำตัวเป็นตัวเลข 4 หลักก่อนกดบันทึกคะแนนครับ!';
      idFeedbackMsg.className = 'id-feedback invalid';
      playerIdInput.focus();
      return;
    }

    if (lastFinishedScore !== null && lastFinishedGame) {
      saveScoreRecord(playerIdInput.value, lastFinishedGame, lastFinishedScore);
      currentRoundSaved = true;
      saveStatusText.textContent = `✅ บันทึกคะแนน ${lastFinishedScore} แต้ม ให้รหัส ${playerIdInput.value} เรียบร้อยแล้ว!`;
      playTone(660, 'triangle', 0.18, 0.2);
    }
  });

  // แสดงตารางคะแนน (Leaderboard)
  function renderLeaderboard() {
    const allRecords = getScoreHistory();
    const searchQuery = (searchIdInput.value || '').trim();

    let filtered = allRecords.filter((r) => {
      if (activeLeaderboardFilter !== 'all' && r.gameId !== activeLeaderboardFilter) {
        return false;
      }
      if (searchQuery && !r.playerId.includes(searchQuery)) {
        return false;
      }
      return true;
    });

    // เรียงจากคะแนนมากไปน้อย
    filtered.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

    if (filtered.length === 0) {
      leaderboardTbody.innerHTML =
        '<tr><td colspan="5" class="empty-row">ยังไม่มีข้อมูลคะแนนในหมวดหมู่นี้</td></tr>';
      return;
    }

    const rowsHtml = filtered
      .slice(0, 100)
      .map((item, idx) => {
        const rankBadge =
          idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`;
        return `
          <tr>
            <td><strong>${rankBadge}</strong></td>
            <td><span class="badge-id">${item.playerId}</span></td>
            <td>${item.gameIcon || ''} ${item.gameName}</td>
            <td><strong style="color:#facc15">${item.score}</strong></td>
            <td style="color:#9ca3af">${item.timeFormatted || '-'}</td>
          </tr>
        `;
      })
      .join('');

    leaderboardTbody.innerHTML = rowsHtml;
  }

  openLeaderboardBtn.addEventListener('click', () => {
    renderLeaderboard();
    leaderboardModal.classList.remove('hidden');
  });

  closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardModal.classList.add('hidden');
  });

  leaderboardTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const allTabs = leaderboardTabs.querySelectorAll('.tab-btn');
    allTabs.forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    activeLeaderboardFilter = btn.getAttribute('data-filter') || 'all';
    renderLeaderboard();
  });

  searchIdInput.addEventListener('input', renderLeaderboard);

  exportCsvBtn.addEventListener('click', () => {
    const records = getScoreHistory();
    if (records.length === 0) {
      alert('ยังไม่มีข้อมูลคะแนนสำหรับดาวน์โหลดครับ');
      return;
    }
    const header = 'PlayerID_4Digit,GameID,GameName,Score,Timestamp\n';
    const body = records
      .map((r) => `"${r.playerId}","${r.gameId}","${r.gameName}",${r.score},"${r.timeFormatted}"`)
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_arcade_scores.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  clearScoresBtn.addEventListener('click', () => {
    if (confirm('ต้องการล้างประวัติคะแนนทั้งหมดใช่หรือไม่?')) {
      localStorage.removeItem('ai_arcade_scores_v2');
      updateBestScoreDisplay();
      renderLeaderboard();
    }
  });

  // ==========================================
  // การเลือกเกมทั้ง 5 เกม
  // ==========================================
  function selectGameCard(gameKey) {
    if (!GAME_META[gameKey]) return;
    selectedGame = gameKey;
    const meta = GAME_META[gameKey];

    hudGameIcon.textContent = meta.icon;
    hudGameTitle.textContent = meta.name;
    selectedGameGuide.innerHTML = meta.guide;

    const cards = gamesGrid.querySelectorAll('.game-option');
    cards.forEach((c) => {
      if (c.getAttribute('data-game') === gameKey) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });

    updateBestScoreDisplay();
  }

  gamesGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.game-option');
    if (!card) return;
    const gameKey = card.getAttribute('data-game');
    selectGameCard(gameKey);
    playTone(520, 'sine', 0.08, 0.1);
  });

  updateBestScoreDisplay();

  // ==========================================
  // การควบคุมด้วยเมาส์และทัชสกรีน
  // ==========================================
  function updateMousePos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouseState.x = clientX - rect.left;
    mouseState.y = clientY - rect.top;
    mouseState.active = true;
  }

  canvas.addEventListener('mousemove', (e) => updateMousePos(e.clientX, e.clientY));
  canvas.addEventListener('mousedown', (e) => {
    mouseState.isDown = true;
    updateMousePos(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    mouseState.isDown = false;
  });

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 0) {
        updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );
  canvas.addEventListener(
    'touchstart',
    (e) => {
      mouseState.isDown = true;
      if (e.touches.length > 0) {
        updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );
  window.addEventListener('touchend', () => {
    mouseState.isDown = false;
  });

  // ==========================================
  // โหลดโมเดล MediaPipe HandLandmarker + กล้องเว็บแคม
  // ==========================================
  async function initAI() {
    try {
      aiStatusEl.textContent = 'กำลังโหลดโมเดล AI ตรวจจับข้อต่อมือ 21 จุด...';
      aiStatusEl.className = 'status-badge loading';

      const visionModule = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
      );
      const { FilesetResolver, HandLandmarker } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      } catch (gpuErr) {
        console.warn('GPU delegate fallback to CPU:', gpuErr);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      }

      aiStatusEl.textContent = 'AI พร้อมทำงาน (MediaPipe 21-Point Hand AI + Motion AI)';
      aiStatusEl.className = 'status-badge ready';
    } catch (err) {
      console.warn('MediaPipe CDN unavailable, using built-in Optical Motion AI:', err);
      aiStatusEl.textContent = 'พร้อมใช้งาน (โหมด Optical Motion AI ในตัว + เมาส์)';
      aiStatusEl.className = 'status-badge ready';
    }
  }

  async function enableWebcam() {
    if (webcamRunning && video.srcObject) return true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์ไม่รองรับ getUserMedia');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(resolve);
        };
      });
      webcamRunning = true;
      cameraMsg.classList.add('hidden');
      return true;
    } catch (err) {
      console.warn('Camera access failed:', err);
      cameraMsg.textContent =
        '⚠️ ไม่พบกล้องเว็บแคม หรือยังไม่ได้อนุญาตสิทธิ์กล้อง ระบบสลับมาใช้โหมดเมาส์ให้โดยอัตโนมัติ';
      cameraMsg.classList.remove('hidden');
      return false;
    }
  }

  function analyzeHandGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const distToWrist = (pt) => Math.hypot(pt.x - wrist.x, pt.y - wrist.y);
    const isFist =
      distToWrist(indexTip) < 0.27 &&
      distToWrist(middleTip) < 0.27 &&
      distToWrist(ringTip) < 0.27 &&
      distToWrist(pinkyTip) < 0.27;

    const isPinching = pinchDist < 0.075 || isFist;
    const screenX = (1 - indexTip.x) * canvas.width;
    const screenY = indexTip.y * canvas.height;

    return {
      x: screenX,
      y: screenY,
      isPinching,
      isFist,
      label: isFist
        ? '✊ กำมือ (Grab/Power)'
        : isPinching
        ? '🤏 จีบนิ้ว (Pinch)'
        : '☝️ ชี้นิ้ว/ขยับมือ (Active)'
    };
  }

  function detectOpticalMotionHand() {
    if (!webcamRunning || video.readyState < 2 || video.videoWidth === 0) return null;

    const w = motionCanvas.width;
    const h = motionCanvas.height;
    motionCtx.drawImage(video, 0, 0, w, h);
    const frame = motionCtx.getImageData(0, 0, w, h);
    const data = frame.data;

    if (!prevFrameData) {
      prevFrameData = new Uint8ClampedArray(data);
      return null;
    }

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const diffR = Math.abs(data[idx] - prevFrameData[idx]);
        const diffG = Math.abs(data[idx + 1] - prevFrameData[idx + 1]);
        const diffB = Math.abs(data[idx + 2] - prevFrameData[idx + 2]);
        const diff = (diffR + diffG + diffB) / 3;

        if (diff > 28) {
          sumX += x;
          sumY += y;
          count++;
        }
        prevFrameData[idx] = data[idx];
        prevFrameData[idx + 1] = data[idx + 1];
        prevFrameData[idx + 2] = data[idx + 2];
      }
    }

    if (count < 12) {
      return smoothMotionPos.initialized
        ? {
            x: smoothMotionPos.x,
            y: smoothMotionPos.y,
            isPinching: true,
            label: '🖐️ ค้างตำแหน่งมือ (Hold)'
          }
        : null;
    }

    const targetX = (1 - sumX / count / w) * canvas.width;
    const targetY = (sumY / count / h) * canvas.height;

    if (!smoothMotionPos.initialized) {
      smoothMotionPos.x = targetX;
      smoothMotionPos.y = targetY;
      smoothMotionPos.initialized = true;
    } else {
      smoothMotionPos.x += (targetX - smoothMotionPos.x) * 0.45;
      smoothMotionPos.y += (targetY - smoothMotionPos.y) * 0.45;
    }

    const isCompactGrab = count > 18 && count < 140;
    return {
      x: smoothMotionPos.x,
      y: smoothMotionPos.y,
      isPinching: isCompactGrab || mouseState.isDown,
      label: isCompactGrab ? '🤏 ขยับมือคว้า (Motion Grab)' : '👋 ขยับมือควบคุม (Motion)'
    };
  }

  // ==========================================
  // การสร้างวัตถุของแต่ละเกมทั้ง 5 เกม
  // ==========================================
  const NINJA_ITEMS = [
    { emoji: '🍎', color: '#ef4444', points: 10 },
    { emoji: '🍉', color: '#10b981', points: 15 },
    { emoji: '🍊', color: '#f97316', points: 10 },
    { emoji: '🍓', color: '#ec4899', points: 20 },
    { emoji: '🍍', color: '#eab308', points: 25 }
  ];

  function spawnForCurrentGame(timestamp) {
    const safeW = Math.max(200, canvas.width - 100);

    if (selectedGame === 'ninja') {
      const rand = Math.random();
      let kind = 'fruit';
      let item = NINJA_ITEMS[Math.floor(Math.random() * NINJA_ITEMS.length)];
      if (rand < 0.15) {
        kind = 'bomb';
        item = { emoji: '💣', color: '#ef4444', points: -30 };
      } else if (rand < 0.32) {
        kind = 'star';
        item = { emoji: '⭐', color: '#facc15', points: 50 };
      }
      const radius = kind === 'star' ? 44 : 40;
      const x = 50 + Math.random() * safeW;
      const y = canvas.height + radius;
      const centerBias = (canvas.width / 2 - x) * 0.0035;
      targets.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3.2 + centerBias,
        vy: -(Math.random() * 3.0 + Math.max(8.5, canvas.height * 0.0135)),
        gravity: 0.14,
        radius,
        kind,
        emoji: item.emoji,
        color: item.color,
        points: item.points,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 0.06
      });
    } else if (selectedGame === 'bubble') {
      const rand = Math.random();
      let kind = 'bubble';
      let emoji = '🫧';
      let color = '#38bdf8';
      let points = 15;
      if (rand < 0.14) {
        kind = 'hazard';
        emoji = '🦔';
        color = '#ef4444';
        points = -25;
      } else if (rand < 0.26) {
        kind = 'time';
        emoji = '⏱️';
        color = '#34d399';
        points = 20;
      } else if (rand < 0.45) {
        kind = 'gem';
        emoji = '💎';
        color = '#a855f7';
        points = 35;
      }
      const radius = 38 + Math.random() * 10;
      const x = 50 + Math.random() * safeW;
      targets.push({
        x,
        baseX: x,
        y: canvas.height + radius,
        vx: 0,
        vy: -(Math.random() * 2.2 + 2.6),
        gravity: 0,
        phase: Math.random() * Math.PI * 2,
        radius,
        kind,
        emoji,
        color,
        points,
        rotation: 0,
        rotSpeed: 0
      });
    } else if (selectedGame === 'catcher') {
      const rand = Math.random();
      let kind = 'star';
      let emoji = '🌟';
      let color = '#facc15';
      let points = 15;
      if (rand < 0.18) {
        kind = 'meteor';
        emoji = '☄️';
        color = '#ef4444';
        points = -30;
      } else if (rand < 0.35) {
        kind = 'crown';
        emoji = '👑';
        color = '#f59e0b';
        points = 50;
      } else if (rand < 0.6) {
        kind = 'gem';
        emoji = '💎';
        color = '#38bdf8';
        points = 30;
      }
      const radius = 36;
      targets.push({
        x: 50 + Math.random() * safeW,
        y: -radius,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 2.5 + 3.2,
        gravity: 0.03,
        radius,
        kind,
        emoji,
        color,
        points,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 0.05
      });
    } else if (selectedGame === 'mole') {
      // สุ่มเปิดหลุมตุ่นที่ยังว่างอยู่
      const available = moles.filter((m) => m.state === 'empty' && timestamp > m.cooldownUntil);
      if (available.length > 0) {
        const chosen = available[Math.floor(Math.random() * available.length)];
        const rand = Math.random();
        chosen.state = 'up';
        if (rand < 0.16) {
          chosen.kind = 'bomb';
          chosen.emoji = '💣';
          chosen.points = -30;
        } else if (rand < 0.38) {
          chosen.kind = 'gold';
          chosen.emoji = '👑';
          chosen.points = 40;
        } else {
          chosen.kind = 'mole';
          chosen.emoji = '🐹';
          chosen.points = 15;
        }
        chosen.expireAt = timestamp + 1350 + Math.random() * 550;
      }
    } else if (selectedGame === 'defender') {
      const rand = Math.random();
      let kind = 'alien';
      let emoji = '👾';
      let color = '#a855f7';
      let points = 15;
      if (rand < 0.18) {
        kind = 'battery';
        emoji = '🔋';
        color = '#10b981';
        points = 40;
      } else if (rand < 0.45) {
        kind = 'ufo';
        emoji = '🛸';
        color = '#ec4899';
        points = 30;
      } else if (rand < 0.65) {
        kind = 'rock';
        emoji = '🪨';
        color = '#9ca3af';
        points = 10;
      }
      const radius = 36;
      targets.push({
        x: 50 + Math.random() * safeW,
        y: -radius,
        vx: (Math.random() - 0.5) * 2.0,
        vy: Math.random() * 2.0 + 2.4,
        gravity: 0,
        radius,
        kind,
        emoji,
        color,
        points,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 0.04
      });
    }
  }

  function createParticles(x, y, color, count) {
    const total = count || 16;
    for (let i = 0; i < total; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 5 + 3,
        color,
        alpha: 1
      });
    }
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, alpha: 1, vy: -2.2 });
  }

  // ==========================================
  // เริ่มเกม และ จบเกม
  // ==========================================
  async function startGame(preferredMode) {
    syncPlayerIdUI();
    resizeCanvas();
    controlMode = preferredMode || 'webcam';

    if (controlMode === 'webcam') {
      const camOk = await enableWebcam();
      if (!camOk) {
        controlMode = 'mouse';
      }
    }

    score = 0;
    combo = 1;
    timeLeft = 60;
    currentRoundSaved = false;
    targets.length = 0;
    lasers.length = 0;
    particles.length = 0;
    floatingTexts.length = 0;
    initMoleHoles();

    lastSpawnTime = 0;
    lastShotTime = 0;

    // สร้างวัตถุชุดแรกทันที
    spawnForCurrentGame(1000);
    spawnForCurrentGame(1000);

    updateHUD();
    overlayScreen.classList.add('hidden');
    inGameControls.classList.remove('hidden');
    gameActive = true;

    gestureNameEl.textContent =
      controlMode === 'webcam' ? '🖐️ ขยับมือหน้ากล้องได้เลย!' : '🖱️ ขยับเมาส์เพื่อเล่น!';

    clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
      if (!gameActive) return;
      timeLeft--;
      timeEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function endGame() {
    gameActive = false;
    clearInterval(gameTimerInterval);
    inGameControls.classList.add('hidden');

    lastFinishedScore = score;
    lastFinishedGame = selectedGame;
    const meta = GAME_META[selectedGame];

    modalTitle.textContent = `🏁 จบเกม ${meta.name}!`;
    modalSubtitle.textContent = 'ตรวจสอบรหัสประจำตัว 4 หลักของคุณเพื่อบันทึกคะแนนลงตารางอันดับ';
    finalGameLabel.textContent = `คะแนนจากเกม ${meta.icon} ${meta.name}`;
    finalScoreNumber.textContent = score;
    finalScoreBox.classList.remove('hidden');
    saveScoreBtn.classList.remove('hidden');

    syncPlayerIdUI();
    if (isValidPlayerId(playerIdInput.value)) {
      saveScoreRecord(playerIdInput.value, selectedGame, score);
      currentRoundSaved = true;
      saveStatusText.textContent = `✅ บันทึกคะแนน ${score} แต้ม ให้รหัสประจำตัว ${playerIdInput.value} อัตโนมัติแล้ว!`;
    } else {
      saveStatusText.textContent =
        '⚠️ กรุณากรอกรหัสประจำตัว 4 หลักด้านบน แล้วกดปุ่ม "💾 บันทึกคะแนน"';
      playerIdInput.focus();
    }

    startCamBtn.textContent = '📷 เล่นอีกครั้งด้วยกล้อง (AI)';
    startMouseBtn.textContent = '🖱️ เล่นอีกครั้งด้วยเมาส์';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreEl.textContent = score;
    comboEl.textContent = `x${combo}`;
    timeEl.textContent = `${timeLeft}s`;
  }

  // วาดโครงกระดูกมือ 21 จุด
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
  ];

  function drawHandSkeleton(landmarks, isPinching) {
    ctx.save();
    ctx.strokeStyle = isPinching ? 'rgba(250, 204, 21, 0.8)' : 'rgba(99, 102, 241, 0.7)';
    ctx.lineWidth = 3;

    for (const [i, j] of HAND_CONNECTIONS) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
      ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
      ctx.stroke();
    }

    for (let idx = 0; idx < landmarks.length; idx++) {
      const pt = landmarks[idx];
      const px = (1 - pt.x) * canvas.width;
      const py = pt.y * canvas.height;
      ctx.beginPath();
      ctx.arc(px, py, idx === 8 ? 10 : 4, 0, Math.PI * 2);
      ctx.fillStyle = idx === 8 ? (isPinching ? '#facc15' : '#ec4899') : '#e0e7ff';
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // ลูปหลักของเกมทั้ง 5 เกม
  // ==========================================
  function gameLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handCursors.length = 0;

    // 1. ตรวจจับมือจากกล้องเว็บแคม
    if (webcamRunning && video.readyState >= 2 && video.videoWidth > 0) {
      let detectedByMediaPipe = false;

      if (handLandmarker) {
        try {
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const nowMs = Math.max(performance.now(), lastDetectTimestamp + 1);
            lastDetectTimestamp = nowMs;

            const result = handLandmarker.detectForVideo(video, nowMs);
            if (result && result.landmarks && result.landmarks.length > 0) {
              detectedByMediaPipe = true;
              for (const lm of result.landmarks) {
                const gesture = analyzeHandGesture(lm);
                handCursors.push(gesture);
                drawHandSkeleton(lm, gesture.isPinching);
              }
            }
          }
        } catch (detectErr) {
          console.warn('HandLandmarker frame skipped:', detectErr);
        }
      }

      if (!detectedByMediaPipe) {
        const motionCursor = detectOpticalMotionHand();
        if (motionCursor) {
          handCursors.push(motionCursor);
        }
      }
    }

    // 2. รองรับเมาส์/ทัชสกรีนควบคู่กันเสมอ
    if (mouseState.active && (controlMode === 'mouse' || handCursors.length === 0)) {
      handCursors.push({
        x: mouseState.x,
        y: mouseState.y,
        isPinching: mouseState.isDown,
        label: mouseState.isDown ? '🖱️ คลิกค้าง (Power/Grab)' : '🖱️ เมาส์ควบคุม (Active)'
      });
    }

    if (handCursors.length > 0) {
      gestureNameEl.textContent = handCursors[0].label;
      bladeTrail.push({ x: handCursors[0].x, y: handCursors[0].y, life: 1.0 });
      if (bladeTrail.length > 14) bladeTrail.shift();
    }

    // วาดเส้นแสงเลเซอร์ตามการเคลื่อนไหวของมือ
    if (bladeTrail.length > 1) {
      ctx.save();
      for (let i = 1; i < bladeTrail.length; i++) {
        const p0 = bladeTrail[i - 1];
        const p1 = bladeTrail[i];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(236, 72, 153, ${Math.max(0, p1.life)})`;
        ctx.lineWidth = Math.max(1, p1.life * 9);
        ctx.lineCap = 'round';
        ctx.stroke();
        p1.life -= 0.08;
      }
      while (bladeTrail.length > 0 && bladeTrail[0].life <= 0) {
        bladeTrail.shift();
      }
      ctx.restore();
    }

    // 3. อัปเดตตรรกะเฉพาะของแต่ละเกม
    if (gameActive) {
      const spawnInterval =
        selectedGame === 'mole' ? 480 : selectedGame === 'bubble' ? 520 : 620;
      if (timestamp - lastSpawnTime > spawnInterval) {
        spawnForCurrentGame(timestamp);
        if (Math.random() < 0.35) spawnForCurrentGame(timestamp);
        lastSpawnTime = timestamp;
      }

      // --- เกมที่ 3: Star Catcher (วาดและอัปเดตตะกร้าพลังงาน) ---
      if (selectedGame === 'catcher') {
        if (handCursors.length > 0) {
          catcherBasketX += (handCursors[0].x - catcherBasketX) * 0.35;
        }
        const basketY = canvas.height - 65;
        const basketW = 130;

        ctx.save();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(catcherBasketX - basketW / 2, basketY - 22, basketW, 44, 16);
        ctx.fill();
        ctx.stroke();
        ctx.font = '36px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧺', catcherBasketX, basketY);
        ctx.restore();
      }

      // --- เกมที่ 4: Whack-a-Mole (วาดหลุมมิติ 9 หลุมและตรวจจับการทุบ) ---
      if (selectedGame === 'mole') {
        const cols = 3;
        const rows = 3;
        const gridW = Math.min(canvas.width * 0.78, 660);
        const gridH = Math.min(canvas.height * 0.72, 460);
        const startX = (canvas.width - gridW) / 2;
        const startY = (canvas.height - gridH) / 2 + 15;
        const cellW = gridW / cols;
        const cellH = gridH / rows;

        for (let idx = 0; idx < moles.length; idx++) {
          const m = moles[idx];
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const cx = startX + c * cellW + cellW / 2;
          const cy = startY + r * cellH + cellH / 2;

          if (m.state === 'up' && timestamp > m.expireAt) {
            m.state = 'empty';
            m.cooldownUntil = timestamp + 300;
          }

          // วาดวงแหวนหลุมมิติ
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cx, cy + 18, 52, 22, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fill();
          ctx.strokeStyle = m.state === 'up' ? '#ec4899' : '#4f46e5';
          ctx.lineWidth = 3;
          ctx.stroke();

          if (m.state === 'up') {
            ctx.font = '52px "Segoe UI Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(m.emoji, cx, cy - 6);

            // ตรวจจับว่ามือผู้เล่นทุบโดนหลุมนี้หรือไม่
            for (const cursor of handCursors) {
              if (Math.hypot(cursor.x - cx, cursor.y - cy) < 58) {
                m.state = 'empty';
                m.cooldownUntil = timestamp + 450;
                if (m.kind === 'bomb') {
                  score = Math.max(0, score + m.points);
                  combo = 1;
                  playTone(130, 'sawtooth', 0.25, 0.25);
                  createParticles(cx, cy, '#ef4444', 24);
                  addFloatingText(cx, cy, `${m.points} 💥 ตูม!`, '#ef4444');
                } else {
                  const gained = m.points * combo;
                  score += gained;
                  combo = Math.min(combo + 1, 5);
                  playTone(500 + combo * 50, 'triangle', 0.14, 0.18);
                  createParticles(cx, cy, '#facc15', 20);
                  addFloatingText(cx, cy, `+${gained} 🔨 POW!`, '#34d399');
                }
                updateHUD();
                break;
              }
            }
          }
          ctx.restore();
        }
      }

      // --- เกมที่ 5: Space Defender (วาดยานอวกาศและยิงเลเซอร์) ---
      if (selectedGame === 'defender') {
        if (handCursors.length > 0) {
          defenderShipPos.x += (handCursors[0].x - defenderShipPos.x) * 0.35;
          defenderShipPos.y += (handCursors[0].y - defenderShipPos.y) * 0.35;
        }
        const isPowerShot = handCursors.length > 0 && handCursors[0].isPinching;

        if (timestamp - lastShotTime > 230) {
          lasers.push({ x: defenderShipPos.x, y: defenderShipPos.y - 25, vx: 0, vy: -11 });
          if (isPowerShot) {
            lasers.push({ x: defenderShipPos.x - 15, y: defenderShipPos.y - 20, vx: -2.5, vy: -10.5 });
            lasers.push({ x: defenderShipPos.x + 15, y: defenderShipPos.y - 20, vx: 2.5, vy: -10.5 });
          }
          playTone(720, 'sine', 0.05, 0.06);
          lastShotTime = timestamp;
        }

        // อัปเดตและวาดเลเซอร์
        ctx.save();
        for (let i = lasers.length - 1; i >= 0; i--) {
          const l = lasers[i];
          l.x += l.vx;
          l.y += l.vy;
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(l.x, l.y, 5, 0, Math.PI * 2);
          ctx.fill();
          if (l.y < -20) lasers.splice(i, 1);
        }

        // วาดยานอวกาศของผู้เล่น
        ctx.font = '48px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚀', defenderShipPos.x, defenderShipPos.y);
        ctx.restore();
      }

      // --- อัปเดตและวาดวัตถุ (สำหรับเกมที่ 1, 2, 3, 5) ---
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        if (selectedGame === 'bubble') {
          t.x = t.baseX + Math.sin(timestamp * 0.004 + t.phase) * 28;
          t.y += t.vy;
        } else {
          t.x += t.vx;
          t.y += t.vy;
          t.vy += t.gravity;
          t.rotation += t.rotSpeed;
        }

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rotation);

        if (selectedGame === 'bubble') {
          ctx.beginPath();
          ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.fill();
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (t.kind === 'star' && selectedGame === 'ninja') {
          ctx.beginPath();
          ctx.arc(0, 0, t.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.font = `${t.radius * 1.35}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, 0, 0);
        ctx.restore();

        let hit = false;

        // ตรวจจับสำหรับเกมที่ 3 (Star Catcher: ชนตะกร้า หรือชนมือโดยตรง)
        if (selectedGame === 'catcher') {
          const basketY = canvas.height - 65;
          const inBasket =
            Math.abs(t.x - catcherBasketX) < 75 && Math.abs(t.y - basketY) < 48;
          let touchedByHand = false;
          for (const cursor of handCursors) {
            if (Math.hypot(cursor.x - t.x, cursor.y - t.y) < t.radius + 34) {
              touchedByHand = true;
              break;
            }
          }
          if (inBasket || touchedByHand) {
            if (t.kind === 'meteor') {
              score = Math.max(0, score + t.points);
              combo = 1;
              playTone(130, 'sawtooth', 0.25, 0.25);
              createParticles(t.x, t.y, '#ef4444', 24);
              addFloatingText(t.x, t.y, `${t.points} ☄️`, '#ef4444');
            } else {
              const gained = t.points * combo;
              score += gained;
              combo = Math.min(combo + 1, 5);
              playTone(520 + combo * 50, 'sine', 0.12, 0.16);
              createParticles(t.x, t.y, t.color, 18);
              addFloatingText(t.x, t.y, `+${gained} 🧺`, '#facc15');
            }
            hit = true;
          }
        } else if (selectedGame === 'defender') {
          // ตรวจจับเลเซอร์ชนเอเลี่ยน หรือยานเก็บแบตเตอรี่
          for (let li = lasers.length - 1; li >= 0; li--) {
            const l = lasers[li];
            if (Math.hypot(l.x - t.x, l.y - t.y) < t.radius + 14) {
              lasers.splice(li, 1);
              const gained = Math.abs(t.points) * combo;
              score += gained;
              combo = Math.min(combo + 1, 5);
              playTone(480 + combo * 40, 'triangle', 0.1, 0.14);
              createParticles(t.x, t.y, t.color, 18);
              addFloatingText(t.x, t.y, `+${gained} 💥`, '#38bdf8');
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (const cursor of handCursors) {
              if (Math.hypot(cursor.x - t.x, cursor.y - t.y) < t.radius + 32) {
                const gained = Math.abs(t.points) * combo;
                score += gained;
                combo = Math.min(combo + 1, 5);
                createParticles(t.x, t.y, t.color, 18);
                addFloatingText(t.x, t.y, `+${gained} 🚀`, '#34d399');
                hit = true;
                break;
              }
            }
          }
        } else {
          // เกมที่ 1 (Ninja) และ เกมที่ 2 (Bubble Popper)
          for (const cursor of handCursors) {
            let minDist = Math.hypot(cursor.x - t.x, cursor.y - t.y);
            if (bladeTrail.length >= 2) {
              const recent = bladeTrail[bladeTrail.length - 2];
              const midX = (cursor.x + recent.x) / 2;
              const midY = (cursor.y + recent.y) / 2;
              minDist = Math.min(minDist, Math.hypot(midX - t.x, midY - t.y));
            }
            if (minDist < t.radius + 36) {
              if (t.kind === 'bomb' || t.kind === 'hazard') {
                score = Math.max(0, score + t.points);
                combo = 1;
                playTone(130, 'sawtooth', 0.25, 0.25);
                createParticles(t.x, t.y, '#ef4444', 26);
                addFloatingText(t.x, t.y, `${t.points} 💥`, '#ef4444');
              } else if (t.kind === 'time') {
                timeLeft += 3;
                const gained = t.points * combo;
                score += gained;
                playTone(740, 'triangle', 0.16, 0.18);
                createParticles(t.x, t.y, '#34d399', 20);
                addFloatingText(t.x, t.y, `+3 วินาที! ⏱️`, '#34d399');
              } else if (t.kind === 'star' && selectedGame === 'ninja') {
                const bonusPoints = cursor.isPinching ? t.points : 25;
                const gained = bonusPoints * combo;
                score += gained;
                combo = Math.min(combo + 1, 5);
                playTone(680, 'triangle', 0.18, 0.2);
                createParticles(t.x, t.y, t.color, 24);
                addFloatingText(
                  t.x,
                  t.y,
                  cursor.isPinching ? `+${gained} ⭐ GRAB!` : `+${gained} ⭐`,
                  '#facc15'
                );
              } else {
                const gained = t.points * combo;
                score += gained;
                combo = Math.min(combo + 1, 5);
                playTone(440 + combo * 60, 'sine', 0.12, 0.15);
                createParticles(t.x, t.y, t.color, 18);
                addFloatingText(t.x, t.y, `+${gained}`, '#34d399');
              }
              hit = true;
              break;
            }
          }
        }

        if (hit) {
          updateHUD();
          targets.splice(i, 1);
          continue;
        }

        // ลบวัตถุที่หลุดขอบจอ
        if (
          (t.y > canvas.height + 95 && t.vy >= 0) ||
          (t.y < -95 && t.vy < 0)
        ) {
          targets.splice(i, 1);
        }
      }
    }

    // วาดเป้าเล็งที่ตำแหน่งมือ/เมาส์
    for (const cursor of handCursors) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, cursor.isPinching ? 26 : 19, 0, Math.PI * 2);
      ctx.strokeStyle = cursor.isPinching ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = cursor.isPinching ? '#facc15' : '#ec4899';
      ctx.fill();
      ctx.restore();
    }

    // อัปเดต Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.alpha -= 0.03;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // อัปเดตข้อความคะแนนลอย
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;

      if (ft.alpha <= 0) {
        floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 25px "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    requestAnimationFrame(gameLoop);
  }

  // ผูกปุ่มควบคุม
  startCamBtn.addEventListener('click', () => startGame('webcam'));
  startMouseBtn.addEventListener('click', () => startGame('mouse'));

  backMenuBtn.addEventListener('click', () => {
    gameActive = false;
    clearInterval(gameTimerInterval);
    inGameControls.classList.add('hidden');
    finalScoreBox.classList.add('hidden');
    saveScoreBtn.classList.add('hidden');
    modalTitle.textContent = '🎮 AI Webcam Gesture Arcade (5 เกม)';
    modalSubtitle.textContent =
      'กรอกรหัสประจำตัว 4 หลัก แล้วเลือกเกมที่ต้องการเล่นผ่านกล้องเว็บแคมด้วย AI หรือเมาส์';
    overlayScreen.classList.remove('hidden');
  });

  toggleCamBtn.addEventListener('click', async () => {
    if (controlMode === 'webcam') {
      controlMode = 'mouse';
      gestureNameEl.textContent = '🖱️ โหมดเมาส์';
    } else {
      const ok = await enableWebcam();
      if (ok) {
        controlMode = 'webcam';
        gestureNameEl.textContent = '📷 โหมดกล้อง AI';
      }
    }
  });

  restartQuickBtn.addEventListener('click', () => startGame(controlMode));

  initAI();
  requestAnimationFrame(gameLoop);
})();
