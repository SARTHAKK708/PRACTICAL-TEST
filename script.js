/**
 * ============================================================================
 * AI Study Assistant - Main JavaScript (Vanilla ES6+)
 * Web Technology Assignment 5 (20 Marks)
 * ============================================================================
 * 
 * Features & Architecture:
 * 1. State Management & LocalStorage Persistence (API Key, Theme, History)
 * 2. Asynchronous API Integration (Fetch API + async/await with Gemini Flash)
 * 3. Dynamic JSON Validation & Error Handling (HTTP 401, 429, 500, Network)
 * 4. Interactive UI: 3D Flip Flashcards, Real-time Quiz Scoring, Copy/Download
 * 5. Beginner-friendly, well-commented functions for College Viva
 * ============================================================================
 */

// Strict mode ensures cleaner code and prevents silent bugs
'use strict';

/* --------------------------------------------------------------------------
   1. CONSTANTS & LOCAL STORAGE KEYS
   -------------------------------------------------------------------------- */
const STORAGE_KEYS = {
  API_KEY: 'study_ai_gemini_key',
  THEME: 'study_ai_theme',
  HISTORY: 'study_ai_history'
};

// Default Gemini API Model & Base Endpoint
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/* --------------------------------------------------------------------------
   2. APPLICATION STATE
   -------------------------------------------------------------------------- */
const AppState = {
  apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]'),
  currentStudyKit: null,      // Holds active generation { topic, summary, quiz, flashcards, timestamp, ... }
  quizAnswers: {},            // Tracks selected answers: { [questionIndex]: selectedOptionIndex }
  activeFlashcardIndex: 0,    // Tracks current flashcard in carousel mode
  isGenerating: false         // Prevents duplicate concurrent requests
};

/* --------------------------------------------------------------------------
   3. SAMPLE DEMO DATA (For Evaluator & Viva Demo without needing an API Key)
   -------------------------------------------------------------------------- */
