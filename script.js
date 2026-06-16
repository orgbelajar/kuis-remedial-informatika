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
    // Quiz
    quizTimer:       document.getElementById("quiz-timer"),
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
  //  DATA LAYER (sessionStorage) — anti-refresh
  // ============================================================

  // Simpan state kuis ke sessionStorage (dipanggil setelah tiap jawaban)
  function saveQuizState() {
    try {
      const state = {
        currentQuestionIndex: currentQuestionIndex,
        score: score,
        answers: [...answers],
        quizStartTime: quizStartTime,
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
      els.waBtn.href = buildWhatsAppUrl(session.name, bestScore);
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
        '<li class="text-sm text-gray-400 italic text-center py-2">Belum ada percobaan</li>';
      return;
    }

    // Tampilkan terbaru di atas
    const reversed = session.history.slice().reverse();
    els.historyList.innerHTML = "";

    reversed.forEach((h) => {
      const passed = h.score >= PASSING_GRADE;
      const color = passed ? "text-green-600" : "text-gray-700";
      const badge = passed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";

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
        "flex items-center justify-between bg-card rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 hover:shadow-sm transition-all select-none";
      headerLi.dataset.attempt = String(h.attempt);
      headerLi.dataset.passed = String(passed);
      headerLi.innerHTML =
        `<div class="text-sm flex-1 min-w-0">` +
          `<span class="font-medium text-gray-800">Percobaan ${escapeHtml(String(h.attempt))}</span>` +
          `<span class="block text-xs text-gray-400">${escapeHtml(h.date || "")}</span>` +
        `</div>` +
        `<span class="text-lg font-bold ${color} whitespace-nowrap ml-2">` +
          `${h.score}` +
          `<span class="text-xs font-normal ${badge} ml-1 px-2 py-0.5 rounded-full">${passed ? "Lulus" : "Belum"}</span>` +
        `</span>`;

      // ---- Panel detail (default hidden) ----
      const detailLi = document.createElement("li");
      detailLi.className = "detail-panel hidden";
      detailLi.dataset.attempt = String(h.attempt);

      const durationText = (h.duration !== null && h.duration !== undefined)
        ? formatDurationHuman(h.duration)
        : "N/A";

      let detailHTML =
        `<div class="bg-white border border-gray-200 rounded-lg p-3 space-y-2 text-sm">` +
          // Ringkasan statistik
          `<div class="grid grid-cols-3 gap-2 text-center">` +
            `<div class="bg-green-50 rounded-md p-2"><p class="font-bold text-green-600">${correctCount}</p><p class="text-[10px] text-gray-500">Benar</p></div>` +
            `<div class="bg-red-50 rounded-md p-2"><p class="font-bold text-red-500">${wrongCount}</p><p class="text-[10px] text-gray-500">Salah</p></div>` +
            `<div class="bg-blue-50 rounded-md p-2"><p class="font-bold text-blue-600 text-xs leading-tight">${escapeHtml(durationText)}</p><p class="text-[10px] text-gray-500">Waktu</p></div>` +
          `</div>`;

      if (passed) {
        // LULUS: ucapan selamat, SEMBUNYIKAN rincian soal salah
        detailHTML +=
          `<p class="text-green-700 font-medium text-center text-xs pt-1">🎉 Selamat, kamu telah lulus remedial!</p>`;
      } else {
        // BELUM LULUS: tampilkan daftar soal salah
        if (wrongQuestions && wrongQuestions.length > 0) {
          detailHTML +=
            `<p class="text-xs font-semibold text-gray-600 pt-1">Soal yang salah:</p>` +
            `<div class="space-y-1">` +
              wrongQuestions.map((wq) =>
                `<div class="flex items-center gap-2 text-xs bg-red-50 border border-red-100 rounded px-2 py-1">` +
                  `<span class="font-medium text-gray-700 shrink-0">Soal ${escapeHtml(String(wq.no))}</span>` +
                  `<span class="text-red-600">Jawabanmu: ${escapeHtml(String(wq.selected))}</span>` +
                  `<span class="text-gray-400">→</span>` +
                  `<span class="text-green-600 font-medium">Benar: ${escapeHtml(String(wq.correct))}</span>` +
                `</div>`
              ).join("") +
            `</div>`;
        } else {
          detailHTML += `<p class="text-xs text-gray-400 italic text-center pt-1">Tidak ada data rincian jawaban untuk percobaan ini.</p>`;
        }
      }
      detailHTML += `</div>`;
      detailLi.innerHTML = detailHTML;

      els.historyList.appendChild(headerLi);
      els.historyList.appendChild(detailLi);
    });
  }

  // ============================================================
  //  WHATSAPP
  // ============================================================

  function buildWhatsAppUrl(name, bestScore) {
    const text =
      `Assalamu'alaikum warahmatullahi wabarakatuh Kak Nabil, saya ${name} dari kelas VIII/8 telah berhasil menyelesaikan remedial UAS Informatika ` +
      `dengan nilai akhir ${bestScore}. Berikut saya berikan screenshot hasilnya.`;
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
    quizStartTime = Date.now(); // mulai timer baru
    startTimer();
    renderQuestion();
    showScreen("quiz");
  }

  // Lanjutkan kuis dari sessionStorage (anti-refresh)
  function resumeQuiz(state) {
    currentQuestionIndex = state.currentQuestionIndex + 1; // lanjut ke soal berikutnya
    score = state.score;
    answers.length = 0;
    state.answers.forEach((a) => answers.push(a));
    isAnswered = false;
    quizStartTime = state.quizStartTime; // pertahankan start time asli

    // Kasus: soal terakhir sudah dijawab sebelum refresh → langsung hasil
    if (currentQuestionIndex >= quizData.length) {
      startTimer(); // timer tetap jalan untuk konsistensi, akan distop di showResult
      showResult();
      return;
    }

    startTimer();
    renderQuestion();
    showScreen("quiz");
  }

  function renderQuestion() {
    const q = quizData[currentQuestionIndex];
    const total = quizData.length;
    isAnswered = false;

    // Progress bar & teks
    const progressPercent = (currentQuestionIndex / total) * 100;
    els.progressBar.style.width = progressPercent + "%";
    els.progressText.textContent = `Soal ${currentQuestionIndex + 1} dari ${total}`;
    els.scoreText.textContent = `Skor: ${currentScoreScaled()}`;

    // Nomor & teks soal
    els.questionNumber.textContent = `Soal ${currentQuestionIndex + 1}`;
    els.questionText.textContent = q.question;

    // Render opsi
    els.optionsContainer.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.index = idx;
      btn.className =
        "option-btn w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white " +
        "flex items-center gap-3 transition-all duration-200 " +
        "hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99] " +
        "disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:bg-white";

      btn.innerHTML =
        `<span class="option-letter shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold text-sm transition-colors">` +
        `${OPTION_LETTERS[idx]}</span>` +
        `<span class="option-text flex-1 text-base sm:text-lg text-gray-700">${escapeHtml(opt)}</span>`;

      btn.addEventListener("click", () => selectAnswer(idx));
      els.optionsContainer.appendChild(btn);
    });

    // Sembunyikan penjelasan & tombol selanjutnya (state awal tiap soal)
    els.explanationBox.classList.add("hidden");
    els.nextBtn.classList.add("hidden");
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
        btn.classList.remove("border-gray-200", "bg-white");
        btn.classList.add("border-green-500", "bg-green-50");
        btn.querySelector(".option-letter").classList.remove("bg-gray-100", "text-gray-600");
        btn.querySelector(".option-letter").classList.add("bg-green-500", "text-white");
        btn.querySelector(".option-text").classList.add("text-green-700", "font-medium");
        appendMark(btn, "✓", "text-green-600");
      } else if (idx === index) {
        // Tandai pilihan siswa yang SALAH dengan merah
        btn.classList.remove("border-gray-200", "bg-white");
        btn.classList.add("border-red-400", "bg-red-50");
        btn.querySelector(".option-letter").classList.remove("bg-gray-100", "text-gray-600");
        btn.querySelector(".option-letter").classList.add("bg-red-500", "text-white");
        btn.querySelector(".option-text").classList.add("text-red-700");
        appendMark(btn, "✗", "text-red-500");
      } else {
        // Opsi lain dikaburkan sedikit
        btn.classList.add("opacity-60");
      }
    });

    // Update skor langsung jika benar
    if (index === correct) {
      score++;
      els.scoreText.textContent = `Skor: ${currentScoreScaled()}`;
    }

    // Tampilkan penjelasan
    els.explanationText.textContent = q.explanation;
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
    mark.className = `shrink-0 font-bold text-xl ${colorClass}`;
    mark.textContent = symbol;
    btn.appendChild(mark);
  }

  function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizData.length) {
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

    // ---- Bersihkan sessionStorage (data sudah permanen di localStorage) ----
    clearQuizState();

    const hasPassed = finalScore >= PASSING_GRADE;

    // ---- Ucapan dinamis berdasarkan skor ----
    let emoji, title, statusMsg;
    if (hasPassed) {
      emoji = "🎉";
      title = "Selamat!";
      statusMsg =
        `Selamat! Nilai kamu <strong class="text-green-600">${finalScore}</strong>. ` +
        `Kamu berhasil lulus remedial.`;
    } else {
      emoji = "💪";
      title = "Belum Lulus";
      statusMsg =
        `Maaf, nilai kamu <strong class="text-red-500">${finalScore}</strong>. ` +
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
        `flex items-start gap-2 p-3 rounded-lg border ` +
        (isCorrect
          ? "bg-green-50 border-green-200"
          : "bg-red-50 border-red-200");

      const mark = isCorrect ? "✓" : "✗";
      const markColor = isCorrect ? "text-green-600" : "text-red-500";

      let detail = "";
      if (isCorrect) {
        detail = `<span class="font-medium text-green-700">Jawabanmu benar</span>`;
      } else {
        detail = `<span class="font-medium text-red-700">Jawabanmu salah</span>`;
      }

      item.innerHTML =
        `<span class="font-bold ${markColor} shrink-0">${mark}</span>` +
        `<div class="text-sm leading-snug">` +
          `<span class="font-medium text-gray-700">Soal ${i + 1}: </span>` +
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
  els.nextBtn.addEventListener("click", nextQuestion);
  els.backToDashboardBtn.addEventListener("click", showDashboard);

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

  // Tampilan awal: prioritas — kuis yang tertunda (anti-refresh) > session > login
  const pendingQuiz = loadQuizState();
  if (pendingQuiz) {
    resumeQuiz(pendingQuiz);
  } else if (loadSession()) {
    showDashboard();
  } else {
    showLogin();
  }
})();
