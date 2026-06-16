// ============================================================
//  DATA SOAL
// ------------------------------------------------------------
//  Cara menambah soal baru:
//    Salin satu blok objek di bawah (dari tanda { hingga }),
//    tempel sebelum tanda tutup array ], lalu ubah isinya.
//
//  Struktur tiap soal:
//    {
//      question:            "Teks pertanyaan di sini",
//      options:             ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
//      correctAnswerIndex:  0,            // 0=A, 1=B, 2=C, 3=D
//      explanation:         "Penjelasan jawaban di sini"
//    }
//
//  Catatan: Tiap soal bernilai 5 poin contoh: (20 soal x 5 = 100).
// ============================================================

const quizData = [
  {
    question: "Kumpulan fakta atau keterangan yang belum diolah disebut ....",
    options: ["Informasi", "Data", "Grafik", "Tabel"],
    correctAnswerIndex: 1,
    explanation: "**Data** adalah sekumpulan fakta atau keterangan mentah. Jika data tersebut sudah diolah menjadi bentuk yang lebih bermakna, barulah ia disebut sebagai **Informasi**."
  },
  {
    question: "Data yang disajikan dalam bentuk baris dan kolom disebut ....",
    options: ["Diagram", "Grafik", "Tabel", "Statistik"],
    correctAnswerIndex: 2,
    explanation: "**Tabel** adalah susunan data yang disajikan dalam bentuk **baris** (mendatar) dan **kolom** (menurun) agar data lebih terstruktur dan mudah dibaca."
  },
  {
    question: "Contoh data kuantitatif adalah ....",
    options: ["Warna favorit siswa", "Nama siswa", "Jumlah siswa di kelas", "Alamat rumah"],
    correctAnswerIndex: 2,
    explanation: "**Data kuantitatif** adalah data yang berupa angka dan dapat dihitung nilainya secara pasti, seperti 'Jumlah siswa di kelas', tinggi badan, atau nilai ujian."
  },
  {
    question: "Data yang diperoleh langsung dari sumbernya disebut ....",
    options: ["Data sekunder", "Data palsu", "Data primer", "Data digital"],
    correctAnswerIndex: 2,
    explanation: "**Data primer** adalah data utama yang didapatkan secara langsung dari sumber aslinya atau objek penelitiannya, misalnya lewat pengamatan langsung atau wawancara."
  },
  {
    question: "Analisis data adalah kegiatan untuk ....",
    options: ["Menghapus data yang tidak diperlukan", "Mengumpulkan dan mengolah data untuk memperoleh informasi", "Menyimpan data ke komputer", "Mengirim data melalui internet"],
    correctAnswerIndex: 1,
    explanation: "Tujuan utama **analisis data** adalah proses mengumpulkan, membersihkan, dan mengolah data mentah menjadi informasi yang sangat berguna untuk mengambil keputusan."
  },
  {
    question: "Contoh alat bantu untuk analisis data di komputer adalah ....",
    options: ["Microsoft Word", "Microsoft Excel", "Microsoft Paint", "Notepad"],
    correctAnswerIndex: 1,
    explanation: "**Microsoft Excel** adalah aplikasi lembar kerja (*spreadsheet*) yang memiliki fitur perhitungan dan rumus yang sangat cocok digunakan sebagai alat bantu analisis data."
  },
  {
    question: "Pada Microsoft Excel, perpotongan antara baris dan kolom disebut ....",
    options: ["*Worksheet*", "*Workbook*", "*Cell*", "*Range*"],
    correctAnswerIndex: 2,
    explanation: "**Cell** (Sel) adalah kotak kecil pada Excel yang merupakan perpotongan atau pertemuan antara baris (berupa angka) dan kolom (berupa huruf)."
  },
  {
    question: "Jika ingin mencari nilai rata-rata dari data pada sel B1 sampai B10, rumus yang digunakan adalah ....",
    options: ["=MEAN(B1:B10)", "=AVERAGE(B1:B10)", "=RATA(B1:B10)", "=TOTAL(B1:B10)"],
    correctAnswerIndex: 1,
    explanation: "Rumus **=AVERAGE** digunakan khusus pada aplikasi *spreadsheet* seperti Excel untuk menghitung nilai rata-rata dari sebuah kumpulan angka (*range*)."
  },
  {
    question: "Fitur pada Excel yang digunakan untuk mengurutkan data dari nilai terkecil ke terbesar adalah ....",
    options: ["*Filter*", "*Sort Ascending*", "*Wrap Text*", "*Merge Cells*"],
    correctAnswerIndex: 1,
    explanation: "***Sort Ascending*** (urutan naik) digunakan untuk mengurutkan data dari nilai terkecil ke terbesar (0 ke 9 atau A ke Z). Kebalikannya adalah ***Sort Descending***."
  },
  {
    question: "Untuk membuat grafik dari data yang sudah tersedia di Excel, langkah awal yang dilakukan adalah ...",
    options: ["Mengetik rumus", "Menghapus data", "Memblok/menyeleksi data", "Menutup *workbook*"],
    correctAnswerIndex: 2,
    explanation: "Sebelum komputer bisa mengubah angka menjadi gambar grafik (*chart*), kita wajib **menyeleksi (memblok) datanya** terlebih dahulu agar sistem tahu data mana yang akan digambar."
  },
  {
    question: "Algoritma adalah ....",
    options: ["Bahasa pemrograman", "Langkah-langkah terstruktur untuk menyelesaikan masalah", "Perangkat keras komputer", "Jaringan internet"],
    correctAnswerIndex: 1,
    explanation: "**Algoritma** secara sederhana adalah urutan atau langkah-langkah yang logis, berurutan, dan terstruktur yang disusun untuk menyelesaikan suatu masalah tertentu."
  },
  {
    question: "Urutan langkah yang benar dalam pemrograman adalah ....",
    options: ["Program - Algoritma - Masalah", "Masalah - Algoritma - Program", "Algoritma - Masalah - Program", "Program - Masalah - Algoritma"],
    correctAnswerIndex: 1,
    explanation: "Siklus pemrograman dimulai dari adanya '**Masalah**', kemudian mencari jalan keluarnya dengan menyusun '**Algoritma**', barulah ditulis kodenya menjadi sebuah '**Program**'."
  },
  {
    question: "Contoh kegiatan sehari-hari yang menggunakan algoritma adalah ....",
    options: ["Bermain tanpa aturan", "Memasak mengikuti resep", "Tidur", "Menonton televisi"],
    correctAnswerIndex: 1,
    explanation: "Memasak mengikuti **resep** adalah bentuk algoritma di kehidupan sehari-hari karena ada bahan baku (*input*), urutan proses (langkah memasak), dan hasil akhirnya (*output* masakan)."
  },
  {
    question: "*Pseudocode* adalah ....",
    options: ["Bahasa pemrograman resmi", "Penulisan algoritma dengan bahasa sederhana", "Program jadi", "Perangkat keras"],
    correctAnswerIndex: 1,
    explanation: "**Pseudocode** berasal dari kata *pseudo* (semu) dan *code* (kode). Ini adalah cara menuliskan algoritma yang menyerupai bahasa pemrograman namun menggunakan bahasa manusia agar mudah dibaca."
  },
  {
    question: "Simbol *flowchart* untuk proses adalah ....",
    options: ["Persegi panjang", "Oval", "Lingkaran", "Segitiga"],
    correctAnswerIndex: 0,
    explanation: "Simbol berbentuk **persegi panjang** pada diagram alir (*flowchart*) menandakan adanya sebuah **proses**, perhitungan, atau pengolahan data oleh komputer."
  },
  {
    question: "Penyalahgunaan HP (*Handphone*) untuk melakukan kecurangan/mencontek ketika ujian adalah salah satu contoh dampak negatif perkembangan teknologi dalam bidang ....",
    options: ["Pendidikan", "Sosial Budaya", "Pemerintahan", "Perekonomian"],
    correctAnswerIndex: 0,
    explanation: "Tindakan **mencontek saat ujian** terjadi di lingkungan sekolah, sehingga ini merupakan dampak negatif teknologi yang merugikan dunia **Pendidikan** karena merusak kejujuran akademik siswa."
  },
  {
    question: "Berikut ini yang bukan merupakan peranan TIK dalam bidang ekonomi adalah ...",
    options: ["Meningkatkan pertumbuhan ekonomi", "Menciptakan lapangan kerja baru", "Efisiensi dan efektifitas kerja", "Alat bantu mengajar para guru"],
    correctAnswerIndex: 3,
    explanation: "Alat bantu mengajar para guru adalah peranan TIK dalam bidang **Pendidikan**, bukan bidang **Ekonomi**. Tiga pilihan lainnya (pertumbuhan ekonomi, lapangan kerja, dan efisiensi kerja) adalah contoh di bidang ekonomi/bisnis."
  },
  {
    question: "Berikut ini yang merupakan contoh penerapan praktik lintas bidang dalam kehidupan sehari-hari (*smart city*) adalah ....",
    options: ["Membuat resep masakan", "Penggunaan sensor lalu lintas untuk mengatur lampu merah secara otomatis", "Bermain game online", "Menulis buku harian"],
    correctAnswerIndex: 1,
    explanation: "***Smart City*** (kota pintar) memanfaatkan teknologi untuk mengelola kota dengan lebih baik. Contohnya adalah penggunaan sensor pintar untuk mengatur lampu merah secara otomatis agar mengurangi kemacetan."
  },
  {
    question: "Muatan ilegal yang berupa data atau informasi tidak benar atau tidak sesuai dengan norma yang dimasukkan oleh pelaku kejahatan siber disebut dengan istilah ....",
    options: ["*Defacing*", "*Illegal Contents*", "Sabotase", "*Unauthorized access*"],
    correctAnswerIndex: 1,
    explanation: "***Illegal Contents*** (konten ilegal) adalah kejahatan siber yang dilakukan dengan cara memasukkan data, informasi, atau berita *hoax* yang tidak benar dan melanggar hukum ke dalam internet."
  },
  {
    question: "Kejahatan terkait penggunaan kartu kredit milik orang lain untuk kepentingan pribadi atau kelompok pelaku *cybercrime* disebut ....",
    options: ["*Phising*", "*Spamming*", "*Carding*", "*Defacing*"],
    correctAnswerIndex: 2,
    explanation: "**Carding** adalah jenis kejahatan dunia maya (*cybercrime*) di mana pelakunya mencuri dan menggunakan data kartu kredit (*credit card*) orang lain untuk berbelanja secara ilegal."
  }
];

// ============================================================
//  CATATAN TAMBAHAN:
//  - Untuk menambah soal baru di atas, pastikan menambahkan koma (,) 
//    di akhir objek sebelum soal baru tersebut.
// ============================================================