const SAMPLE_STUDY_KITS = {
  os: {
    topic: "Operating Systems: CPU Scheduling Algorithms",
    style: "Exam-focused",
    difficulty: "Medium",
    summary: `### CPU Scheduling Algorithms Overview
CPU scheduling is the process by which the operating system decides which process in the ready queue is allocated CPU execution time.

#### 1. Key Performance Metrics
* **Turnaround Time:** Total time taken from process submission to completion.
* **Waiting Time:** Sum of periods spent waiting in the ready queue.
* **Response Time:** Time from submission until the very first response is produced.
* **Throughput:** Number of processes completed per unit time.

#### 2. Major Scheduling Algorithms
* **FCFS (First-Come, First-Served):** Non-preemptive, simple FIFO queue. Suffers from the *Convoy Effect* where short processes wait for long ones.
* **SJF (Shortest Job First):** Optimal for minimizing average waiting time. Can be preemptive (SRTF - Shortest Remaining Time First) or non-preemptive. Suffers from process starvation.
* **Round Robin (RR):** Preemptive algorithm designed for time-sharing systems. Each process gets a small fixed slice of CPU time (time quantum).
* **Priority Scheduling:** CPU allocated based on priority rank; starvation prevented via aging.`,
    quiz: [
      {
        question: "Which CPU scheduling algorithm is mathematically proven to achieve the minimal average waiting time?",
        options: [
          "First-Come, First-Served (FCFS)",
          "Shortest Job First (SJF)",
          "Round Robin (RR)",
          "Priority Scheduling"
        ],
        correctIndex: 1,
        explanation: "Shortest Job First (SJF) is provably optimal because scheduling shorter jobs first minimizes cumulative queuing delay for subsequent processes."
      },
      {
        question: "What major performance problem is most commonly associated with FCFS scheduling?",
        options: [
          "Thrashing",
          "Convoy Effect",
          "Race Condition",
          "Deadlock"
        ],
        correctIndex: 1,
        explanation: "The Convoy Effect occurs in FCFS when multiple I/O-bound processes wait behind a single CPU-heavy long process, severely degrading throughput."
      },
      {
        question: "In Round Robin scheduling, what happens if the time quantum is chosen to be extremely large?",
        options: [
          "It degenerates into First-Come, First-Served (FCFS)",
          "Context switching overhead increases significantly",
          "Processes will suffer immediate starvation",
          "Average waiting time automatically drops to zero"
        ],
        correctIndex: 0,
        explanation: "When the time quantum is larger than the longest burst time, no process is preempted early, meaning Round Robin behaves exactly like FCFS."
      },
      {
        question: "Which technique is utilized to prevent starvation of low-priority processes in priority scheduling?",
        options: [
          "Paging",
          "Aging",
          "Caching",
          "Compaction"
        ],
        correctIndex: 1,
        explanation: "Aging gradually increases the priority of processes that wait in the system for extended periods, guaranteeing they will eventually execute."
      },
      {
        question: "What is the primary difference between preemptive and non-preemptive scheduling?",
        options: [
          "Preemptive requires more virtual memory than non-preemptive",
          "Preemptive allows interrupting a currently running process; non-preemptive lets it finish its burst",
          "Non-preemptive scheduling cannot run on multi-core architectures",
          "Preemptive scheduling ignores process priority entirely"
        ],
        correctIndex: 1,
        explanation: "In preemptive scheduling, the OS kernel can interrupt and switch away from an active process when a higher-priority or new process arrives."
      }
    ],
    flashcards: [
      {
        front: "What is Turnaround Time in CPU Scheduling?",
        back: "The total elapsed time from when a process is submitted to when it completes execution (Completion Time - Arrival Time)."
      },
      {
        front: "What is the Convoy Effect?",
        back: "A phenomenon in FCFS where short CPU processes queue up behind a very long CPU burst process, causing severe delays."
      },
      {
        front: "How does Round Robin (RR) scheduling work?",
        back: "It allocates a fixed CPU time slice called a 'time quantum' to each ready process in cyclic order using preemption."
      },
      {
        front: "What is Aging in Operating Systems?",
        back: "A technique that gradually elevates the priority of long-waiting jobs to avoid starvation in priority-based scheduling."
      },
      {
        front: "What is a Context Switch?",
        back: "The process of saving the execution state of the active process and restoring the state of the next scheduled process."
      }
    ]
  },
  dbms: {
    topic: "DBMS: Database Normalization (1NF to BCNF)",
    style: "Exam-focused",
    difficulty: "Medium",
    summary: `### Database Normalization Overview
Normalization is the systematic approach of decomposing database tables to eliminate data redundancy and prevent insertion, update, and deletion anomalies.

#### Normal Forms Hierarchy
1. **1NF (First Normal Form):** Each attribute contains only atomic (indivisible) values; no repeating groups.
2. **2NF (Second Normal Form):** Must be in 1NF and have NO partial dependency (no non-prime attribute depends on a proper subset of candidate key).
3. **3NF (Third Normal Form):** Must be in 2NF and have NO transitive dependency ($X \\rightarrow Y$, where neither is candidate key).
4. **BCNF (Boyce-Codd Normal Form):** A stricter version of 3NF where for every functional dependency $X \\rightarrow Y$, $X$ MUST be a super key.`,
    quiz: [
      {
        question: "A relation is in First Normal Form (1NF) if and only if:",
        options: [
          "Every determinant is a candidate key",
          "All column values are atomic and indivisible",
          "No transitive dependencies exist",
          "Foreign keys match primary keys exactly"
        ],
        correctIndex: 1,
        explanation: "1NF mandates atomicity—meaning every attribute contains only single, indivisible scalar values, with no arrays or multi-valued lists."
      },
      {
        question: "To achieve Second Normal Form (2NF), a relation must be in 1NF and eliminate:",
        options: [
          "Partial dependencies",
          "Transitive dependencies",
          "Join dependencies",
          "Multivalued dependencies"
        ],
        correctIndex: 0,
        explanation: "2NF requires that no non-prime attribute depends on a part of a composite candidate key (partial functional dependency)."
      },
      {
        question: "What type of dependency is specifically prohibited in Third Normal Form (3NF)?",
        options: [
          "Trivial functional dependency",
          "Transitive dependency",
          "Foreign key dependency",
          "Recursive dependency"
        ],
        correctIndex: 1,
        explanation: "3NF forbids transitive dependencies ($A \\rightarrow B$ and $B \\rightarrow C$, leading to $A \\rightarrow C$ between non-prime attributes)."
      },
      {
        question: "How does BCNF differ from standard 3NF?",
        options: [
          "BCNF allows multi-valued attributes",
          "For every functional dependency X -> Y, X must strictly be a super key in BCNF",
          "BCNF only applies to single-column primary keys",
          "BCNF eliminates all foreign keys from the schema"
        ],
        correctIndex: 1,
        explanation: "BCNF is stronger than 3NF: every left-hand side determinant $X$ of any non-trivial functional dependency must be a super key."
      },
      {
        question: "What is the primary trade-off of normalizing relations to higher normal forms?",
        options: [
          "Increased risk of data loss",
          "More tables requiring additional JOIN operations during queries",
          "Inability to create indexes",
          "Failure to enforce referential integrity"
        ],
        correctIndex: 1,
        explanation: "Higher normal forms break tables down into multiple smaller relations, requiring computationally heavier JOIN queries to assemble full records."
      }
    ],
    flashcards: [
      {
        front: "What is an Update Anomaly?",
        back: "An inconsistency caused by redundant data where modifying a value in one row leaves contradictory values in other rows."
      },
      {
        front: "Define 1NF (First Normal Form)",
        back: "A relation where all column attributes are atomic (no repeating sets, lists, or multiple composite values)."
      },
      {
        front: "What is Partial Dependency?",
        back: "When a non-key attribute depends on only a portion of a composite candidate key rather than the entire composite key."
      },
      {
        front: "What is Transitive Dependency?",
        back: "An indirect relationship causing functional dependency, such as if A -> B and B -> C, then non-key A transitively determines C."
      },
      {
        front: "What is BCNF?",
        back: "Boyce-Codd Normal Form: A strict normal form where for every functional dependency X -> Y, determinant X must be a super key."
      }
    ]
  },
  web: {
    topic: "Web Tech: HTTP vs HTTPS & SSL/TLS Handshake",
    style: "Exam-focused",
    difficulty: "Medium",
    summary: `### HTTP vs HTTPS & SSL/TLS Handshake
HTTP (Hypertext Transfer Protocol) is an application layer protocol for data transmission. HTTPS is HTTP secured by Transport Layer Security (TLS).

#### 1. Fundamental Differences
* **Port:** HTTP operates on port 80; HTTPS defaults to port 443.
* **Security Triad:** HTTPS guarantees **Confidentiality** (encryption), **Integrity** (message authentication codes), and **Authentication** (digital certificates).
* **Speed:** HTTPS requires an initial TLS handshake overhead, though modern HTTP/2 and HTTP/3 offset latency.

#### 2. The TLS 1.3 Handshake Steps
1. **Client Hello:** Client sends supported cipher suites and key share parameters.
2. **Server Hello & Certificate:** Server selects cipher suite, provides TLS certificate, and establishes shared symmetric key via Diffie-Hellman.
3. **Encrypted Handshake:** Session finishes with authenticated encryption; client and server communicate via fast symmetric AES-GCM or ChaCha20.`,
    quiz: [
      {
        question: "On which default TCP port does HTTPS operate?",
        options: ["Port 21", "Port 80", "Port 443", "Port 8080"],
        correctIndex: 2,
        explanation: "Standard unsecured HTTP uses TCP port 80, whereas encrypted HTTPS operates by default on TCP port 443."
      },
      {
        question: "What type of encryption is used for actual payload data transfer AFTER the TLS handshake completes?",
        options: [
          "Asymmetric encryption (e.g., RSA)",
          "Symmetric encryption (e.g., AES-GCM)",
          "Hashing algorithms (e.g., MD5)",
          "Unencrypted plain text"
        ],
        correctIndex: 1,
        explanation: "Asymmetric cryptography is only used during the handshake to negotiate keys; fast, hardware-accelerated symmetric encryption is used for bulk data transfer."
      },
      {
        question: "Which cryptographic entity issues and verifies digital certificates for web servers?",
        options: [
          "Internet Assigned Numbers Authority (IANA)",
          "Certificate Authority (CA)",
          "Domain Name Registrar (DNS)",
          "Internet Engineering Task Force (IETF)"
        ],
        correctIndex: 1,
        explanation: "Certificate Authorities (CAs) like Let's Encrypt or DigiCert cryptographically sign server certificates to guarantee domain identity."
      },
      {
        question: "What is the primary role of a Message Authentication Code (MAC) in TLS?",
        options: [
          "To speed up DNS resolution",
          "To guarantee data integrity against tampering in transit",
          "To compress images automatically",
          "To store user cookies securely on the client"
        ],
        correctIndex: 1,
        explanation: "MACs ensure data integrity by confirming that transmitted packets have not been intercepted, modified, or replayed by an attacker."
      },
      {
        question: "Why does TLS 1.3 perform faster than older TLS 1.2 handshakes?",
        options: [
          "It completely skips certificate verification",
          "It reduces the handshake round trips from 2-RTT down to 1-RTT (or 0-RTT for resumed sessions)",
          "It operates over unencrypted UDP without error checks",
          "It disables client-side caching"
        ],
        correctIndex: 1,
        explanation: "TLS 1.3 streamlines cryptographic negotiation, eliminating unnecessary round trips and reducing handshake latency from 2 round trips to 1 (or 0 with 0-RTT)."
      }
    ],
    flashcards: [
      {
        front: "What is the main difference between HTTP and HTTPS?",
        back: "HTTP transfers plaintext data over port 80; HTTPS encrypts traffic using TLS/SSL over port 443 to ensure privacy and integrity."
      },
      {
        front: "Why is symmetric encryption preferred over asymmetric for bulk data transfer?",
        back: "Symmetric encryption (e.g., AES) is computationally vastly faster and less resource-heavy than asymmetric algorithms like RSA."
      },
      {
        front: "What is a Certificate Authority (CA)?",
        back: "A trusted third-party organization that cryptographically signs and validates public key certificates for websites."
      },
      {
        front: "What is 1-RTT in TLS 1.3?",
        back: "One Round Trip Time: the client and server complete cipher selection and key exchange in a single network round-trip."
      },
      {
        front: "What does the 'S' in HTTPS stand for?",
        back: "'Secure' — indicating that HTTP traffic is tunnelled through an encrypted TLS/SSL layer."
      }
    ]
  },
  ml: {
    topic: "AI/ML: Supervised vs Unsupervised Learning",
    style: "Exam-focused",
    difficulty: "Medium",
    summary: `### Machine Learning Paradigms
Machine Learning algorithms are broadly classified based on the nature of feedback and supervision available during training.

#### 1. Supervised Learning
* **Input:** Model is trained on labeled dataset $(X, Y)$.
* **Goal:** Learn mapping function $f(X) \\rightarrow Y$ to accurately predict outcomes for unseen inputs.
* **Subtypes:**
  * **Classification:** Discrete output categories (e.g., Spam vs Not Spam, Decision Trees, SVM).
  * **Regression:** Continuous numerical values (e.g., House Price prediction, Linear Regression).

#### 2. Unsupervised Learning
* **Input:** Model receives unlabeled raw data $(X)$ with no ground-truth answers.
* **Goal:** Discover latent structures, clusters, or distributions within data.
* **Subtypes:**
  * **Clustering:** Grouping similar datapoints (e.g., K-Means, DBSCAN).
  * **Dimensionality Reduction:** Compressing features while retaining variance (e.g., PCA, t-SNE).`,
    quiz: [
      {
        question: "Which of the following problems is an example of Supervised Classification?",
        options: [
          "Customer market basket clustering",
          "Email spam detection (Spam or Ham)",
          "Stock price forecasting in currency units",
          "Compressing images using PCA"
        ],
        correctIndex: 1,
        explanation: "Email spam detection categorizes data into discrete classes (Spam vs Ham) using historical labeled training emails."
      },
      {
        question: "Predicting the continuous market selling price of a house based on square footage is:",
        options: [
          "Unsupervised Clustering",
          "Supervised Regression",
          "Reinforcement Learning",
          "Dimensionality Reduction"
        ],
        correctIndex: 1,
        explanation: "When predicting continuous numerical values from labeled features, the task is a supervised regression problem."
      },
      {
        question: "Which algorithm is fundamentally an UNSUPERVISED learning method?",
        options: [
          "Random Forest Classifier",
          "K-Means Clustering",
          "Logistic Regression",
          "Support Vector Machines (SVM)"
        ],
        correctIndex: 1,
        explanation: "K-Means groups unlabeled observations into $k$ clusters based on geometric distance without requiring pre-assigned labels."
      },
      {
        question: "What is the primary function of Principal Component Analysis (PCA)?",
        options: [
          "To label unlabelled images",
          "To reduce feature dimensionality while preserving maximum data variance",
          "To increase computational training time",
          "To act as a loss function for neural networks"
        ],
        correctIndex: 1,
        explanation: "PCA projects high-dimensional data onto orthogonal principal components, compressing feature count while minimizing loss of variance."
      },
      {
        question: "What is the core distinction in training data between supervised and unsupervised learning?",
        options: [
          "Supervised requires a GPU; unsupervised runs on CPU only",
          "Supervised data contains input features paired with target labels; unsupervised data has no target labels",
          "Unsupervised datasets must always be stored in SQL databases",
          "Supervised models cannot suffer from overfitting"
        ],
        correctIndex: 1,
        explanation: "Supervised learning relies on ground-truth target labels $(Y)$, whereas unsupervised learning detects patterns in unlabeled input $(X)$."
      }
    ],
    flashcards: [
      {
        front: "What is Supervised Learning?",
        back: "A machine learning paradigm where the algorithm trains on paired input features and known ground-truth output labels."
      },
      {
        front: "What is the difference between Classification and Regression?",
        back: "Classification predicts discrete categorical outputs (e.g. Cat/Dog); regression predicts continuous numerical numbers (e.g. \$250,000)."
      },
      {
        front: "What is Unsupervised Learning?",
        back: "Training algorithms on unlabeled datasets to uncover hidden patterns, groupings, or dimensionality reductions without explicit guidance."
      },
      {
        front: "Name two common Unsupervised Learning tasks.",
        back: "Clustering (e.g., K-Means, Hierarchical) and Dimensionality Reduction (e.g., PCA, t-SNE)."
      },
      {
        front: "What is Overfitting in Machine Learning?",
        back: "When a model learns the training noise so closely that it performs exceptionally on training data but poorly on unseen test data."
      }
    ]
  }
};

