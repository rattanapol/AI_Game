(function () {
  // อ้างอิง DOM Elements
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const aiStatusEl = document.getElementById('ai-status');
  const scoreEl = document.getElementById('score-val');
  const comboEl = document.getElementById('combo-val');
  const timeEl = document.getElementById('time-val');
  const bestEl = document.getElementById('best-val');
  const gestureNameEl = document.getElementById('gesture-name');

  const overlayScreen = document.getElementById('overlay-screen');
  const modalTitle = document.getElementById('modal-title');
  const finalScoreBox = document.getElementById('final-score-box');
  const finalScoreNumber = document.getElementById('final-score-number');
  const cameraMsg = document.getElementById('camera-msg');
  const startCamBtn = document.getElementById('start-cam-btn');
  const startMouseBtn = document.getElementById('start-mouse-btn');
  const inGameControls = document.getElementById('in-game-controls');
  const toggleCamBtn = document.getElementById('toggle-cam-btn');
  const restartQuickBtn = document.getElementById('restart-Quick-btn');

  // สถานะของเกมและ AI
  let handLandmarker = null;
  let webcamRunning = false;
  let gameActive = false;
  let controlMode = 'webcam'; // 'webcam' | 'mouse'

  let score = 0;
  let combo = 1;
  let timeLeft = 60;
  let bestScore = Number(localStorage.getItem('ai_hand_ninja_best') || 0);
  bestEl.textContent = bestScore;

  let gameTimerInterval = null;
  let lastSpawnTime = 0;
  let lastVideoTime = -1;
  let lastDetectTimestamp = 0;

  // ตำแหน่งมือ/เมาส์ และเส้นแสงเลเซอร์
  const handCursors = [];
  const bladeTrail = [];
  const mouseState = { x: -100, y: -100, isDown: false, active: false };

  // รายการวัตถุในเกม
  const targets = [];
  const particles = [];
  const floatingTexts = [];

  // ระบบ Optical Motion AI สำรอง (ทำงานได้ทันทีแม้ไม่มีอินเทอร์เน็ตหรือระหว่างรอโมเดล 3D)
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
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, audioCtx.currentTime + (duration || 0.12));

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

  // ปรับขนาด Canvas ให้ตรงกับหน้าจอเสมอ
  function resizeCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth || window.innerWidth;
    canvas.height = parent.clientHeight || window.innerHeight - 70;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // รองรับการควบคุมด้วยเมาส์และทัชสกรีนควบคู่กัน
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

  // 1. โหลดโมเดล MediaPipe HandLandmarker แบบ Dynamic Import (พร้อมระบบ Fallback GPU -> CPU)
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

  // 2. เปิดใช้งานกล้องเว็บแคม
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
        '⚠️ ไม่พบกล้องเว็บแคม หรือยังไม่ได้อนุญาตสิทธิ์กล้อง ระบบสลับมาใช้โหมดเมาส์ให้โดยอัตโนมัติ (สามารถขยับเมาส์ฟันผลไม้ และคลิกค้างเพื่อเก็บดาวโบนัสได้เลย!)';
      cameraMsg.classList.remove('hidden');
      return false;
    }
  }

  // 3. วิเคราะห์ท่าทางมือจากจุด Landmark 21 จุด (MediaPipe)
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
        ? '✊ กำมือ (Grab)'
        : isPinching
        ? '🤏 จีบนิ้ว (Pinch)'
        : '☝️ ชี้นิ้วฟัน (Slice)'
    };
  }

  // 4. ระบบวิเคราะห์การเคลื่อนไหวจากภาพเว็บแคมโดยตรง (Optical Motion AI Fallback)
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
            label: '🖐️ หยุดมือค้าง/คว้า (Hold Grab)'
          }
        : null;
    }

    // กลับด้านแกน X ให้ตรงกับกระจกเงา
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

    // หากพื้นที่การขยับกระจุกตัวแคบหรือคลิกเมาส์ร่วมด้วย ให้ถือว่าสามารถคว้าดาวโบนัสได้
    const isCompactGrab = count > 18 && count < 140;

    return {
      x: smoothMotionPos.x,
      y: smoothMotionPos.y,
      isPinching: isCompactGrab || mouseState.isDown,
      label: isCompactGrab ? '🤏 ขยับมือคว้า (Motion Grab)' : '👋 กวาดมือฟัน (Motion Slice)'
    };
  }

  // 5. สร้างวัตถุในเกม (ผลไม้, ดาวโบนัส, ระเบิด)
  const FRUIT_TYPES = [
    { emoji: '🍎', color: '#ef4444', points: 10 },
    { emoji: '🍉', color: '#10b981', points: 15 },
    { emoji: '🍊', color: '#f97316', points: 10 },
    { emoji: '🍓', color: '#ec4899', points: 20 },
    { emoji: '🍍', color: '#eab308', points: 25 }
  ];

  function spawnTarget() {
    const rand = Math.random();
    let kind = 'fruit';
    let item = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];

    if (rand < 0.15) {
      kind = 'bomb';
      item = { emoji: '💣', color: '#ef4444', points: -30 };
    } else if (rand < 0.32) {
      kind = 'star';
      item = { emoji: '⭐', color: '#facc15', points: 50 };
    }

    const radius = kind === 'star' ? 44 : 40;
    const safeWidth = Math.max(200, canvas.width - radius * 2);
    const x = radius + Math.random() * safeWidth;
    const y = canvas.height + radius;

    const centerBias = (canvas.width / 2 - x) * 0.0035;
    const vx = (Math.random() - 0.5) * 3.2 + centerBias;
    const vy = -(Math.random() * 3.0 + Math.max(8.5, canvas.height * 0.0135));

    targets.push({
      x,
      y,
      vx,
      vy,
      gravity: 0.14,
      radius,
      kind,
      emoji: item.emoji,
      color: item.color,
      points: item.points,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 0.06
    });
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

  // 6. เริ่มเกมใหม่
  async function startGame(preferredMode) {
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
    targets.length = 0;
    particles.length = 0;
    floatingTexts.length = 0;
    lastSpawnTime = 0;

    // สร้างผลไม้ชุดแรกทันทีเมื่อกดเริ่มเกม
    spawnTarget();
    spawnTarget();

    updateHUD();
    overlayScreen.classList.add('hidden');
    inGameControls.classList.remove('hidden');
    gameActive = true;

    gestureNameEl.textContent =
      controlMode === 'webcam' ? '🖐️ ขยับมือหน้ากล้องได้เลย!' : '🖱️ ขยับเมาส์เพื่อฟันผลไม้!';

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

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('ai_hand_ninja_best', String(bestScore));
      bestEl.textContent = bestScore;
    }

    modalTitle.textContent = '🏁 หมดเวลาการแข่งขัน!';
    finalScoreBox.classList.remove('hidden');
    finalScoreNumber.textContent = score;
    startCamBtn.textContent = '📷 เล่นอีกครั้งด้วยกล้อง (AI)';
    startMouseBtn.textContent = '🖱️ เล่นอีกครั้งด้วยเมาส์';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreEl.textContent = score;
    comboEl.textContent = `x${combo}`;
    timeEl.textContent = `${timeLeft}s`;
  }

  // 7. วาดโครงกระดูกมือ (Hand Skeleton)
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

  // 8. ลูปหลักของเกมและการตรวจจับด้วย AI
  function gameLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    handCursors.length = 0;

    // 8.1 ตรวจจับมือจากกล้องเว็บแคม
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

      // หาก MediaPipe ยังไม่พบมือหรือกำลังโหลด ใช้ Optical Motion AI วิเคราะห์การเคลื่อนไหวจากกล้องแทน
      if (!detectedByMediaPipe) {
        const motionCursor = detectOpticalMotionHand();
        if (motionCursor) {
          handCursors.push(motionCursor);
        }
      }
    }

    // 8.2 รองรับตำแหน่งจากเมาส์/ทัชสกรีนควบคู่กันเสมอ
    if (mouseState.active && (controlMode === 'mouse' || handCursors.length === 0)) {
      handCursors.push({
        x: mouseState.x,
        y: mouseState.y,
        isPinching: mouseState.isDown,
        label: mouseState.isDown ? '🖱️ คลิกค้างคว้า (Grab)' : '🖱️ เมาส์ฟัน (Slice)'
      });
    }

    // อัปเดตป้ายสถานะท่าทางและเส้นแสงเลเซอร์
    if (handCursors.length > 0) {
      gestureNameEl.textContent = handCursors[0].label;
      bladeTrail.push({ x: handCursors[0].x, y: handCursors[0].y, life: 1.0 });
      if (bladeTrail.length > 15) bladeTrail.shift();
    } else if (gameActive) {
      gestureNameEl.textContent =
        controlMode === 'webcam' ? 'ชูมือหน้ากล้องได้เลย 🖐️' : 'ขยับเมาส์บนหน้าจอ 🖱️';
    }

    // วาดเส้นแสงตามปลายนิ้ว/เมาส์
    if (bladeTrail.length > 1) {
      ctx.save();
      for (let i = 1; i < bladeTrail.length; i++) {
        const p0 = bladeTrail[i - 1];
        const p1 = bladeTrail[i];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(236, 72, 153, ${Math.max(0, p1.life)})`;
        ctx.lineWidth = Math.max(1, p1.life * 10);
        ctx.lineCap = 'round';
        ctx.stroke();
        p1.life -= 0.07;
      }
      while (bladeTrail.length > 0 && bladeTrail[0].life <= 0) {
        bladeTrail.shift();
      }
      ctx.restore();
    }

    // วาดเป้าเล็งที่ตำแหน่งมือ/เมาส์
    for (const cursor of handCursors) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, cursor.isPinching ? 28 : 20, 0, Math.PI * 2);
      ctx.strokeStyle = cursor.isPinching ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = cursor.isPinching ? '#facc15' : '#ec4899';
      ctx.fill();
      ctx.restore();
    }

    // 8.3 อัปเดตและวาดวัตถุในเกม
    if (gameActive) {
      if (timestamp - lastSpawnTime > 650) {
        spawnTarget();
        if (Math.random() < 0.35) spawnTarget();
        lastSpawnTime = timestamp;
      }

      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.x += t.vx;
        t.y += t.vy;
        t.vy += t.gravity;
        t.rotation += t.rotSpeed;

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rotation);

        if (t.kind === 'star') {
          ctx.beginPath();
          ctx.arc(0, 0, t.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.font = `${t.radius * 1.4}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, 0, 0);
        ctx.restore();

        // ตรวจสอบการชนกับมือของผู้เล่น (รวมถึงเส้นทางการกวาดมือล่าสุดเพื่อไม่ให้พลาดเป้าเวลาสะบัดมือเร็วๆ)
        let hit = false;
        for (const cursor of handCursors) {
          let minDist = Math.hypot(cursor.x - t.x, cursor.y - t.y);
          if (bladeTrail.length >= 2) {
            const recent = bladeTrail[bladeTrail.length - 2];
            const midX = (cursor.x + recent.x) / 2;
            const midY = (cursor.y + recent.y) / 2;
            minDist = Math.min(minDist, Math.hypot(midX - t.x, midY - t.y));
          }
          if (minDist < t.radius + 36) {
            if (t.kind === 'star') {
              // ดาวโบนัส: หากทำท่าจีบนิ้ว/กำมือ/คลิกค้าง จะได้โบนัสเต็ม +50, หากปัดโดนปกติได้ +25
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
              hit = true;
            } else if (t.kind === 'bomb') {
              score = Math.max(0, score + t.points);
              combo = 1;
              playTone(130, 'sawtooth', 0.25, 0.25);
              createParticles(t.x, t.y, '#ef4444', 28);
              addFloatingText(t.x, t.y, `${t.points} 💥 ตูม!`, '#ef4444');
              hit = true;
            } else {
              const gained = t.points * combo;
              score += gained;
              combo = Math.min(combo + 1, 5);
              playTone(440 + combo * 60, 'sine', 0.12, 0.15);
              createParticles(t.x, t.y, t.color, 18);
              addFloatingText(t.x, t.y, `+${gained}`, '#34d399');
              hit = true;
            }

            if (hit) {
              updateHUD();
              targets.splice(i, 1);
              break;
            }
          }
        }

        if (!hit && t.y > canvas.height + 90 && t.vy > 0) {
          targets.splice(i, 1);
        }
      }
    }

    // 8.4 อัปเดตเอฟเฟกต์ละอองกระจาย (Particles)
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

    // 8.5 อัปเดตข้อความคะแนนลอย (Floating Texts)
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
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    requestAnimationFrame(gameLoop);
  }

  // ผูกปุ่มกดเริ่มเกมและปุ่มควบคุมด่วน
  startCamBtn.addEventListener('click', () => startGame('webcam'));
  startMouseBtn.addEventListener('click', () => startGame('mouse'));

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

  // เริ่มต้นโหลด AI และรันลูปกราฟิก
  initAI();
  requestAnimationFrame(gameLoop);
})();
