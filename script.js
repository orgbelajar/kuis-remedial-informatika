// ============================================================
//  LOGIKA KUIS REMEDIAL INFORMATIKA KELAS 8
//  Phase 4: Timer, Anti-Refresh, Expandable History, Duration
// ------------------------------------------------------------
//  Tergantung pada: quizData (dari quiz-data.js)
// ============================================================

(function () {
  "use strict";

  // ---------- Constants ----------
  const STORAGE_KEY = "remedialSession";      // localStorage (profil + history permanen)
  const QUIZ_STATE_KEY = "remedialQuizState"; // sessionStorage (anti-refresh)
  const RESULT_STATE_KEY = "remedialResultState"; // sessionStorage (result-state refresh survival)
  const PASSING_GRADE = 70;                   // KKM
  const WA_NUMBER = "6281412397588";           // Kak Nabil
  const OPTION_LETTERS = ["A", "B", "C", "D"];

  // ---------- Quiz State ----------
  let currentQuestionIndex = 0;   // Indeks soal yang sedang ditampilkan
  let score = 0;                  // Jumlah jawaban benar (0..totalQuestions)
  const answers = [];             // Menyimpan indeks pilihan siswa per soal (untuk review)
  let isAnswered = false;         // Mencegah mengubah jawaban setelah memilih

  // ---------- Timer State (Phase 4) ----------
  let quizStartTime = 0;          // Date.now() saat kuis dimulai/dilanjutkan
  let timerInterval = null;       // referensi setInterval

  // ---------- DOM References ----------
  const screens = {
    login:     document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
    quiz:      document.getElementById("quiz-screen"),
    result:    document.getElementById("result-screen"),
  };

  const els = {
    // Login
    loginForm:    document.getElementById("login-form"),
    nameInput:    document.getElementById("name-input"),
    nameError:    document.getElementById("name-error"),
    loginBtn:     document.getElementById("login-btn"),
    // Dashboard
    greetingName:       document.getElementById("greeting-name"),
    dashboardBestScore: document.getElementById("dashboard-best-score"),
    statusBadge:        document.getElementById("status-badge"),
    historyList:        document.getElementById("history-list"),
    startRemedialBtn:   document.getElementById("start-remedial-btn"),
    passingGradeInfo:   document.getElementById("passing-grade-info"),
    waBtn:              document.getElementById("wa-btn"),
    waInfoText:         document.getElementById("wa-info-text"),
    confirmModal:       document.getElementById("confirm-modal"),
    confirmModalCard:   document.getElementById("confirm-modal-card"),
    confirmCancelBtn:   document.getElementById("confirm-cancel-btn"),
    confirmStartBtn:    document.getElementById("confirm-start-btn"),
    confirmModalTotalQuestions: document.getElementById("confirm-modal-total-questions"),
    // Quiz
    quizTimer:       document.getElementById("quiz-timer"),
    quizExitBtn:     document.getElementById("quiz-exit-btn"),
    exitConfirmModal: document.getElementById("exit-confirm-modal"),
    exitConfirmModalCard: document.getElementById("exit-confirm-modal-card"),
    exitConfirmCancelBtn: document.getElementById("exit-confirm-cancel-btn"),
    exitConfirmBtn:  document.getElementById("exit-confirm-btn"),
    nextBtn:         document.getElementById("next-btn"),
    progressText:    document.getElementById("progress-text"),
    scoreText:       document.getElementById("score-text"),
    progressBar:     document.getElementById("progress-bar"),
    questionNumber:  document.getElementById("question-number"),
    questionText:    document.getElementById("question-text"),
    optionsContainer:document.getElementById("options-container"),
    explanationBox:  document.getElementById("explanation-box"),
    explanationText: document.getElementById("explanation-text"),
    // Result
    resultEmoji:           document.getElementById("result-emoji"),
    resultTitle:           document.getElementById("result-title"),
    resultStatusMessage:   document.getElementById("result-status-message"),
    finalScore:            document.getElementById("final-score"),
    correctCount:          document.getElementById("correct-count"),
    wrongCount:            document.getElementById("wrong-count"),
    resultDuration:        document.getElementById("result-duration"),
    reviewContainer:       document.getElementById("review-container"),
    backToDashboardBtn:    document.getElementById("back-to-dashboard-btn"),
  };

  // ============================================================
  //  DATA LAYER (localStorage) — session permanen
  // ============================================================

  // Baca & validasi session. Return null kalau tidak ada / rusak.
  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Validasi struktur minimal
      if (typeof data !== "object" || data === null) return null;
      if (typeof data.name !== "string" || data.name.trim() === "") return null;
      if (!Array.isArray(data.history)) return null;
      // Sanitasi tiap entri history (dengan fallback defaults untuk data lama)
      data.history = data.history
        .filter((h) => h && typeof h === "object")
        .map((h) => ({
          attempt: Number(h.attempt) || 0,
          score: clampScore(Number(safeNum(h.score))),
          date: typeof h.date === "string" ? h.date : "",
          duration: typeof h.duration === "number" && Number.isFinite(h.duration) ? Math.max(0, Math.round(h.duration)) : null,
          correctCount: typeof h.correctCount === "number" && Number.isFinite(h.correctCount) ? Math.round(h.correctCount) : null,
          wrongCount: typeof h.wrongCount === "number" && Number.isFinite(h.wrongCount) ? Math.round(h.wrongCount) : null,
          wrongQuestions: Array.isArray(h.wrongQuestions) ? h.wrongQuestions : null,
          answers: Array.isArray(h.answers) ? h.answers : null,
        }));
      // bestScore selalu di-recompute dari history (self-healing)
      data.bestScore = computeBestScore(data.history);
      return data;
    } catch (e) {
      return null; // JSON rusak / localStorage diblokir
    }
  }

  function saveSession(session) {
    try {
      // bestScore ditulis ulang agar konsisten dengan history
      session.bestScore = computeBestScore(session.history);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      // localStorage penuh / diblokir — abaikan secara graceful
      console.warn("Tidak dapat menyimpan session:", e);
    }
  }

  // Sumber kebenaran bestScore: max dari seluruh history
  function computeBestScore(history) {
    if (!history || history.length === 0) return 0;
    return history.reduce((max, h) => Math.max(max, h.score), 0);
  }

  function clampScore(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  // Konversi ke number aman (handle null/undefined/string)
  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Tanggal & Jam format DD-MM-YYYY HH:MM (Indonesia, leading zero)
  function todayID() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  // ============================================================
  // Simpan state kuis ke sessionStorage (dipanggil setelah tiap jawaban & perpindahan soal)
  function saveQuizState() {
    try {
      const state = {
        currentQuestionIndex: currentQuestionIndex,
        score: score,
        answers: [...answers],
        quizStartTime: quizStartTime,
        isAnswered: isAnswered,
      };
      sessionStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Tidak dapat menyimpan quiz state:", e);
    }
  }

  // Baca & validasi state kuis dari sessionStorage
  function loadQuizState() {
    try {
      const raw = sessionStorage.getItem(QUIZ_STATE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== "object" || data === null) return null;
      if (!Array.isArray(data.answers)) return null;
      if (typeof data.quizStartTime !== "number" || !Number.isFinite(data.quizStartTime)) return null;
      return {
        currentQuestionIndex: Math.max(0, Math.round(Number(data.currentQuestionIndex) || 0)),
        score: Math.max(0, Math.round(Number(data.score) || 0)),
        answers: data.answers,
        quizStartTime: data.quizStartTime,
        isAnswered: !!data.isAnswered,
      };
    } catch (e) {
      return null;
    }
  }

  // Hapus state kuis dari sessionStorage
  function clearQuizState() {
    try {
      sessionStorage.removeItem(QUIZ_STATE_KEY);
    } catch (e) {
      /* abaikan */
    }
  }

  // Simpan state hasil kuis ke sessionStorage (supaya bertahan saat di-refresh di Result Screen)
  function saveResultState(finalScore, correct, wrong, duration, answersArr) {
    try {
      const state = {
        finalScore: finalScore,
        correct: correct,
        wrong: wrong,
        duration: duration,
        answers: [...answersArr],
      };
      sessionStorage.setItem(RESULT_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Tidak dapat menyimpan result state:", e);
    }
  }

  // Baca & validasi state hasil kuis dari sessionStorage
  function loadResultState() {
    try {
      const raw = sessionStorage.getItem(RESULT_STATE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== "object" || data === null) return null;
      if (!Array.isArray(data.answers)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  // Hapus state hasil kuis dari sessionStorage
  function clearResultState() {
    try {
      sessionStorage.removeItem(RESULT_STATE_KEY);
    } catch (e) {
      /* abaikan */
    }
  }


  // ============================================================
  //  HELPERS
  // ============================================================

  // Escape karakter HTML agar aman dimasukkan ke innerHTML
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Convert simple markdown (**bold** and *italic*) to HTML after escaping
  function formatMarkdown(text) {
    if (typeof text !== "string") return "";
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  // Convert only simple italic (*italic*) to HTML after escaping, disabling bold
  function formatItalicOnly(text) {
    if (typeof text !== "string") return "";
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  // Title Case + normalisasi spasi: "nabil  ihsan" -> "Nabil Ihsan"
  function toTitleCase(str) {
    return str
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Format durasi MM:SS dari milidetik (untuk display live & result)
  function formatTimer(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Format durasi ramah pengguna dari detik: "2 menit 15 detik"
  function formatDurationHuman(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "N/A";
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const parts = [];
    if (m > 0) parts.push(`${m} menit`);
    parts.push(`${s} detik`);
    return parts.join(" ");
  }

  // Bangun array soal salah dari jawaban siswa: [{no, selected, correct}]
  function buildWrongQuestions(answersArr) {
    if (!Array.isArray(answersArr)) return [];
    const wrong = [];
    quizData.forEach((q, i) => {
      const userAns = answersArr[i];
      const correctIdx = q.correctAnswerIndex;
      if (userAns !== correctIdx) {
        wrong.push({
          no: i + 1,
          selected: (userAns !== undefined && userAns !== null) ? OPTION_LETTERS[userAns] : "-",
          correct: OPTION_LETTERS[correctIdx],
        });
      }
    });
    return wrong;
  }

  // ============================================================
  //  SCREEN NAVIGATION
  // ============================================================

  function showScreen(name) {
    Object.values(screens).forEach((el) => {
      el.classList.add("hidden");
      el.classList.remove("fade-in");
    });
    const target = screens[name];
    if (!target) return;
    target.classList.remove("hidden");
    void target.offsetWidth; // reflow agar animasi ulang
    target.classList.add("fade-in");
    // Scroll ke atas tiap ganti layar
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ============================================================
  //  TIMER (Phase 4)
  // ============================================================

  // Mulai penghitung waktu. Pakai quizStartTime yang sudah ada (untuk resume).
  function startTimer() {
    stopTimer(); // pastikan tidak ada interval ganda
    if (!quizStartTime) quizStartTime = Date.now();
    updateTimerDisplay(); // tampilkan segera
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  // Hentikan penghitung waktu
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Update tampilan timer di quiz header (MM:SS)
  function updateTimerDisplay() {
    if (!els.quizTimer) return;
    const elapsed = Date.now() - quizStartTime;
    els.quizTimer.textContent = `⏱ ${formatTimer(elapsed)}`;
  }

  // ============================================================
  //  LOGIN
  // ============================================================

  function handleLogin(e) {
    e.preventDefault();
    const raw = els.nameInput.value;
    if (raw.trim() === "") {
      els.nameError.classList.remove("hidden");
      els.nameInput.focus();
      return;
    }
    const name = toTitleCase(raw);
    const session = { name: name, bestScore: 0, history: [] };
    saveSession(session);
    showDashboard();
  }

  // Real-time Title Case preview + toggle tombol Masuk
  function handleNameInput() {
    let raw = els.nameInput.value;
    const isValid = raw.trim() !== "";
    // Sembunyikan error saat mulai mengetik ulang
    els.nameError.classList.add("hidden");
    els.loginBtn.disabled = !isValid;

    // Normalisasi spasi ganda
    if (/\s{2,}/.test(raw)) {
      raw = raw.replace(/\s+/g, " ");
    }

    // Kapitalisasi otomatis di awal kata tanpa mengganggu kursor
    const selectionStart = els.nameInput.selectionStart;
    const selectionEnd = els.nameInput.selectionEnd;

    const formatted = raw
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    if (els.nameInput.value !== formatted) {
      els.nameInput.value = formatted;
      // Kembalikan posisi kursor
      els.nameInput.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  // ============================================================
  //  DASHBOARD
  // ============================================================

  function showDashboard() {
    const session = loadSession();
    if (!session) {
      // Fallback safety: kalau session hilang, balik ke login
      showLogin();
      return;
    }

    const bestScore = computeBestScore(session.history);
    const hasPassed = bestScore >= PASSING_GRADE;

    // Greeting (nama di-truncate via CSS, tooltip penuh)
    els.greetingName.textContent = session.name;
    els.greetingName.setAttribute("title", session.name);

    // Best score
    els.dashboardBestScore.textContent = bestScore;

    // Status badge
    if (bestScore === 0) {
      els.statusBadge.textContent = "BELUM MENCOBA";
      els.statusBadge.className =
        "inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600";
    } else if (hasPassed) {
      els.statusBadge.textContent = "LULUS ✓";
      els.statusBadge.className =
        "inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700";
    } else {
      els.statusBadge.textContent = "BELUM LULUS";
      els.statusBadge.className =
        "inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700";
    }

    renderHistoryExpandable(session);

    // Tombol aksi dinamis
    if (hasPassed) {
      els.startRemedialBtn.classList.add("hidden");
      if (els.passingGradeInfo) els.passingGradeInfo.classList.add("hidden");
      els.waBtn.classList.remove("hidden");
      if (els.waInfoText) els.waInfoText.classList.remove("hidden");
      // Cari durasi dari percobaan yang lulus (ambil yang pertama lulus)
      const passedAttempt = session.history.find((h) => h.score >= PASSING_GRADE);
      const bestDuration = passedAttempt ? passedAttempt.duration : null;
      els.waBtn.href = buildWhatsAppUrl(session.name, bestScore, bestDuration);
    } else {
      els.startRemedialBtn.classList.remove("hidden");
      if (els.passingGradeInfo) els.passingGradeInfo.classList.remove("hidden");
      els.waBtn.classList.add("hidden");
      if (els.waInfoText) els.waInfoText.classList.add("hidden");
    }

    showScreen("dashboard");
  }

  // Render riwayat dengan toggle-expandable inline (menggantikan eval modal).
  // Setiap percobaan punya baris utama (klik untuk toggle) + panel detail.
  function renderHistoryExpandable(session) {
    if (!session.history || session.history.length === 0) {
      els.historyList.innerHTML =
        '<li class="text-sm text-ink/40 italic text-center py-2">Belum ada percobaan</li>';
      return;
    }

    // Tampilkan terbaru di atas
    const reversed = session.history.slice().reverse();
    els.historyList.innerHTML = "";

    reversed.forEach((h) => {
      const passed = h.score >= PASSING_GRADE;
      const color = passed ? "text-success" : "text-ink/70";
      const badge = passed ? "bg-success/10 text-success" : "bg-border text-ink/50";

      // Tentukan correctCount / wrongCount / wrongQuestions (komputasi ulang dari answers untuk data lama)
      let correctCount = h.correctCount;
      let wrongCount = h.wrongCount;
      let wrongQuestions = h.wrongQuestions;
      if (correctCount === null || wrongCount === null || wrongQuestions === null) {
        // Komputasi dari answers[] + quizData (data lama)
        if (h.answers) {
          wrongQuestions = buildWrongQuestions(h.answers);
          wrongCount = wrongQuestions.length;
          correctCount = (quizData.length) - wrongCount;
        } else {
          // Tidak ada answers sama sekali; fallback dari score
          const total = quizData.length || 1;
          correctCount = Math.round((h.score / 100) * total);
          wrongCount = total - correctCount;
          wrongQuestions = [];
        }
      }

      // ---- Baris utama (klik untuk toggle) ----
      const headerLi = document.createElement("li");
      headerLi.className =
        "flex items-center justify-between bg-bg border border-border rounded-2xl px-4 py-3.5 cursor-pointer hover:bg-border/50 transition-all duration-200 select-none shadow-sm";
      headerLi.dataset.attempt = String(h.attempt);
      headerLi.dataset.passed = String(passed);
      headerLi.innerHTML =
        `<div class="text-sm flex-1 min-w-0">` +
          `<span class="font-bold text-ink/80">Percobaan ${escapeHtml(String(h.attempt))}</span>` +
          `<span class="block text-[11px] text-ink/40 font-medium mt-0.5">${escapeHtml(h.date || "")}</span>` +
        `</div>` +
        `<span class="text-base font-extrabold ${color} whitespace-nowrap ml-2 flex items-center gap-1.5">` +
          `${h.score}` +
          `<span class="text-[10px] font-bold ${badge} px-2 py-0.5 rounded-full">${passed ? "Lulus" : "Belum"}</span>` +
        `</span>`;

      // ---- Panel detail (default hidden) ----
      const detailLi = document.createElement("li");
      detailLi.className = "detail-panel hidden";
      detailLi.dataset.attempt = String(h.attempt);

      const durationText = (h.duration !== null && h.duration !== undefined)
        ? formatDurationHuman(h.duration)
        : "N/A";

      let detailHTML =
        `<div class="bg-card border border-border rounded-2xl p-4 mt-2 mb-1 space-y-3 shadow-inner">` +
          // Ringkasan statistik
          `<div class="grid grid-cols-3 gap-2.5 text-center">` +
            `<div class="bg-success/5 border border-success/10 rounded-xl p-2 flex flex-col justify-between items-center">` +
              `<p class="font-extrabold text-success text-sm sm:text-base leading-tight">${correctCount}</p>` +
              `<p class="text-[9px] font-bold text-success/70 uppercase tracking-wider mt-1">Benar</p>` +
            `</div>` +
            `<div class="bg-error/5 border border-error/10 rounded-xl p-2 flex flex-col justify-between items-center">` +
              `<p class="font-extrabold text-error text-sm sm:text-base leading-tight">${wrongCount}</p>` +
              `<p class="text-[9px] font-bold text-error/70 uppercase tracking-wider mt-1">Salah</p>` +
            `</div>` +
            `<div class="bg-primary/5 border border-primary/15 rounded-xl p-2 flex flex-col justify-between items-center">` +
              `<p class="font-extrabold text-primary text-sm sm:text-base leading-tight">${escapeHtml(durationText)}</p>` +
              `<p class="text-[9px] font-bold text-primary/70 uppercase tracking-wider mt-1">Waktu</p>` +
            `</div>` +
          `</div>`;

      if (passed) {
        // LULUS: ucapan selamat, SEMBUNYIKAN rincian soal salah
        detailHTML +=
          `<p class="text-success font-bold text-center text-xs py-1.5 bg-success/5 rounded-lg border border-success/15">🎉 Selamat, kamu telah lulus remedial!</p>`;
      } else {
        // BELUM LULUS: tampilkan daftar soal salah
        if (wrongQuestions && wrongQuestions.length > 0) {
          detailHTML +=
            `<p class="text-[11px] font-bold text-ink/50 uppercase tracking-wider pt-2">Soal yang salah:</p>` +
            `<div class="space-y-1.5">` +
              wrongQuestions.map((wq) =>
                `<div class="flex items-center justify-between text-xs bg-error/5 border border-error/10 rounded-xl px-3 py-2">` +
                  `<span class="font-semibold text-ink/70">Soal ${escapeHtml(String(wq.no))}</span>` +
                  `<span class="text-error font-bold">Jawabanmu: ${escapeHtml(String(wq.selected))}</span>` +
                `</div>`
              ).join("") +
            `</div>`;
        } else {
          detailHTML += `<p class="text-xs text-ink/40 italic text-center pt-1">Tidak ada data rincian jawaban untuk percobaan ini.</p>`;
        }
      }
      detailHTML += `</div>`;
      detailHTML += `</li>`; // pastikan ditutup
      detailLi.innerHTML = detailHTML;

      els.historyList.appendChild(headerLi);
      els.historyList.appendChild(detailLi);
    });
  }

  // ============================================================
  //  WHATSAPP
  // ============================================================

  function buildWhatsAppUrl(name, bestScore, duration) {
    const durationText = (duration !== null && duration !== undefined)
      ? ` dalam waktu ${formatDurationHuman(duration)}`
      : "";
    const text =
      `Assalamu'alaikum warahmatullahi wabarakatuh Kak Nabil, saya ${name} dari kelas VIII/8 telah berhasil menyelesaikan Remedial UAS Mapel Informatika ` +
      `dengan nilai akhir ${bestScore}${durationText}. Berikut saya berikan screenshot hasilnya.`;
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  }

  // ============================================================
  //  QUIZ (render, answer, next)
  // ============================================================

  function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    answers.length = 0;
    isAnswered = false;
    clearQuizState();     // bersihkan state lama sebelum mulai baru
    clearResultState();   // bersihkan state hasil lama
    quizStartTime = Date.now(); // mulai timer baru
    saveQuizState();      // simpan state awal agar refresh di soal 1 tetap di quiz screen
    startTimer();
    renderQuestion();
    showScreen("quiz");
  }

  // Lanjutkan kuis dari sessionStorage (anti-refresh)
  function resumeQuiz(state) {
    currentQuestionIndex = state.currentQuestionIndex;
    score = state.score;
    answers.length = 0;
    state.answers.forEach((a) => answers.push(a));
    isAnswered = !!state.isAnswered;
    quizStartTime = state.quizStartTime; // pertahankan start time asli

    startTimer();
    renderQuestion();
    showScreen("quiz");
  }

  function renderQuestion() {
    const q = quizData[currentQuestionIndex];
    const total = quizData.length;

    // Progress bar & teks
    const progressPercent = (currentQuestionIndex / total) * 100;
    els.progressBar.style.width = progressPercent + "%";
    els.progressText.textContent = `Soal ${currentQuestionIndex + 1} dari ${total}`;
    els.scoreText.textContent = `Skor: ${currentScoreScaled()}`;

    // Nomor & teks soal
    els.questionNumber.textContent = `Soal ${currentQuestionIndex + 1}`;
    els.questionText.innerHTML = formatItalicOnly(q.question);

    // Render opsi
    els.optionsContainer.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.index = idx;
      btn.className =
        "option-btn w-full text-left p-3.5 rounded-2xl border-2 border-border bg-card shadow-sm " +
        "flex items-center gap-3.5 transition-all duration-200 " +
        "hover:border-primary/45 hover:bg-bg active:scale-[0.99] " +
        "disabled:cursor-default disabled:hover:border-border disabled:hover:bg-card";

      btn.innerHTML =
        `<span class="option-letter shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-border text-ink/70 font-extrabold text-sm transition-all duration-200">` +
        `${OPTION_LETTERS[idx]}</span>` +
        `<span class="option-text flex-1 text-sm sm:text-base text-ink/80 font-medium leading-snug">${formatItalicOnly(opt)}</span>`;

      btn.addEventListener("click", () => selectAnswer(idx));
      els.optionsContainer.appendChild(btn);
    });

    // Sembunyikan/tampilkan penjelasan & tombol selanjutnya berdasarkan isAnswered
    if (isAnswered) {
      const selectedIdx = answers[currentQuestionIndex];
      const correctIdx = q.correctAnswerIndex;
      const buttons = els.optionsContainer.querySelectorAll(".option-btn");
      buttons.forEach((btn) => {
        const idx = Number(btn.dataset.index);
        btn.disabled = true;

        if (idx === correctIdx) {
          btn.classList.remove("border-border", "bg-card");
          btn.classList.add("border-success", "bg-success/5");
          btn.querySelector(".option-letter").classList.remove("bg-border", "text-ink/70");
          btn.querySelector(".option-letter").classList.add("bg-success", "text-white");
          btn.querySelector(".option-text").classList.add("text-success", "font-bold");
          appendMark(btn, "✓", "text-success");
        } else if (idx === selectedIdx) {
          btn.classList.remove("border-border", "bg-card");
          btn.classList.add("border-error", "bg-error/5");
          btn.querySelector(".option-letter").classList.remove("bg-border", "text-ink/70");
          btn.querySelector(".option-letter").classList.add("bg-error", "text-white");
          btn.querySelector(".option-text").classList.add("text-error", "font-bold");
          appendMark(btn, "✗", "text-error");
        } else {
          btn.classList.add("opacity-40");
        }
      });

      els.explanationText.innerHTML = formatMarkdown(q.explanation);
      els.explanationBox.classList.remove("hidden");

      const isLast = currentQuestionIndex === quizData.length - 1;
      els.nextBtn.textContent = isLast ? "Lihat Hasil" : "Soal Selanjutnya";
      els.nextBtn.classList.remove("hidden");
    } else {
      els.explanationBox.classList.add("hidden");
      els.nextBtn.classList.add("hidden");
    }
  }

  // Skor real-time dalam skala 0-100 (berdasar jumlah benar saat ini)
  function currentScoreScaled() {
    const total = quizData.length || 1;
    return Math.round((score / total) * 100);
  }

  function selectAnswer(index) {
    if (isAnswered) return; // Kunci: tidak bisa mengubah jawaban
    isAnswered = true;

    const q = quizData[currentQuestionIndex];
    const correct = q.correctAnswerIndex;
    answers[currentQuestionIndex] = index;

    const buttons = els.optionsContainer.querySelectorAll(".option-btn");
    buttons.forEach((btn) => {
      const idx = Number(btn.dataset.index);
      btn.disabled = true; // kunci semua tombol

      if (idx === correct) {
        // Tandai jawaban BENAR dengan hijau
        btn.classList.remove("border-border", "bg-card");
        btn.classList.add("border-success", "bg-success/5");
        btn.querySelector(".option-letter").classList.remove("bg-border", "text-ink/70");
        btn.querySelector(".option-letter").classList.add("bg-success", "text-white");
        btn.querySelector(".option-text").classList.add("text-success", "font-bold");
        appendMark(btn, "✓", "text-success");
      } else if (idx === index) {
        // Tandai pilihan siswa yang SALAH dengan merah
        btn.classList.remove("border-border", "bg-card");
        btn.classList.add("border-error", "bg-error/5");
        btn.querySelector(".option-letter").classList.remove("bg-border", "text-ink/70");
        btn.querySelector(".option-letter").classList.add("bg-error", "text-white");
        btn.querySelector(".option-text").classList.add("text-error", "font-bold");
        appendMark(btn, "✗", "text-error");
      } else {
        // Opsi lain dikaburkan sedikit
        btn.classList.add("opacity-40");
      }
    });

    // Update skor langsung jika benar
    if (index === correct) {
      score++;
      els.scoreText.textContent = `Skor: ${currentScoreScaled()}`;
    }

    // Tampilkan penjelasan
    els.explanationText.innerHTML = formatMarkdown(q.explanation);
    els.explanationBox.classList.remove("hidden");
    void els.explanationBox.offsetWidth; // re-trigger animasi
    els.explanationBox.classList.add("slide-in");

    // Tampilkan & ubah label tombol selanjutnya
    const isLast = currentQuestionIndex === quizData.length - 1;
    els.nextBtn.textContent = isLast ? "Lihat Hasil" : "Soal Selanjutnya";
    els.nextBtn.classList.remove("hidden");
    void els.nextBtn.offsetWidth;
    els.nextBtn.classList.add("slide-in");

    // ---- Anti-refresh: simpan state ke sessionStorage setelah jawab ----
    saveQuizState();
  }

  // Tambah tanda centang/silang di kanan tombol opsi
  function appendMark(btn, symbol, colorClass) {
    const mark = document.createElement("span");
    mark.className = `shrink-0 font-bold text-lg ${colorClass} ml-auto`;
    mark.textContent = symbol;
    btn.appendChild(mark);
  }

  function nextQuestion() {
    currentQuestionIndex++;
    isAnswered = false; // Reset status jawaban untuk soal berikutnya
    if (currentQuestionIndex < quizData.length) {
      saveQuizState(); // Simpan state soal berikutnya
      renderQuestion();
    } else {
      showResult();
    }
  }

  // ============================================================
  //  RESULT
  // ============================================================

  function showResult() {
    // Hentikan timer & catat durasi
    stopTimer();
    const duration = Math.max(0, Math.floor((Date.now() - quizStartTime) / 1000));

    // Penuhkan progress bar
    els.progressBar.style.width = "100%";

    const total = quizData.length;
    const correct = score;
    const wrong = total - correct;
    const finalScore = clampScore((correct / (total || 1)) * 100);
    const wrongQuestions = buildWrongQuestions(answers);

    // ---- Simpan attempt ke session (dengan field baru Phase 4) ----
    const session = loadSession();
    if (session) {
      const attemptNumber = session.history.length + 1;
      session.history.push({
        attempt: attemptNumber,
        score: finalScore,
        date: todayID(),
        duration: duration,
        correctCount: correct,
        wrongCount: wrong,
        wrongQuestions: wrongQuestions,
        answers: [...answers],
      });
      saveSession(session); // bestScore di-recompute di sini
    }

    // ---- Bersihkan sessionStorage kuis (karena sudah selesai) ----
    clearQuizState();

    // ---- Simpan state hasil ke sessionStorage agar refresh tetap berada di result screen ----
    saveResultState(finalScore, correct, wrong, duration, answers);

    // ---- Render tampilan hasil ----
    renderResultUI(finalScore, correct, wrong, duration);
  }

  function renderResultUI(finalScore, correct, wrong, duration) {
    const hasPassed = finalScore >= PASSING_GRADE;

    // ---- Ucapan dinamis berdasarkan skor ----
    let emoji, title, statusMsg;
    if (hasPassed) {
      emoji = "🎉";
      title = "Selamat!";
      statusMsg =
        `Selamat! Nilai kamu <strong class="text-success">${finalScore}</strong>. ` +
        `Kamu berhasil lulus remedial.`;
    } else {
      emoji = "💪";
      title = "Belum Lulus";
      statusMsg =
        `Maaf, nilai kamu <strong class="text-error">${finalScore}</strong>. ` +
        `Kamu belum memenuhi KKM (${PASSING_GRADE}). Silakan coba lagi.`;
    }

    els.resultEmoji.textContent = emoji;
    els.resultTitle.textContent = title;
    els.resultStatusMessage.innerHTML = statusMsg;
    els.finalScore.textContent = finalScore;
    els.correctCount.textContent = correct;
    els.wrongCount.textContent = wrong;
    els.resultDuration.textContent = formatTimer(duration * 1000);

    // Render review jawaban (dari Phase 1)
    renderReview();

    showScreen("result");
  }

  function renderReview() {
    els.reviewContainer.innerHTML = "";
    quizData.forEach((q, i) => {
      const userAns = answers[i];
      const correctIdx = q.correctAnswerIndex;
      const isCorrect = userAns === correctIdx;

      const item = document.createElement("div");
      item.className =
        `flex items-start gap-3 p-3.5 rounded-2xl border shadow-sm transition-all duration-200 ` +
        (isCorrect
          ? "bg-success/5 border-success/15 text-success"
          : "bg-error/5 border-error/15 text-error");

      const mark = isCorrect ? "✓" : "✗";
      const markColor = isCorrect ? "text-success" : "text-error";

      let detail = "";
      if (isCorrect) {
        detail = `<span class="font-bold text-success">Jawaban benar</span>`;
      } else {
        detail = `<span class="font-bold text-error">Jawaban salah</span>`;
      }

      item.innerHTML =
        `<span class="font-extrabold text-base shrink-0 ${markColor}">${mark}</span>` +
        `<div class="text-sm leading-snug">` +
          `<span class="font-bold text-ink/85">Soal ${i + 1}: </span>` +
          detail +
        `</div>`;

      els.reviewContainer.appendChild(item);
    });
  }

  // ============================================================
  //  ENTRY POINT / WIRING
  // ============================================================

  // ---------- Custom Confirm Modal Handlers ----------
  function openConfirmModal() {
    const modal = els.confirmModal;
    const card = els.confirmModalCard;
    if (!modal || !card) return;

    modal.classList.remove("hidden");
    // Force reflow
    void modal.offsetWidth;

    modal.classList.add("modal-active");
    card.classList.add("modal-card-active");
  }

  function closeConfirmModal() {
    const modal = els.confirmModal;
    const card = els.confirmModalCard;
    if (!modal || !card) return;

    modal.classList.remove("modal-active");
    card.classList.remove("modal-card-active");

    // Tunggu animasi transisi selesai (300ms) sebelum menyembunyikan
    setTimeout(() => {
      if (!modal.classList.contains("modal-active")) {
        modal.classList.add("hidden");
      }
    }, 300);
  }

  // ---------- Custom Exit Confirm Modal Handlers ----------
  function openExitConfirmModal() {
    const modal = els.exitConfirmModal;
    const card = els.exitConfirmModalCard;
    if (!modal || !card) return;

    modal.classList.remove("hidden");
    // Force reflow
    void modal.offsetWidth;

    modal.classList.add("modal-active");
    card.classList.add("modal-card-active");
  }

  // Tutup modal keluar kuis
  function closeExitConfirmModal() {
    const modal = els.exitConfirmModal;
    const card = els.exitConfirmModalCard;
    if (!modal || !card) return;

    modal.classList.remove("modal-active");
    card.classList.remove("modal-card-active");

    // Tunggu animasi transisi selesai (300ms) sebelum menyembunyikan
    setTimeout(() => {
      if (!modal.classList.contains("modal-active")) {
        modal.classList.add("hidden");
      }
    }, 300);
  }

  function showLogin() {
    // Reset form saat masuk login
    if (els.nameInput) {
      els.nameInput.value = "";
      els.loginBtn.disabled = true;
      els.nameError.classList.add("hidden");
    }
    showScreen("login");
    // Fokus input setelah animasi singkat
    setTimeout(() => els.nameInput && els.nameInput.focus(), 200);
  }

  // Event bindings
  els.loginForm.addEventListener("submit", handleLogin);
  els.nameInput.addEventListener("input", handleNameInput);
  els.startRemedialBtn.addEventListener("click", openConfirmModal);
  els.confirmCancelBtn.addEventListener("click", closeConfirmModal);
  els.confirmStartBtn.addEventListener("click", () => {
    closeConfirmModal();
    startQuiz();
  });
  els.quizExitBtn.addEventListener("click", openExitConfirmModal);
  els.exitConfirmCancelBtn.addEventListener("click", closeExitConfirmModal);
  els.exitConfirmBtn.addEventListener("click", () => {
    closeExitConfirmModal();
    stopTimer();
    clearQuizState();
    showDashboard();
  });
  els.nextBtn.addEventListener("click", nextQuestion);
  els.backToDashboardBtn.addEventListener("click", () => {
    clearResultState();
    showDashboard();
  });

  // Klik riwayat percobaan → toggle panel detail inline (event delegation)
  els.historyList.addEventListener("click", (e) => {
    const headerLi = e.target.closest("li[data-attempt]");
    if (!headerLi) return;
    // Lewati klik yang berasal dari dalam detail-panel itu sendiri
    if (headerLi.classList.contains("detail-panel")) return;
    const attempt = headerLi.dataset.attempt;
    if (!attempt) return;

    // Cari detail-panel saudara dengan attempt yang sama
    const panels = els.historyList.querySelectorAll("li.detail-panel");
    for (const panel of panels) {
      if (panel.dataset.attempt === attempt) {
        panel.classList.toggle("hidden");
        break;
      }
    }
  });

  // Bersihkan timer saat user meninggalkan halaman (jaga-jaga)
  window.addEventListener("beforeunload", () => {
    stopTimer();
  });

  // ---------- Theme Switcher Logic ----------
  const themeButtons = {
    light: document.getElementById("theme-light-btn"),
    dark:  document.getElementById("theme-dark-btn"),
    warm:  document.getElementById("theme-warm-btn")
  };

  function applyTheme(themeName) {
    document.documentElement.classList.remove("theme-dark", "theme-warm");
    if (themeName !== "light") {
      document.documentElement.classList.add("theme-" + themeName);
    }
    localStorage.setItem("kuis-theme", themeName);
    Object.keys(themeButtons).forEach((name) => {
      const btn = themeButtons[name];
      if (btn) {
        if (name === themeName) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });

    // Swap logo sekolah: gunakan versi dark saat dark mode aktif
    const logoSrc = themeName === "dark" ? "logo-sekolah-dark.svg" : "logo-sekolah.svg";
    document.querySelectorAll("img[data-school-logo]").forEach((img) => {
      img.src = logoSrc;
    });
  }

  Object.keys(themeButtons).forEach((name) => {
    const btn = themeButtons[name];
    if (btn) {
      btn.addEventListener("click", () => applyTheme(name));
    }
  });

  const currentTheme = localStorage.getItem("kuis-theme") || "light";
  applyTheme(currentTheme);

  // Update total questions in instruction modal dynamically
  if (els.confirmModalTotalQuestions && typeof quizData !== "undefined") {
    els.confirmModalTotalQuestions.textContent = `${quizData.length} Soal Pilihan Ganda`;
  }

  // Tampilan awal: prioritas — hasil kuis (refresh) > kuis yang tertunda (anti-refresh) > session > login
  const pendingResult = loadResultState();
  const pendingQuiz = loadQuizState();

  if (pendingResult) {
    // Kembalikan array answers untuk digunakan di renderReview()
    answers.length = 0;
    pendingResult.answers.forEach((a) => answers.push(a));
    renderResultUI(
      pendingResult.finalScore,
      pendingResult.correct,
      pendingResult.wrong,
      pendingResult.duration
    );
  } else if (pendingQuiz) {
    resumeQuiz(pendingQuiz);
  } else if (loadSession()) {
    showDashboard();
  } else {
    showLogin();
  }
})();