/* --------------------------------------------------------------------------
   4. DOM ELEMENT REFERENCES
   -------------------------------------------------------------------------- */
const DOM = {
  // Sidebar & Navigation
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
  hamburgerBtn: document.getElementById('hamburgerBtn'),
  navButtons: document.querySelectorAll('.nav-item'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  currentViewTitle: document.getElementById('currentViewTitle'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  themeText: document.getElementById('themeText'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  sidebarKeyDot: document.getElementById('sidebarKeyDot'),
  sidebarKeyStatusPill: document.getElementById('sidebarKeyStatusPill'),

  // Header quick buttons
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  quickApiKeyBtn: document.getElementById('quickApiKeyBtn'),
  quickApiKeyIcon: document.getElementById('quickApiKeyIcon'),

  // Alert Banner & Toasts
  globalAlert: document.getElementById('globalAlert'),
  alertIcon: document.getElementById('alertIcon'),
  alertTitle: document.getElementById('alertTitle'),
  alertMessage: document.getElementById('alertMessage'),
  alertCloseBtn: document.getElementById('alertCloseBtn'),
  toastContainer: document.getElementById('toastContainer'),

  // Study Generator Inputs
  sampleTopicSelect: document.getElementById('sampleTopicSelect'),
  notesInput: document.getElementById('notesInput'),
  charCount: document.getElementById('charCount'),
  answerStyleSelect: document.getElementById('answerStyleSelect'),
  quizDifficultySelect: document.getElementById('quizDifficultySelect'),
  geminiModelSelect: document.getElementById('geminiModelSelect'),
  clearInputBtn: document.getElementById('clearInputBtn'),
  generateBtn: document.getElementById('generateBtn'),
  generateBtnSpinner: document.getElementById('generateBtnSpinner'),
  generateBtnIcon: document.getElementById('generateBtnIcon'),
  generateBtnText: document.getElementById('generateBtnText'),

  // Loading State
  loadingState: document.getElementById('loadingState'),
  loadingSubtitle: document.getElementById('loadingSubtitle'),

  // Output Dashboard
  outputContainer: document.getElementById('outputContainer'),
  outputTopicTitle: document.getElementById('outputTopicTitle'),
  outputStyleTag: document.getElementById('outputStyleTag'),
  outputDifficultyTag: document.getElementById('outputDifficultyTag'),
  outputTimeTag: document.getElementById('outputTimeTag'),

  // Sub-tabs (Summary, Quiz, Flashcards)
  pillButtons: document.querySelectorAll('.pill-btn'),
  subtabContents: document.querySelectorAll('.subtab-content'),
  quizScoreBadge: document.getElementById('quizScoreBadge'),
  flashcardCountBadge: document.getElementById('flashcardCountBadge'),

  // Summary Elements
  summaryContent: document.getElementById('summaryContent'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  copySummaryIcon: document.getElementById('copySummaryIcon'),
  copySummaryText: document.getElementById('copySummaryText'),
  downloadSummaryBtn: document.getElementById('downloadSummaryBtn'),

  // Quiz Elements
  quizList: document.getElementById('quizList'),
  liveScoreNum: document.getElementById('liveScoreNum'),
  resetQuizBtn: document.getElementById('resetQuizBtn'),
  quizSummaryBox: document.getElementById('quizSummaryBox'),
  scoreCircle: document.getElementById('scoreCircle'),
  scoreTitle: document.getElementById('scoreTitle'),
  scoreSubtitle: document.getElementById('scoreSubtitle'),

  // Flashcard Elements
  activeSingleCardWrapper: document.getElementById('activeSingleCardWrapper'),
  flashcardCarouselView: document.getElementById('flashcardCarouselView'),
  flashcardGridView: document.getElementById('flashcardGridView'),
  viewModeCarouselBtn: document.getElementById('viewModeCarouselBtn'),
  viewModeGridBtn: document.getElementById('viewModeGridBtn'),
  fcPrevBtn: document.getElementById('fcPrevBtn'),
  fcNextBtn: document.getElementById('fcNextBtn'),
  fcCurrentIndex: document.getElementById('fcCurrentIndex'),
  fcTotalCards: document.getElementById('fcTotalCards'),
  fcFlipActiveBtn: document.getElementById('fcFlipActiveBtn'),

  // History Elements
  historyList: document.getElementById('historyList'),
  historyEmptyState: document.getElementById('historyEmptyState'),
  clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
  historyGoGenerateBtn: document.getElementById('historyGoGenerateBtn'),

  // Settings Elements
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  testApiKeyBtn: document.getElementById('testApiKeyBtn'),
  testKeySpinner: document.getElementById('testKeySpinner'),
  removeApiKeyBtn: document.getElementById('removeApiKeyBtn'),
  settingsKeyBadge: document.getElementById('settingsKeyBadge')
};

/* --------------------------------------------------------------------------
   5. INITIALIZATION
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme from localStorage
  applyTheme(AppState.theme);

  // 2. Initialize API Key indicator & form value
  updateApiKeyStatusUI();

  // 3. Initialize History List & Count
  renderHistoryList();

  // 4. Attach all Event Listeners
  setupEventListeners();

  // 5. Update character counter for empty initial input
  updateCharCounter();
});

/* --------------------------------------------------------------------------
   6. THEME MANAGEMENT (Dark / Light Mode)
   -------------------------------------------------------------------------- */
/**
 * Applies the given theme ('dark' | 'light') to the document and updates UI.
 * @param {string} theme - 'dark' or 'light'
 */
function applyTheme(theme) {
  AppState.theme = theme;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  document.body.setAttribute('data-theme', theme);

  if (theme === 'light') {
    DOM.themeIcon.textContent = '☀️';
    DOM.themeText.textContent = 'Light Mode';
  } else {
    DOM.themeIcon.textContent = '🌙';
    DOM.themeText.textContent = 'Dark Mode';
  }
}

/**
 * Toggles theme between dark and light modes.
 */
function toggleTheme() {
  const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  showToast(`Switched to ${newTheme} mode`);
}

/* --------------------------------------------------------------------------
   7. NAVIGATION & TAB SWITCHING
   -------------------------------------------------------------------------- */
/**
 * Switches the active main tab pane (generator, history, settings, viva).
 * @param {string} targetTabId - The data-tab value
 */
function switchTab(targetTabId) {
  DOM.navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === targetTabId);
  });

  DOM.tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${targetTabId}`);
  });

  // Update Breadcrumb
  const titles = {
    generator: 'Create Study Set',
    history: 'Saved History',
    settings: 'API Configuration',
    viva: 'Viva Questions & Answers'
  };
  DOM.currentViewTitle.textContent = titles[targetTabId] || 'Dashboard';

  // Close mobile sidebar if open
  closeMobileSidebar();
}

/**
 * Switches sub-tabs inside the Output Container (Summary, Quiz, Flashcards).
 * @param {string} targetSubtab - 'summary' | 'quiz' | 'flashcards'
 */
function switchSubtab(targetSubtab) {
  DOM.pillButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subtab === targetSubtab);
  });

  DOM.subtabContents.forEach(content => {
    content.classList.toggle('active', content.id === `subtab-${targetSubtab}`);
  });
}

function openMobileSidebar() {
  DOM.sidebar.classList.add('open');
  DOM.sidebarBackdrop.classList.add('show');
}

function closeMobileSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.sidebarBackdrop.classList.remove('show');
}

/* --------------------------------------------------------------------------
   8. API KEY MANAGEMENT & SETTINGS
   -------------------------------------------------------------------------- */
/**
 * Updates all visual key status indicators across the app.
 */
function updateApiKeyStatusUI() {
  const hasKey = Boolean(AppState.apiKey && AppState.apiKey.trim().length > 10);
  DOM.apiKeyInput.value = AppState.apiKey || '';

  // Sidebar Status Dot
  DOM.sidebarKeyDot.classList.toggle('configured', hasKey);

  // Sidebar Status Pill
  if (hasKey) {
    DOM.sidebarKeyStatusPill.innerHTML = `
      <span class="dot configured"></span>
      <span class="status-text">Gemini Key Active</span>
    `;
    DOM.quickApiKeyIcon.textContent = '🔑';
  } else {
    DOM.sidebarKeyStatusPill.innerHTML = `
      <span class="dot unconfigured"></span>
      <span class="status-text">No API Key Set</span>
    `;
    DOM.quickApiKeyIcon.textContent = '⚠️';
  }

  // Settings Badge
  if (hasKey) {
    DOM.settingsKeyBadge.innerHTML = `
      <span class="badge-dot dot-green"></span>
      <span class="badge-label">Key Saved</span>
    `;
  } else {
    DOM.settingsKeyBadge.innerHTML = `
      <span class="badge-dot dot-red"></span>
      <span class="badge-label">Key Missing</span>
    `;
  }
}

/**
 * Saves the API key to localStorage and updates state.
 */
function handleSaveApiKey() {
  const enteredKey = DOM.apiKeyInput.value.trim();
  if (!enteredKey) {
    showAlert('Missing Input', 'Please enter a valid Gemini API key before saving.', 'error');
    return;
  }

  AppState.apiKey = enteredKey;
  localStorage.setItem(STORAGE_KEYS.API_KEY, enteredKey);
  updateApiKeyStatusUI();
  hideAlert();
  showToast('Gemini API key saved securely to localStorage!');
}

/**
 * Removes the API key from localStorage.
 */
function handleRemoveApiKey() {
  if (!confirm('Are you sure you want to remove your saved Gemini API key?')) {
    return;
  }
  AppState.apiKey = '';
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  DOM.apiKeyInput.value = '';
  updateApiKeyStatusUI();
  showToast('API key removed from localStorage');
}

/**
 * Tests the provided API key with a fast, minimal verification query to Gemini.
 */
async function handleTestApiKey() {
  const keyToTest = DOM.apiKeyInput.value.trim() || AppState.apiKey;
  if (!keyToTest) {
    showAlert('Missing API Key', 'Please enter your Gemini API key first.', 'error');
    return;
  }

  DOM.testKeySpinner.classList.remove('hidden');
  DOM.testApiKeyBtn.disabled = true;

  try {
    const model = DOM.geminiModelSelect.value || DEFAULT_GEMINI_MODEL;
    const testUrl = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(keyToTest)}`;
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with the single word: READY' }] }]
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`HTTP ${response.status}: Invalid API Key or Unauthorized. Please verify the key at Google AI Studio.`);
      } else if (response.status === 429) {
        throw new Error(`HTTP 429: API Rate limit or quota exceeded. Please wait a minute before retrying.`);
      } else {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      showAlert('API Key Verified!', 'Successfully connected to Google Gemini Flash API. Your key is fully functional!', 'success');
      showToast('Key verified successfully!');
      // Also save if valid
      AppState.apiKey = keyToTest;
      localStorage.setItem(STORAGE_KEYS.API_KEY, keyToTest);
      updateApiKeyStatusUI();
    } else {
      throw new Error('Received unexpected empty response structure from Gemini API.');
    }
  } catch (err) {
    showAlert('API Test Failed', err.message, 'error');
  } finally {
    DOM.testKeySpinner.classList.add('hidden');
    DOM.testApiKeyBtn.disabled = false;
  }
}

