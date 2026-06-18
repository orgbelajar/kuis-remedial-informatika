// ============================================================
//  LOGIKA KUIS REMEDIAL INFORMATIKA KELAS 8
//  Tahap 4: Timer, Anti-Refresh, Riwayat yang Bisa Diperluas, Durasi
// ------------------------------------------------------------
//  Tergantung pada: quizData (dari quiz-data.js)
// ============================================================

(function () {
  "use strict";

  // ---------- Konstanta ----------
  const STORAGE_KEY = "remedialSession";      // localStorage (profil + riwayat permanen)
  const QUIZ_STATE_KEY = "remedialQuizState"; // sessionStorage (anti-refresh)
  const RESULT_STATE_KEY = "remedialResultState"; // sessionStorage (mempertahankan status hasil kuis saat refresh)
  const PASSING_GRADE = 70;                   // KKM
  const WA_NUMBER = "6281412397588";           // Kak Nabil
  const OPTION_LETTERS = ["A", "B", "C", "D"];
  const resultGate = window.RemedialResultGate;

  // ---------- Status Kuis ----------
  let currentQuestionIndex = 0;   // Indeks soal yang sedang ditampilkan
  let score = 0;                  // Jumlah jawaban benar (0..totalQuestions)
  const answers = [];             // Menyimpan indeks pilihan siswa per soal (untuk ulasan)
  let isAnswered = false;         // Mencegah mengubah jawaban setelah memilih

  // ---------- Status Timer (Tahap 4) ----------
  let quizStartTime = 0;          // Date.now() saat kuis dimulai/dilanjutkan
  let timerInterval = null;       // Referensi setInterval
  let currentResultMeta = null;   // Metadata percobaan yang sedang tampil di Layar Hasil

  // ---------- Referensi DOM ----------
  const screens = {
    login:     document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
    quiz:      document.getElementById("quiz-screen"),
    result:    document.getElementById("result-screen"),
  };

  const els = {
    // Masuk (Login)
    loginForm:    document.getElementById("login-form"),
    nameInput:    document.getElementById("name-input"),
    nameError:    document.getElementById("name-error"),
    loginBtn:     document.getElementById("login-btn"),
    // Beranda (Dashboard)
    greetingName:       document.getElementById("greeting-name"),
    dashboardBestScore: document.getElementById("dashboard-best-score"),
    statusBadge:        document.getElementById("status-badge"),
    historyList:        document.getElementById("history-list"),
    startRemedialBtn:   document.getElementById("start-remedial-btn"),
    viewLastResultBtn:  document.getElementById("view-last-result-btn"),
    dashboardScreenshotBtn: document.getElementById("dashboard-screenshot-btn"),
    dashboardActionStatus: document.getElementById("dashboard-action-status"),
    passingGradeInfo:   document.getElementById("passing-grade-info"),
    waBtn:              document.getElementById("wa-btn"),
    waBtnIcon:          document.getElementById("wa-btn-icon"),
    waInfoText:         document.getElementById("wa-info-text"),
    confirmModal:       document.getElementById("confirm-modal"),
    confirmModalCard:   document.getElementById("confirm-modal-card"),
    confirmCancelBtn:   document.getElementById("confirm-cancel-btn"),
    confirmStartBtn:    document.getElementById("confirm-start-btn"),
    confirmModalTotalQuestions: document.getElementById("confirm-modal-total-questions"),
    // Kuis
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
    // Hasil
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
  //  LAPISAN DATA (localStorage) — sesi permanen
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
  function saveResultState(finalScore, correct, wrong, duration, answersArr, resultMeta) {
    try {
      const state = {
        finalScore: finalScore,
        correct: correct,
        wrong: wrong,
        duration: duration,
        answers: [...answersArr],
        resultMeta: resultMeta || null,
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
  //  FUNGSI PEMBANTU (HELPERS)
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

  // Mengubah markdown sederhana (**tebal** dan *miring*) menjadi HTML setelah melakukan proses escape
  function formatMarkdown(text) {
    if (typeof text !== "string") return "";
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  // Mengubah hanya format miring (*miring*) menjadi HTML setelah proses escape, menonaktifkan format tebal
  function formatItalicOnly(text) {
    if (typeof text !== "string") return "";
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  // Format Huruf Kapital per Kata (Title Case) + normalisasi spasi: "nabil  ihsan" -> "Nabil Ihsan"
  function toTitleCase(str) {
    return str
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Format durasi MM:SS dari milidetik (untuk tampilan langsung & hasil)
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

  // Susun daftar soal yang salah berdasarkan jawaban siswa: [{no, selected, correct}]
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
  //  NAVIGASI LAYAR
  // ============================================================

  function showScreen(name) {
    Object.values(screens).forEach((el) => {
      el.classList.add("hidden");
      el.classList.remove("fade-in");
    });
    const target = screens[name];
    if (!target) return;
    target.classList.remove("hidden");
    void target.offsetWidth; // Pembaruan tata letak (reflow) agar animasi diulang
    target.classList.add("fade-in");
    // Scroll ke atas tiap ganti layar
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ============================================================
  //  PENGHITUNG WAKTU (TIMER - Tahap 4)
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

  // Perbarui tampilan timer di header kuis (MM:SS)
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

  // Pratinjau kapitalisasi kata secara langsung + aktifkan/nonaktifkan tombol Masuk
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

    // Sapaan (nama dipotong menggunakan CSS, deskripsi singkat (tooltip) penuh)
    els.greetingName.textContent = session.name;
    els.greetingName.setAttribute("title", session.name);

    // Skor terbaik
    els.dashboardBestScore.textContent = bestScore;

    // Lencana status
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
      if (els.passingGradeInfo) els.passingGradeInfo.classList.add("hidden");
      els.waBtn.classList.remove("hidden");
      if (els.waInfoText) els.waInfoText.classList.remove("hidden");
      updateDashboardWhatsAppGate(session);
      // Siswa lulus: sembunyikan tombol mulai, tampilkan "Lihat Hasil Terakhir"
      els.startRemedialBtn.classList.add("hidden");
      if (els.viewLastResultBtn) els.viewLastResultBtn.classList.remove("hidden");
    } else {
      els.startRemedialBtn.textContent = "Mulai Remedial";
      els.startRemedialBtn.classList.remove("hidden");
      if (els.viewLastResultBtn) els.viewLastResultBtn.classList.add("hidden");
      if (els.dashboardScreenshotBtn) els.dashboardScreenshotBtn.classList.add("hidden");
      if (els.dashboardActionStatus) els.dashboardActionStatus.textContent = "";
      if (els.passingGradeInfo) els.passingGradeInfo.classList.remove("hidden");
      els.waBtn.classList.add("hidden");
      if (els.waInfoText) els.waInfoText.classList.add("hidden");
      setWhatsAppLinkState(els.waBtn, false, "#");
    }

    showScreen("dashboard");
  }

  // Kembali ke Layar Hasil dari Dashboard tanpa mengerjakan ulang kuis.
  // Menggunakan data percobaan terakhir dari riwayat sesi.
  function showLastResult() {
    const session = loadSession();
    if (!session || !Array.isArray(session.history) || session.history.length === 0) {
      return; // Tidak ada data hasil
    }

    // Ambil percobaan terakhir (indeks terakhir = terbaru)
    const lastAttempt = session.history[session.history.length - 1];
    if (!lastAttempt) return;

    const total = quizData.length || 1;
    const finalScore = clampScore(Number(lastAttempt.score) || 0);
    const duration = Math.max(0, Math.round(Number(lastAttempt.duration) || 0));

    // Hitung ulang jumlah benar/salah
    let correct = lastAttempt.correctCount;
    let wrong = lastAttempt.wrongCount;
    if (correct === null || correct === undefined || wrong === null || wrong === undefined) {
      // Pilihan cadangan (fallback) dari skor
      correct = Math.round((finalScore / 100) * total);
      wrong = total - correct;
    }

    // Susun ulang array jawaban untuk renderReview()
    answers.length = 0;
    if (Array.isArray(lastAttempt.answers)) {
      lastAttempt.answers.forEach((a) => answers.push(a));
    }

    // Buat metadata hasil
    const resultMeta = buildResultAttemptMeta(
      session.name,
      lastAttempt.attempt,
      finalScore,
      duration,
      lastAttempt.date
    );

    renderResultUI(finalScore, correct, wrong, duration, resultMeta);
  }

  // Merender riwayat dengan tampilan buka-tutup baris (menggantikan modal evaluasi).
  // Setiap percobaan memiliki baris utama (klik untuk beralih tampilan) + panel rincian.
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

      // Tentukan jumlah benar / jumlah salah / rincian soal salah (komputasi ulang dari jawaban untuk data lama)
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
          `<span class="font-bold text-ink/80">Percobaan ke-${escapeHtml(String(h.attempt))}</span>` +
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
        ? formatTimer(h.duration * 1000)
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

  function buildResultAttemptMeta(name, attempt, scoreValue, duration, date) {
    const meta = {
      name: name || "Siswa",
      attempt: Number(attempt) || 0,
      score: clampScore(Number(scoreValue) || 0),
      duration: Math.max(0, Math.round(Number(duration) || 0)),
      date: date || todayID(),
    };
    meta.attemptKey = resultGate
      ? resultGate.buildAttemptKey(meta)
      : `${meta.name}|attempt:${meta.attempt}|score:${meta.score}|duration:${meta.duration}|date:${meta.date}`;
    return meta;
  }

  function getBestPassedAttempt(session) {
    if (!session || !Array.isArray(session.history)) return null;
    return session.history.reduce((best, attempt) => {
      if (!attempt || attempt.score < PASSING_GRADE) return best;
      if (!best) return attempt;
      if (attempt.score > best.score) return attempt;
      return best;
    }, null);
  }

  function hasScreenshotForAttempt(attemptKey) {
    if (!resultGate || !attemptKey) return false;
    try {
      return resultGate.hasScreenshotForAttempt(localStorage, attemptKey);
    } catch (e) {
      return false;
    }
  }

  function readScreenshotGateStatus() {
    if (!resultGate) return null;
    try {
      return resultGate.readScreenshotStatus(localStorage);
    } catch (e) {
      return null;
    }
  }

  function saveScreenshotForAttempt(attemptKey) {
    if (!resultGate || !attemptKey) return;
    try {
      resultGate.saveScreenshotStatus(localStorage, attemptKey);
    } catch (e) {
      throw new Error("Status screenshot tidak bisa disimpan di perangkat ini.");
    }
  }

  function clearScreenshotGate() {
    if (!resultGate) return;
    try {
      resultGate.clearScreenshotStatus(localStorage);
    } catch (e) {
      /* abaikan */
    }
  }

  function setWhatsAppLinkState(link, enabled, url) {
    if (!link) return;
    const iconContainer = els.waBtnIcon;

    if (enabled) {
      link.href = url;
      link.setAttribute("aria-disabled", "false");
      link.removeAttribute("tabindex");
      link.removeAttribute("title");

      // Hapus opacity redup, aktifkan warna penuh
      link.classList.remove("opacity-40");
      link.classList.add("opacity-100");

      // Ganti ikon menjadi WhatsApp Bootstrap (Aktif)
      if (iconContainer) {
        iconContainer.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
          </svg>
        `;
      }
    } else {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
      link.setAttribute("tabindex", "-1");
      link.setAttribute("title", "Ambil screenshot hasil terlebih dahulu.");

      // Tambahkan opacity redup
      link.classList.remove("opacity-100");
      link.classList.add("opacity-40");

      // Ganti ikon menjadi Gembok (Terkunci)
      if (iconContainer) {
        iconContainer.innerHTML = `
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        `;
      }
    }
  }

  function updateDashboardWhatsAppGate(session) {
    if (!els.waBtn) return false;
    const status = readScreenshotGateStatus();
    let matchedMeta = null;
    if (status && status.attemptKey) {
      for (const attempt of session.history || []) {
        if (!attempt || attempt.score < PASSING_GRADE) continue;
        const meta = buildResultAttemptMeta(
          session.name,
          attempt.attempt,
          attempt.score,
          attempt.duration,
          attempt.date
        );
        if (meta.attemptKey === status.attemptKey) {
          matchedMeta = meta;
          break;
        }
      }
    }

    const ready = Boolean(matchedMeta);
    const fallbackAttempt = getBestPassedAttempt(session);
    const fallbackMeta = fallbackAttempt
      ? buildResultAttemptMeta(session.name, fallbackAttempt.attempt, fallbackAttempt.score, fallbackAttempt.duration, fallbackAttempt.date)
      : null;
    const metaForMessage = matchedMeta || fallbackMeta;

    setWhatsAppLinkState(
      els.waBtn,
      ready,
      metaForMessage ? buildWhatsAppUrl(session.name, metaForMessage.score, metaForMessage.duration) : "#"
    );

    // Tampilkan tombol Screenshot hanya jika siswa sudah lulus
    if (els.dashboardScreenshotBtn) els.dashboardScreenshotBtn.classList.remove("hidden");

    if (els.waInfoText) {
      const textNode = els.waInfoText.querySelector("span:last-child");
      if (textNode) {
        textNode.innerHTML = ready
          ? "Screenshot hasil sudah tersimpan. Silakan kirim hasil ke WhatsApp Kak Nabil dengan tombol di bawah."
          : "Setelah lulus remedial, wajib screenshot hasil remedial terlebih dahulu menggunakan tombol di bawah.";
      }
    }
    return ready;
  }

  function downloadCanvasAsPng(canvas, filename) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas gagal dibuat menjadi file PNG."));
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = filename;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, "image/png");
        return;
      }

      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      link.remove();
      resolve();
    });
  }

  function openWhatsAppAndReset(link) {
    if (!link || link.getAttribute("aria-disabled") === "true") return false;
    const url = link.href;
    const opened = window.open(url, "_blank");
    if (!opened) return false;
    try {
      opened.opener = null;
    } catch (e) {
      /* abaikan */
    }
    clearScreenshotGate();
    const session = loadSession();
    if (session) updateDashboardWhatsAppGate(session);
    return true;
  }

  // ============================================================
  //  KUIS (render, jawab, selanjutnya)
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
  //  HASIL
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
    let resultMeta = buildResultAttemptMeta("Siswa", 0, finalScore, duration, todayID());

    // ---- Simpan attempt ke session (dengan field baru Phase 4) ----
    const session = loadSession();
    if (session) {
      const attemptNumber = session.history.length + 1;
      const attemptDate = todayID();
      session.history.push({
        attempt: attemptNumber,
        score: finalScore,
        date: attemptDate,
        duration: duration,
        correctCount: correct,
        wrongCount: wrong,
        wrongQuestions: wrongQuestions,
        answers: [...answers],
      });
      resultMeta = buildResultAttemptMeta(session.name, attemptNumber, finalScore, duration, attemptDate);
      saveSession(session); // bestScore di-recompute di sini
    }

    // ---- Bersihkan sessionStorage kuis (karena sudah selesai) ----
    clearQuizState();

    // ---- Simpan state hasil ke sessionStorage agar refresh tetap berada di result screen ----
    saveResultState(finalScore, correct, wrong, duration, answers, resultMeta);

    // ---- Render tampilan hasil ----
    renderResultUI(finalScore, correct, wrong, duration, resultMeta);
  }

  function renderResultUI(finalScore, correct, wrong, duration, resultMeta) {
    const hasPassed = finalScore >= PASSING_GRADE;
    currentResultMeta = resultMeta || buildResultAttemptMeta("Siswa", 0, finalScore, duration, todayID());

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
        `flex items-center gap-3 p-3.5 rounded-2xl border shadow-sm transition-all duration-200 ` +
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

  async function handleDashboardScreenshot() {
    if (!els.dashboardScreenshotBtn || !els.dashboardActionStatus) return;
    const session = loadSession();
    if (!session) return;

    const passedAttempt = getBestPassedAttempt(session);
    if (!passedAttempt) {
      els.dashboardActionStatus.textContent = "Data hasil remedial belum siap.";
      els.dashboardActionStatus.className = "text-xs sm:text-sm font-bold text-error leading-relaxed mt-3 empty:hidden";
      return;
    }

    if (typeof window.htmlToImage === "undefined") {
      els.dashboardActionStatus.textContent = "Library screenshot gagal dimuat. Coba muat ulang halaman.";
      els.dashboardActionStatus.className = "text-xs sm:text-sm font-bold text-error leading-relaxed mt-3 empty:hidden";
      return;
    }

    const originalBtnHTML = els.dashboardScreenshotBtn.innerHTML;
    const attemptMeta = buildResultAttemptMeta(
      session.name,
      passedAttempt.attempt,
      passedAttempt.score,
      passedAttempt.duration,
      passedAttempt.date
    );

    try {
      // Sebelum memproses: Tunggu font selesai dimuat
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const dashScreen = screens.dashboard;
      const cardBgColor = window.getComputedStyle(dashScreen).backgroundColor || "#ffffff";

      // html-to-image mengambil clone DOM secara sinkron di awal panggilan ini
      const blobPromise = window.htmlToImage.toBlob(dashScreen, {
        pixelRatio: Math.max(3, window.devicePixelRatio || 2), // Resolusi tajam
        backgroundColor: cardBgColor,
        style: {
          transform: "none",
          margin: "0",
        }
      });

      // Setelah proses clone dimulai, baru ubah status loading di layar asli
      els.dashboardScreenshotBtn.disabled = true;
      const textSpan = els.dashboardScreenshotBtn.querySelector("span:last-child");
      if (textSpan) {
        textSpan.textContent = "Menyiapkan Screenshot...";
        textSpan.classList.add("whitespace-nowrap");
      }
      els.dashboardActionStatus.textContent = "Sedang memproses screenshot (kualitas tinggi)...";
      els.dashboardActionStatus.className = "text-xs sm:text-sm font-bold text-primary leading-relaxed mt-3 empty:hidden";

      const blob = await blobPromise;

      if (!blob) {
        throw new Error("Blob gambar kosong.");
      }

      const filename = resultGate.buildScreenshotFileName({
        name: attemptMeta.name,
        date: attemptMeta.date,
      });

      await downloadCanvasAsPng({ toBlob: (cb) => cb(blob) }, filename);
      saveScreenshotForAttempt(attemptMeta.attemptKey);

      els.dashboardActionStatus.textContent = "Screenshot berhasil diunduh: " + filename;
      els.dashboardActionStatus.className = "text-xs sm:text-sm font-bold text-success leading-relaxed mt-3 empty:hidden";

      // Perbarui status gate Dashboard
      updateDashboardWhatsAppGate(session);
    } catch (err) {
      els.dashboardActionStatus.textContent = "Gagal mengambil screenshot. Silakan coba lagi.";
      els.dashboardActionStatus.className = "text-xs sm:text-sm font-bold text-error leading-relaxed mt-3 empty:hidden";
      console.error("html-to-image capture error:", err);
    } finally {
      els.dashboardScreenshotBtn.disabled = false;
      if (els.dashboardScreenshotBtn) {
        els.dashboardScreenshotBtn.innerHTML = originalBtnHTML;
      }
    }
  }

  function handleDashboardWhatsAppClick(e) {
    if (!els.waBtn || els.waBtn.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const opened = openWhatsAppAndReset(els.waBtn);

    // Selalu re-render Dashboard gate state setelah reset
    const session = loadSession();
    if (session) updateDashboardWhatsAppGate(session);

    if (els.dashboardActionStatus) {
      els.dashboardActionStatus.textContent = opened
        ? "Status screenshot di-reset. Silakan screenshot ulang jika ingin mengirim lagi."
        : "WhatsApp gagal dibuka. Izinkan pop-up browser lalu coba lagi.";
      els.dashboardActionStatus.className = opened
        ? "text-xs sm:text-sm font-bold text-ink/55 leading-relaxed mt-3 empty:hidden"
        : "text-xs sm:text-sm font-bold text-error leading-relaxed mt-3 empty:hidden";
    }
  }

  // ============================================================
  //  TITIK MASUK / PENGHUBUNG KODE
  // ============================================================

  // ---------- Penangan Modal Konfirmasi Kustom ----------
  function openConfirmModal() {
    const modal = els.confirmModal;
    const card = els.confirmModalCard;
    if (!modal || !card) return;

    modal.classList.remove("hidden");
    // Paksa reflow (pembaruan tata letak)
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

  // ---------- Penangan Modal Konfirmasi Keluar Kustom ----------
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

  // Pengikatan Event (Event bindings)
  els.loginForm.addEventListener("submit", handleLogin);
  els.nameInput.addEventListener("input", handleNameInput);
  els.startRemedialBtn.addEventListener("click", openConfirmModal);
  if (els.viewLastResultBtn) els.viewLastResultBtn.addEventListener("click", showLastResult);
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
  if (els.dashboardScreenshotBtn) els.dashboardScreenshotBtn.addEventListener("click", handleDashboardScreenshot);
  if (els.waBtn) els.waBtn.addEventListener("click", handleDashboardWhatsAppClick);
  els.backToDashboardBtn.addEventListener("click", () => {
    clearResultState();
    showDashboard();
  });

  // Klik riwayat percobaan → beralih panel detail inline (delegasi event)
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

  // ---------- Logika Pengalih Tema ----------
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

    // Gunakan logo-sekolah.svg untuk semua tema
    document.querySelectorAll("img[data-school-logo]").forEach((img) => {
      img.src = "logo-sekolah.svg";
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

  // Perbarui jumlah soal dalam modal instruksi secara dinamis
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
      pendingResult.duration,
      pendingResult.resultMeta
    );
  } else if (pendingQuiz) {
    resumeQuiz(pendingQuiz);
  } else if (loadSession()) {
    showDashboard();
  } else {
    showLogin();
  }
})();