/**
 * Toggles visibility of the API Key password field.
 */
function toggleKeyVisibility() {
  const isPassword = DOM.apiKeyInput.type === 'password';
  DOM.apiKeyInput.type = isPassword ? 'text' : 'password';
  DOM.toggleKeyVisibilityBtn.textContent = isPassword ? '🙈' : '👁️';
}

/* --------------------------------------------------------------------------
   9. PROMPT ENGINEERING FUNCTION
   -------------------------------------------------------------------------- */
/**
 * Crafts a precise prompt instructing Gemini Flash to return strictly structured JSON.
 * @param {string} userNotes - Study notes or subject topic input by user
 * @param {string} answerStyle - 'simple' | 'exam' | 'detailed'
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {string} - Formatted system and instruction prompt
 */
function buildStudyPrompt(userNotes, answerStyle, difficulty) {
  const styleInstructions = {
    simple: "Write the summary in plain, easy-to-understand language for a complete beginner. Avoid overly complex jargon.",
    exam: "Write an exam-oriented summary structured with clear Markdown headings (###), bullet points, key definitions, formulas (if any), and core takeaways that maximize marks.",
    detailed: "Write an in-depth, comprehensive summary covering theoretical background, step-by-step principles, and practical examples."
  };

  const difficultyInstructions = {
    easy: "Create straightforward recall questions covering primary definitions and foundational concepts.",
    medium: "Create application and conceptual questions that test understanding and distinguish between related ideas.",
    hard: "Create analytical, challenging questions with plausible distractor choices that test edge cases and deep comprehension."
  };

  return `You are an expert academic tutor and study assistant.
Based on the following study notes / topic, create a complete study kit.

STUDY MATERIAL:
"""
${userNotes.trim()}
"""

CONFIGURATION:
- Answer Style: ${answerStyle.toUpperCase()} (${styleInstructions[answerStyle] || styleInstructions.exam})
- Quiz Difficulty: ${difficulty.toUpperCase()} (${difficultyInstructions[difficulty] || difficultyInstructions.medium})

OUTPUT REQUIREMENTS:
You MUST respond with a SINGLE, VALID JSON object ONLY, with no extra text or explanations.
Follow this exact JSON schema:
{
  "topic": "Concise 3-7 word subject title",
  "summary": "Full Markdown formatted summary following the requested style",
  "quiz": [
    {
      "question": "Question text here?",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correctIndex": 0,
      "explanation": "Clear explanation of why this option is correct."
    }
  ],
  "flashcards": [
    {
      "front": "Key concept, question, or term?",
      "back": "Clear, concise definition or answer."
    }
  ]
}

STRICT CONSTRAINTS:
1. "quiz" MUST contain EXACTLY 5 multiple-choice questions.
2. Each quiz item MUST have EXACTLY 4 options and an integer "correctIndex" between 0 and 3 indicating the zero-based index of the correct answer.
3. "flashcards" MUST contain between 5 and 7 high-yield study cards.
4. "summary" MUST use clean Markdown formatting (### headings, bullet points, bold keywords).
5. Output MUST be 100% valid JSON parseable by JSON.parse(). Do NOT wrap with backticks if using JSON mode.`;
}

/* --------------------------------------------------------------------------
   10. API REQUEST & RESPONSE VALIDATION (Fetch + async/await)
   -------------------------------------------------------------------------- */
/**
 * Calls the official Google Gemini Flash API via POST fetch() and returns the response.
 * @param {string} prompt - The structured prompt
 * @param {string} apiKey - Gemini API Key
 * @param {string} model - Selected model identifier
 * @returns {Promise<Object>} - Decoded JSON result from Gemini
 */
async function callGeminiApi(prompt, apiKey, model = DEFAULT_GEMINI_MODEL) {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });
  } catch (networkError) {
    // Network failure (offline, DNS failure, CORS blocked, etc.)
    throw new Error('Network Connection Error: Unable to reach Google Gemini servers. Please check your internet connection.');
  }

  // Handle specific HTTP Status Codes cleanly
  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson?.error?.message || response.statusText;
    } catch (_) {
      errorDetail = response.statusText;
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication Error (HTTP ${response.status}): Your Gemini API key is invalid or unauthorized. Please verify your key in Settings.`);
    } else if (response.status === 429) {
      throw new Error(`Rate Limit Exceeded (HTTP 429): Free tier quota reached. Please wait 60 seconds before making another request.`);
    } else if (response.status >= 500) {
      throw new Error(`Google Server Error (HTTP ${response.status}): Gemini servers are momentarily overloaded. Please try again in a few moments.`);
    } else {
      throw new Error(`API Error (HTTP ${response.status}): ${errorDetail}`);
    }
  }

  const result = await response.json();

  // Extract text candidate from Gemini response structure
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response received from Gemini API. Please rephrase your topic and retry.');
  }

  // Safely parse JSON (cleaning potential Markdown fences if returned)
  return parseGeminiJson(rawText);
}

/**
 * Cleans and safely parses raw text into a JavaScript Object.
 * @param {string} rawText 
 * @returns {Object}
 */
function parseGeminiJson(rawText) {
  let cleaned = rawText.trim();

  // Remove markdown code fences if present (e.g., ```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error('JSON Parse Error. Raw content was:\n', rawText);
    throw new Error('Invalid JSON Format: The AI response could not be parsed as valid JSON. Please try generating again.');
  }
}

/**
 * Validates the study kit response structure strictly against requirements.
 * @param {Object} data - The parsed AI object
 * @returns {boolean} - Returns true if completely valid, otherwise throws descriptive Error
 */
function validateStudyKitResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Validation Failed: The AI response is not a valid JSON object.');
  }

  // 1. Validate Topic
  if (!data.topic || typeof data.topic !== 'string') {
    data.topic = 'Study Kit Topic';
  }

  // 2. Validate Summary
  if (!data.summary || typeof data.summary !== 'string' || data.summary.trim().length < 20) {
    throw new Error('Validation Failed: The generated summary is too short or missing.');
  }

  // 3. Validate Quiz (Must have at least 5 questions, 4 options each)
  if (!Array.isArray(data.quiz) || data.quiz.length < 5) {
    throw new Error(`Validation Failed: Quiz must contain at least 5 questions (received ${data.quiz?.length || 0}).`);
  }

  // Slice to exactly 5 questions if AI generated more
  data.quiz = data.quiz.slice(0, 5);

  data.quiz.forEach((q, idx) => {
    if (!q.question || typeof q.question !== 'string') {
      throw new Error(`Validation Failed: Quiz Question #${idx + 1} has invalid or missing question text.`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Validation Failed: Quiz Question #${idx + 1} must have exactly 4 choices.`);
    }
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
      // Default to 0 if out of bounds
      q.correctIndex = 0;
    }
    if (!q.explanation || typeof q.explanation !== 'string') {
      q.explanation = `Option ${String.fromCharCode(65 + q.correctIndex)} is the correct answer based on study concepts.`;
    }
  });

  // 4. Validate Flashcards
  if (!Array.isArray(data.flashcards) || data.flashcards.length === 0) {
    throw new Error('Validation Failed: No flashcards were found in the AI response.');
  }

  data.flashcards.forEach((fc, idx) => {
    if (!fc.front || !fc.back) {
      throw new Error(`Validation Failed: Flashcard #${idx + 1} is missing a front or back content.`);
    }
  });

  return true;
}

/* --------------------------------------------------------------------------
   11. MAIN GENERATION CONTROLLER
   -------------------------------------------------------------------------- */
/**
 * Orchestrates the full generation pipeline:
 * 1. Validates user input and API Key
 * 2. Displays loading indicator and disables generate button
 * 3. Builds prompt and calls Gemini Flash API
 * 4. Parses and validates the response
 * 5. Renders Summary, Quiz, and Flashcards
 * 6. Saves result to localStorage history
 */
async function handleGenerateStudyKit() {
  if (AppState.isGenerating) return;

  const notes = DOM.notesInput.value.trim();
  const answerStyle = DOM.answerStyleSelect.value;
  const quizDifficulty = DOM.quizDifficultySelect.value;
  const selectedModel = DOM.geminiModelSelect.value || DEFAULT_GEMINI_MODEL;

  // Validation Check 1: Input text
  if (!notes) {
    showAlert('Empty Input', 'Please enter study notes or a topic before generating.', 'error');
    DOM.notesInput.focus();
    return;
  }

  // Validation Check 2: API Key existence
  if (!AppState.apiKey) {
    showAlert(
      'Gemini API Key Required',
      'Please configure your free Gemini API key in Settings, or click "Try Demo Data" to test the UI immediately without a key.',
      'error'
    );
    // Suggest navigating to settings
    return;
  }

  hideAlert();
  setGeneratingUIState(true);

  try {
    // 1. Build prompt
    const prompt = buildStudyPrompt(notes, answerStyle, quizDifficulty);

    // 2. Fetch from Gemini API
    const parsedData = await callGeminiApi(prompt, AppState.apiKey, selectedModel);

    // 3. Validate AI response structure
    validateStudyKitResponse(parsedData);

    // 4. Package complete study kit object
    const studyKit = {
      id: 'kit_' + Date.now(),
      topic: parsedData.topic || notes.slice(0, 40) + '...',
      style: answerStyle,
      difficulty: quizDifficulty,
      summary: parsedData.summary,
      quiz: parsedData.quiz,
      flashcards: parsedData.flashcards,
      timestamp: new Date().toISOString()
    };

    // 5. Update application state & UI
    AppState.currentStudyKit = studyKit;
    AppState.quizAnswers = {};
    AppState.activeFlashcardIndex = 0;

    renderStudyKit(studyKit);

    // 6. Persist to History
    saveStudyKitToHistory(studyKit);

    showToast('✨ Study Kit generated successfully!');

  } catch (err) {
    console.error('Study Kit Generation Error:', err);
    showAlert('Generation Failed', err.message, 'error');
  } finally {
    setGeneratingUIState(false);
  }
}

/**
 * Updates UI loading state during API generation.
 * @param {boolean} isLoading 
 */
function setGeneratingUIState(isLoading) {
  AppState.isGenerating = isLoading;
  DOM.generateBtn.disabled = isLoading;

  if (isLoading) {
    DOM.generateBtnSpinner.classList.remove('hidden');
    DOM.generateBtnIcon.classList.add('hidden');
    DOM.generateBtnText.textContent = 'Generating...';
    DOM.loadingState.classList.remove('hidden');
    DOM.outputContainer.classList.add('hidden');
  } else {
    DOM.generateBtnSpinner.classList.add('hidden');
    DOM.generateBtnIcon.classList.remove('hidden');
    DOM.generateBtnText.textContent = 'Generate Study Kit';
    DOM.loadingState.classList.add('hidden');
  }
}

/* --------------------------------------------------------------------------
   12. RENDERING FUNCTIONS (Summary, Quiz, Flashcards)
   -------------------------------------------------------------------------- */
/**
 * Renders the full Study Kit onto the dashboard.
 * @param {Object} kit - Study Kit object
 */
function renderStudyKit(kit) {
  // 1. Header Metadata
  DOM.outputTopicTitle.textContent = kit.topic;
  DOM.outputStyleTag.textContent = kit.style.charAt(0).toUpperCase() + kit.style.slice(1);
  DOM.outputDifficultyTag.textContent = kit.difficulty.charAt(0).toUpperCase() + kit.difficulty.slice(1);
  DOM.outputTimeTag.textContent = formatRelativeTime(kit.timestamp);

  // 2. Badges in sub-tabs
  DOM.quizScoreBadge.textContent = `0/${kit.quiz.length}`;
  DOM.flashcardCountBadge.textContent = kit.flashcards.length;

  // 3. Render Sub-components
  renderSummary(kit.summary);
  renderQuiz(kit.quiz);
  renderFlashcards(kit.flashcards);

  // 4. Show Output Container and default to Summary sub-tab
  DOM.outputContainer.classList.remove('hidden');
  switchSubtab('summary');

  // Smooth scroll down to output
  DOM.outputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Converts simple Markdown to sanitized HTML and renders into the summary container.
 * @param {string} markdownText 
 */
function renderSummary(markdownText) {
  DOM.summaryContent.innerHTML = formatMarkdownToHTML(markdownText);
}

/**
 * Lightweight, safe Markdown to HTML converter (headings, bold, lists, code, paragraphs).
 * Avoids external library dependencies (per assignment rules).
 * @param {string} md 
 * @returns {string} - HTML string
 */
function formatMarkdownToHTML(md) {
  if (!md) return '';

  // Escape HTML entities to prevent XSS
  let text = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bullet Lists
  const lines = text.split('\n');
  let inList = false;
  let htmlLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`<li>${trimmed.substring(2)}</li>`);
    } else {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0 && !trimmed.startsWith('<h') && !trimmed.startsWith('</h')) {
        htmlLines.push(`<p>${line}</p>`);
      } else {
        htmlLines.push(line);
      }
    }
  }

  if (inList) {
    htmlLines.push('</ul>');
  }

  return htmlLines.join('\n');
}

/**
 * Renders the 5 multiple choice questions into the quiz list.
 * @param {Array} quizArray 
 */
function renderQuiz(quizArray) {
  DOM.quizList.innerHTML = '';
  DOM.quizSummaryBox.classList.add('hidden');
  DOM.liveScoreNum.textContent = `0 / ${quizArray.length}`;

  quizArray.forEach((q, qIndex) => {
    const itemCard = document.createElement('div');
    itemCard.className = 'quiz-item';
    itemCard.id = `quiz-item-${qIndex}`;

    // Question Header
    const header = document.createElement('div');
    header.className = 'quiz-question-header';
    header.innerHTML = `
      <span class="question-num-badge">Question ${qIndex + 1}</span>
      <h4 class="question-text">${escapeHtml(q.question)}</h4>
    `;
    itemCard.appendChild(header);

    // Options List
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'quiz-options';

    const optionLetters = ['A', 'B', 'C', 'D'];
    q.options.forEach((optText, optIndex) => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'quiz-option-btn';
      optBtn.dataset.questionIndex = qIndex;
      optBtn.dataset.optionIndex = optIndex;

      optBtn.innerHTML = `
        <span class="option-prefix">${optionLetters[optIndex]}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
      `;

      optBtn.addEventListener('click', () => handleQuizOptionSelect(qIndex, optIndex));
      optionsContainer.appendChild(optBtn);
    });

    itemCard.appendChild(optionsContainer);

    // Explanation Box (Hidden initially)
    const explanationBox = document.createElement('div');
    explanationBox.className = 'quiz-explanation-box hidden';
    explanationBox.id = `quiz-explanation-${qIndex}`;
    explanationBox.innerHTML = `<strong>Explanation:</strong> ${escapeHtml(q.explanation)}`;
    itemCard.appendChild(explanationBox);

    DOM.quizList.appendChild(itemCard);
  });
}

/**
 * Handles selection of a quiz option with interactive immediate feedback.
 * @param {number} qIndex - Question Index (0 - 4)
 * @param {number} selectedOptIndex - Option Index (0 - 3)
 */
function handleQuizOptionSelect(qIndex, selectedOptIndex) {
  // If already answered, do nothing
  if (AppState.quizAnswers[qIndex] !== undefined) {
    return;
  }

  const currentKit = AppState.currentStudyKit;
  if (!currentKit || !currentKit.quiz[qIndex]) return;

  const questionObj = currentKit.quiz[qIndex];
  const correctOptIndex = questionObj.correctIndex;

  // Record Answer
  AppState.quizAnswers[qIndex] = selectedOptIndex;

  // Visual option updates
  const questionCard = document.getElementById(`quiz-item-${qIndex}`);
  const optionButtons = questionCard.querySelectorAll('.quiz-option-btn');

  optionButtons.forEach((btn, idx) => {
    btn.disabled = true; // Disable further clicking

    if (idx === correctOptIndex) {
      btn.classList.add('reveal-correct');
    }

    if (idx === selectedOptIndex) {
      if (selectedOptIndex === correctOptIndex) {
        btn.classList.add('selected-correct');
      } else {
        btn.classList.add('selected-incorrect');
      }
    }
  });

  // Reveal Explanation
  const explanationBox = document.getElementById(`quiz-explanation-${qIndex}`);
  if (explanationBox) {
    explanationBox.classList.remove('hidden');
  }

  // Update Live Score Counter
  calculateAndUpdateQuizScore();
}

/**
 * Calculates current score and updates quiz badges / summary.
 */
function calculateAndUpdateQuizScore() {
  const currentKit = AppState.currentStudyKit;
  if (!currentKit) return;

  const totalQuestions = currentKit.quiz.length;
  let correctCount = 0;
  let answeredCount = 0;

  currentKit.quiz.forEach((q, idx) => {
    const selected = AppState.quizAnswers[idx];
    if (selected !== undefined) {
      answeredCount++;
      if (selected === q.correctIndex) {
        correctCount++;
      }
    }
  });

  // Update Score Numbers
  DOM.liveScoreNum.textContent = `${correctCount} / ${totalQuestions}`;
  DOM.quizScoreBadge.textContent = `${correctCount}/${totalQuestions}`;

  // If all 5 answered, show completion banner
  if (answeredCount === totalQuestions) {
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    DOM.scoreCircle.textContent = `${percentage}%`;
    DOM.scoreSubtitle.textContent = `You scored ${correctCount} out of ${totalQuestions} questions correctly.`;

    if (percentage >= 80) {
      DOM.scoreTitle.textContent = '🎉 Excellent Job! Mastered!';
    } else if (percentage >= 60) {
      DOM.scoreTitle.textContent = '👍 Good Effort! Review mistakes above.';
    } else {
      DOM.scoreTitle.textContent = '📚 Keep Practicing! Try reviewing the summary.';
    }

    DOM.quizSummaryBox.classList.remove('hidden');
  }
}

/**
 * Resets all quiz answers and lets user retake the quiz.
 */
function handleResetQuiz() {
  if (!AppState.currentStudyKit) return;
  AppState.quizAnswers = {};
  renderQuiz(AppState.currentStudyKit.quiz);
  showToast('Quiz reset! Ready to retake.');
}

/* --------------------------------------------------------------------------
   13. 3D FLASHCARDS ENGINE
   -------------------------------------------------------------------------- */
/**
 * Renders flashcards in both Carousel view and Grid view.
 * @param {Array} flashcardsArray 
 */
function renderFlashcards(flashcardsArray) {
  AppState.activeFlashcardIndex = 0;
  DOM.fcTotalCards.textContent = flashcardsArray.length;

  renderActiveCarouselCard();
  renderFlashcardsGrid(flashcardsArray);
}

/**
 * Renders the single active card inside the 3D Carousel Viewport.
 */
function renderActiveCarouselCard() {
  const cards = AppState.currentStudyKit?.flashcards;
  if (!cards || cards.length === 0) return;

  const index = AppState.activeFlashcardIndex;
  const cardData = cards[index];

  DOM.fcCurrentIndex.textContent = index + 1;
  DOM.activeSingleCardWrapper.innerHTML = '';

  const flipCard = create3DCardElement(cardData, index, cards.length);
  DOM.activeSingleCardWrapper.appendChild(flipCard);
}

/**
 * Creates a 3D Flip Card DOM element with front and back faces.
 * @param {Object} cardData - { front, back }
 * @param {number} index 
 * @param {number} total 
 * @returns {HTMLElement} - .flip-card element
 */
function create3DCardElement(cardData, index, total) {
  const card = document.createElement('div');
  card.className = 'flip-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Flashcard ${index + 1}: ${cardData.front}. Click to flip.`);

  card.innerHTML = `
    <!-- Front Face -->
    <div class="flip-card-front">
      <div class="card-face-header">
        <span class="face-badge badge-question">Question / Term</span>
        <span class="flip-hint-badge">Click card to flip 🔄</span>
      </div>
      <div class="card-face-content">
        <p class="card-question-text">${escapeHtml(cardData.front)}</p>
      </div>
      <div class="card-face-footer">
        <span>Card ${index + 1} of ${total}</span>
        <span>Reveal Answer ➔</span>
      </div>
    </div>

    <!-- Back Face -->
    <div class="flip-card-back">
      <div class="card-face-header">
        <span class="face-badge badge-answer">Answer / Concept</span>
        <span class="flip-hint-badge">Click card to flip 🔄</span>
      </div>
      <div class="card-face-content">
        <p class="card-answer-text">${escapeHtml(cardData.back)}</p>
      </div>
      <div class="card-face-footer">
        <span>Card ${index + 1} of ${total}</span>
        <span>Review Question ➔</span>
      </div>
    </div>
  `;

  // Flip on click
  card.addEventListener('click', () => {
    card.classList.toggle('flipped');
  });

  // Flip on keyboard Enter/Space for accessibility
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.classList.toggle('flipped');
    }
  });

  return card;
}

/**
 * Renders the full grid view for flashcards.
 * @param {Array} cards 
 */
function renderFlashcardsGrid(cards) {
  DOM.flashcardGridView.innerHTML = '';
  cards.forEach((cardData, idx) => {
    const cardEl = create3DCardElement(cardData, idx, cards.length);
    DOM.flashcardGridView.appendChild(cardEl);
  });
}

function handleNextFlashcard() {
  const cards = AppState.currentStudyKit?.flashcards;
  if (!cards) return;

  AppState.activeFlashcardIndex = (AppState.activeFlashcardIndex + 1) % cards.length;
  renderActiveCarouselCard();
}

function handlePrevFlashcard() {
  const cards = AppState.currentStudyKit?.flashcards;
  if (!cards) return;

  AppState.activeFlashcardIndex = (AppState.activeFlashcardIndex - 1 + cards.length) % cards.length;
  renderActiveCarouselCard();
}

function handleFlipActiveCard() {
  const activeCard = DOM.activeSingleCardWrapper.querySelector('.flip-card');
  if (activeCard) {
    activeCard.classList.toggle('flipped');
  }
}

/**
 * Toggles flashcard display mode between Carousel and Grid.
 * @param {string} mode - 'carousel' | 'grid'
 */
function switchFlashcardViewMode(mode) {
  if (mode === 'carousel') {
    DOM.flashcardCarouselView.classList.remove('hidden');
    DOM.flashcardGridView.classList.add('hidden');
    DOM.viewModeCarouselBtn.classList.add('active');
    DOM.viewModeGridBtn.classList.remove('active');
  } else {
    DOM.flashcardCarouselView.classList.add('hidden');
    DOM.flashcardGridView.classList.remove('hidden');
    DOM.viewModeCarouselBtn.classList.remove('active');
    DOM.viewModeGridBtn.classList.add('active');
  }
}

/* --------------------------------------------------------------------------
   14. COPY & DOWNLOAD SUMMARY
   -------------------------------------------------------------------------- */
/**
 * Copies the active summary to user's clipboard using the modern Clipboard API.
 */
async function handleCopySummary() {
  if (!AppState.currentStudyKit) return;

  const rawSummary = AppState.currentStudyKit.summary;
  try {
    await navigator.clipboard.writeText(rawSummary);
    DOM.copySummaryIcon.textContent = '✅';
    DOM.copySummaryText.textContent = 'Copied!';
    showToast('Summary copied to clipboard!');

    setTimeout(() => {
      DOM.copySummaryIcon.textContent = '📋';
      DOM.copySummaryText.textContent = 'Copy Text';
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = rawSummary;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Summary copied!');
  }
}

/**
 * Downloads summary text as a downloadable `.txt` file using Blob & URL.createObjectURL.
 */
function handleDownloadSummary() {
  if (!AppState.currentStudyKit) return;

  const kit = AppState.currentStudyKit;
  const fileName = `${kit.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.txt`;

  const fileContent = `=====================================================
${kit.topic.toUpperCase()}
Study Style: ${kit.style.toUpperCase()} | Generated: ${new Date(kit.timestamp).toLocaleString()}
AI Study Assistant - Web Technology Assignment 5
=====================================================

${kit.summary}

=====================================================
Generated by AI Study Assistant (Vanilla JS + Gemini)
=====================================================`;

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  showToast(`Downloaded: ${fileName}`);
}

/* --------------------------------------------------------------------------
   15. HISTORY MANAGEMENT (localStorage CRUD)
   -------------------------------------------------------------------------- */
/**
 * Saves a new study kit to localStorage history array (keeps up to 20).
 * @param {Object} kit 
 */
function saveStudyKitToHistory(kit) {
  // Prepend to front of list
  AppState.history.unshift(kit);

  // Keep maximum 20 items to respect localStorage limits
  if (AppState.history.length > 20) {
    AppState.history = AppState.history.slice(0, 20);
  }

  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(AppState.history));
  renderHistoryList();
}

/**
 * Renders the saved history list in Tab 2.
 */
function renderHistoryList() {
  const history = AppState.history;
  DOM.historyCountBadge.textContent = history.length;

  if (history.length === 0) {
    DOM.historyList.innerHTML = '';
    DOM.historyEmptyState.classList.remove('hidden');
    DOM.clearAllHistoryBtn.disabled = true;
    return;
  }

  DOM.historyEmptyState.classList.add('hidden');
  DOM.clearAllHistoryBtn.disabled = false;
  DOM.historyList.innerHTML = '';

  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item-card';

    card.innerHTML = `
      <div class="history-info">
        <h4 class="history-title">${escapeHtml(item.topic)}</h4>
        <div class="history-meta-row">
          <span>📅 ${new Date(item.timestamp).toLocaleDateString()}</span>
          <span>🎯 ${escapeHtml(item.style)}</span>
          <span>🧠 ${escapeHtml(item.difficulty)}</span>
          <span>❓ ${item.quiz?.length || 5} MCQs</span>
          <span>🗂️ ${item.flashcards?.length || 5} Cards</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm load-history-btn" data-id="${item.id}" title="Reopen study set">
          👁️ Open
        </button>
        <button class="btn btn-danger-ghost btn-sm delete-history-btn" data-id="${item.id}" title="Delete study set">
          🗑️
        </button>
      </div>
    `;

    // Reopen Button
    card.querySelector('.load-history-btn').addEventListener('click', () => {
      loadHistoryItem(item.id);
    });

    // Delete Button
    card.querySelector('.delete-history-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.id);
    });

    DOM.historyList.appendChild(card);
  });
}

/**
 * Re-opens a historical study kit and switches back to the generator tab.
 * @param {string} id 
 */
function loadHistoryItem(id) {
  const item = AppState.history.find(h => h.id === id);
  if (!item) return;

  AppState.currentStudyKit = item;
  AppState.quizAnswers = {};
  AppState.activeFlashcardIndex = 0;

  renderStudyKit(item);
  switchTab('generator');
  showToast(`Loaded "${item.topic}"`);
}

/**
 * Deletes a single item from history.
 * @param {string} id 
 */
function deleteHistoryItem(id) {
  AppState.history = AppState.history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(AppState.history));
  renderHistoryList();
  showToast('Study set deleted from history');
}

/**
 * Clears all saved history entries after user confirmation.
 */
function handleClearAllHistory() {
  if (AppState.history.length === 0) return;

  if (confirm('Are you sure you want to delete all saved study history? This action cannot be undone.')) {
    AppState.history = [];
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    renderHistoryList();
    showToast('All history cleared');
  }
}

/* --------------------------------------------------------------------------
   16. DEMO MODE & SAMPLE TOPIC LOADERS
   -------------------------------------------------------------------------- */
/**
 * Loads a complete, pre-configured sample study kit into the UI immediately.
 * Allows the evaluator or student to test all features without an API Key.
 */
function handleLoadDemoData() {
  const sample = SAMPLE_STUDY_KITS.os;
  const demoKit = {
    id: 'demo_' + Date.now(),
    topic: sample.topic,
    style: sample.style,
    difficulty: sample.difficulty,
    summary: sample.summary,
    quiz: JSON.parse(JSON.stringify(sample.quiz)),
    flashcards: JSON.parse(JSON.stringify(sample.flashcards)),
    timestamp: new Date().toISOString()
  };

  AppState.currentStudyKit = demoKit;
  AppState.quizAnswers = {};
  AppState.activeFlashcardIndex = 0;

  // Put notes in textarea for reference
  DOM.notesInput.value = "Explain CPU Scheduling algorithms in Operating Systems including FCFS, SJF, Round Robin, and Priority Scheduling with performance metrics.";
  updateCharCounter();

  // Render and show
  renderStudyKit(demoKit);
  saveStudyKitToHistory(demoKit);
  switchTab('generator');
  showToast('🎉 Loaded Operating Systems Demo Kit! Try the Quiz and Flashcards!');
}

/**
 * Populates the textarea with sample notes based on the dropdown selector.
 */
function handleSampleTopicSelect() {
  const selectedKey = DOM.sampleTopicSelect.value;
  const sample = SAMPLE_STUDY_KITS[selectedKey];
  if (!sample) return;

  const sampleTexts = {
    os: "Explain CPU Scheduling Algorithms in modern Operating Systems: FCFS, Shortest Job First (SJF), Round Robin (RR), and Priority Scheduling. Describe performance metrics like Turnaround Time, Waiting Time, Response Time, and the Convoy Effect.",
    dbms: "Explain Database Normalization from 1NF to BCNF in relational database management systems. Cover 1NF atomicity, 2NF partial dependencies, 3NF transitive dependencies, and BCNF superkey requirements with trade-offs.",
    web: "Compare HTTP vs HTTPS, default ports 80 and 443, SSL/TLS handshake mechanisms (TLS 1.3), symmetric vs asymmetric encryption, and digital certificates issued by Certificate Authorities.",
    ml: "Explain the differences between Supervised and Unsupervised Learning in Artificial Intelligence. Include regression, classification, clustering, dimensionality reduction, and examples like K-Means and Decision Trees."
  };

  DOM.notesInput.value = sampleTexts[selectedKey] || '';
  updateCharCounter();
  DOM.notesInput.focus();
}

/* --------------------------------------------------------------------------
   17. ALERT BANNER & TOAST NOTIFICATIONS
   -------------------------------------------------------------------------- */
/**
 * Displays an alert notification banner above the content.
 * @param {string} title 
 * @param {string} message 
 * @param {string} type - 'error' | 'success' | 'warning' | 'info'
 */
function showAlert(title, message, type = 'error') {
  DOM.alertTitle.textContent = title;
  DOM.alertMessage.textContent = message;

  DOM.globalAlert.className = `alert-banner ${type}`;
  DOM.globalAlert.classList.remove('hidden');

  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  };
  DOM.alertIcon.textContent = icons[type] || '⚠️';

  DOM.globalAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideAlert() {
  DOM.globalAlert.classList.add('hidden');
}

/**
 * Shows a fleeting toast notification at the bottom-right of the screen.
 * @param {string} message 
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>⚡</span> <span>${escapeHtml(message)}</span>`;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      DOM.toastContainer.removeChild(toast);
    }
  }, 3000);
}

/* --------------------------------------------------------------------------
   18. EVENT LISTENERS
   -------------------------------------------------------------------------- */
function setupEventListeners() {
  // Navigation tabs
  DOM.navButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Mobile drawer controls
  DOM.hamburgerBtn.addEventListener('click', openMobileSidebar);
  DOM.sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  DOM.sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Theme toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Quick topbar buttons
  DOM.loadDemoBtn.addEventListener('click', handleLoadDemoData);
  DOM.quickApiKeyBtn.addEventListener('click', () => switchTab('settings'));

  // Textarea char counter & controls
  DOM.notesInput.addEventListener('input', updateCharCounter);
  DOM.clearInputBtn.addEventListener('click', () => {
    DOM.notesInput.value = '';
    DOM.sampleTopicSelect.selectedIndex = 0;
    updateCharCounter();
    DOM.notesInput.focus();
  });
  DOM.sampleTopicSelect.addEventListener('change', handleSampleTopicSelect);

  // Generate Button
  DOM.generateBtn.addEventListener('click', handleGenerateStudyKit);

  // Output Sub-tabs (Summary, Quiz, Flashcards)
  DOM.pillButtons.forEach(btn => {
    btn.addEventListener('click', () => switchSubtab(btn.dataset.subtab));
  });

  // Summary Actions (Copy & Download)
  DOM.copySummaryBtn.addEventListener('click', handleCopySummary);
  DOM.downloadSummaryBtn.addEventListener('click', handleDownloadSummary);

  // Quiz Actions
  DOM.resetQuizBtn.addEventListener('click', handleResetQuiz);

  // Flashcards Actions
  DOM.fcNextBtn.addEventListener('click', handleNextFlashcard);
  DOM.fcPrevBtn.addEventListener('click', handlePrevFlashcard);
  DOM.fcFlipActiveBtn.addEventListener('click', handleFlipActiveCard);
  DOM.viewModeCarouselBtn.addEventListener('click', () => switchFlashcardViewMode('carousel'));
  DOM.viewModeGridBtn.addEventListener('click', () => switchFlashcardViewMode('grid'));

  // History Actions
  DOM.clearAllHistoryBtn.addEventListener('click', handleClearAllHistory);
  DOM.historyGoGenerateBtn.addEventListener('click', () => switchTab('generator'));

  // Settings Actions
  DOM.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  DOM.testApiKeyBtn.addEventListener('click', handleTestApiKey);
  DOM.removeApiKeyBtn.addEventListener('click', handleRemoveApiKey);
  DOM.toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);

  // Alert Banner close button
  DOM.alertCloseBtn.addEventListener('click', hideAlert);
}

/* --------------------------------------------------------------------------
   19. UTILITY HELPERS
   -------------------------------------------------------------------------- */
/**
 * Updates textarea character counter.
 */
function updateCharCounter() {
  const currentLength = DOM.notesInput.value.length;
  DOM.charCount.textContent = currentLength.toLocaleString();
}

/**
 * Escapes unsafe characters for HTML injection to prevent XSS.
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns a human-friendly relative time string (e.g., "Just now", "5m ago").
 * @param {string} isoString 
 * @returns {string}
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

