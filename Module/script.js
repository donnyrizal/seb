document.addEventListener("DOMContentLoaded", () => {
  const els = {
    clock: document.getElementById("live-clock"),
    date: document.getElementById("live-date"),
    scheduleContainer: document.getElementById("schedule-container"),
    placeholder: document.getElementById("jadwal-placeholder"),
    msgTitle: document.getElementById("msg-title"),
    msgBody: document.getElementById("msg-body"),
    themeBtn: document.getElementById("theme-toggle"),
    darkIcon: document.getElementById("theme-toggle-dark-icon"),
    lightIcon: document.getElementById("theme-toggle-light-icon"),
    body: document.body,
  };
  let EXAM_DATA = []; 
  async function initData() {
    try {
      const response = await fetch("./Module/data.json?t=" + new Date().getTime());
      if (!response.ok) throw new Error("Failed to load schedule data");
      const rawData = await response.json();
      EXAM_DATA = rawData.map((item) => ({
        ...item,
        start: new Date(item.start),
        end: new Date(item.end),
      }));
      renderActiveSchedules();
      setInterval(renderActiveSchedules, 1000);
    } catch (error) {
      console.error(error);
      els.scheduleContainer.innerHTML = `
                <div class="text-red-500 text-center p-6 border border-red-200 bg-red-50 rounded shadow-sm mx-4">
                    <h2 class="text-xl font-bold mb-2">⚠️ Gagal Memuat Jadwal</h2>
                    <p class="mb-4">Terjadi kesalahan pada file <code>data.json</code>.</p>
                    <div class="bg-white p-3 rounded text-left font-mono text-sm overflow-auto border border-red-100 text-red-700">
                        ${error.message}
                    </div>
                    <p class="mt-4 text-sm text-gray-600">
                        Coba buka <a href="checker.html" class="text-blue-600 underline hover:text-blue-800">checker.html</a> untuk memperbaiki error ini.
                    </p>
                </div>`;
      els.scheduleContainer.classList.remove("hidden");
      els.placeholder.classList.add("hidden");
    }
  }
 function toSebLink(url) {
        if (!url) return "#";
        const fullUrl = new URL(url, window.location.href);
        fullUrl.protocol = 'sebs:';
        return fullUrl.href;
    }

  function updateTime() {
    const now = new Date();
    els.clock.textContent = now.toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    };
    els.date.textContent = new Intl.DateTimeFormat("id-ID", options).format(
      now
    );
    const h = now.getHours();
    const greetings = [
      {
        max: 12,
        title: "Sugeng Enjang! ☀️",
        body: "Ngopi Ndisik Ngab ☕",
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-200",
      },
      {
        max: 15,
        title: "Sugeng Siang! 🕶️",
        body: "Jare Pakdhe Jokowi, Kerja Kerja Kerja 🐂",
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
      },
      {
        max: 18,
        title: "Sugeng Sonten! 🌆",
        body: "Wes wektune leyeh-leyeh 💤",
        bg: "bg-indigo-100",
        text: "text-indigo-800",
        border: "border-indigo-200",
      },
      {
        max: 24,
        title: "😴 Have a Nice Dream! 🌙",
        body: "🌠 Only in the darkness can you see the stars ✨",
        bg: "bg-gray-800",
        text: "text-gray-100",
        border: "border-gray-600",
      },
    ];

    const greet = greetings.find((g) => h < g.max);

    if (greet) {
      els.msgTitle.textContent = greet.title;
      els.msgBody.textContent = greet.body;
      const dashboard = document.getElementById("time-dashboard");
      const allClasses = [
        "bg-white",
        "dark:bg-gray-800", // Remove defaults
        "bg-yellow-100",
        "text-yellow-800",
        "border-yellow-200",
        "bg-blue-100",
        "text-blue-800",
        "border-blue-200",
        "bg-indigo-100",
        "text-indigo-800",
        "border-indigo-200",
        "bg-gray-800",
        "text-gray-100",
        "border-gray-600",
      ];
      dashboard.classList.remove(...allClasses);
      dashboard.classList.add(greet.bg, greet.text, greet.border);
    }
  }

  let lastRenderedHTML = "";
  function renderActiveSchedules() {
    if (!EXAM_DATA.length) return;
    const now = new Date();
    let activeCount = 0;
    let htmlContent = "";

    EXAM_DATA.forEach((schedule) => {
      if (now >= schedule.start && now < schedule.end) {
        activeCount++;
        const rows = schedule.courses
          .map(
            (course) => `
                    <tr>
                        <td>
                            <a class="seb" href="${toSebLink(course.link)}">${
              course.name
            }</a>
                            <a href="${toSebLink(
                              course.link
                            )}" class="inline-flex items-center justify-center p-1 text-base font-medium text-gray-500 rounded-lg bg-gray-50 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
                                            <svg class="w-4 h-4 rtl:rotate-180" aria-hidden="true"
                                                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                                <path stroke="currentColor" stroke-linecap="round"
                                                    stroke-linejoin="round" stroke-width="3"
                                                    d="M1 5h12m0 0L9 1m4 4L9 9" />
                                            </svg>
                            </a>
                        </td>
                        <td>
    <ol class="list-decimal pl-4 space-y-1">
        ${course.lecturers.map((l) => `<li>${l}</li>`).join("")}
    </ol>
</td>
                        <td>${course.time}</td>
                        <td>Online via <b>SEB (Closedbook)</b></td>
                    </tr>
                `
          )
          .join("");

        htmlContent += `
                    <div class="schedule-block animate-fade-in mb-8">
                        <table class="table table-striped sebtable w-full border">
                            <thead>
                                <th colspan="4">${schedule.dateTitle}</th>
                                </thead>
                                <thead>
                                <tr>
                                    <th>Mata Kuliah</th>
                                    <th>Pengampu</th>
                                    <th>Jadwal</th>
                                    <th>Metode</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
      }
    });
    if (htmlContent !== lastRenderedHTML) {
      console.log("Status Changed: Updating Screen...");
      if (activeCount > 0) {
        els.scheduleContainer.innerHTML = htmlContent;
        els.scheduleContainer.classList.remove("hidden");
        els.placeholder.classList.add("hidden");
      } else {
        els.scheduleContainer.innerHTML = "";
        els.scheduleContainer.classList.add("hidden");
        els.placeholder.classList.remove("hidden");
      }
      lastRenderedHTML = htmlContent;
    }
  }
  function toggleTheme(isDark) {
    if (isDark) {
      document.documentElement.classList.add("dark");
      els.body.classList.add("night-mode");
      els.darkIcon.classList.add("hidden");
      els.lightIcon.classList.remove("hidden");
      els.themeBtn.classList.replace("bg-gray-200", "bg-gray-700");
      els.themeBtn.classList.replace("text-gray-900", "text-gray-100");
    } else {
      document.documentElement.classList.remove("dark");
      els.body.classList.remove("night-mode");
      els.darkIcon.classList.remove("hidden");
      els.lightIcon.classList.add("hidden");
      els.themeBtn.classList.replace("bg-gray-700", "bg-gray-200");
      els.themeBtn.classList.replace("text-gray-100", "text-gray-900");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  const savedTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  toggleTheme(savedTheme ? savedTheme === "dark" : systemDark);

  els.themeBtn.addEventListener("click", () => {
    const isCurrentDark = els.body.classList.contains("night-mode");
    toggleTheme(!isCurrentDark);
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J"].includes(e.key)) ||
      (e.ctrlKey && e.key === "u")
    ) {
      e.preventDefault();
    }
  });

  updateTime();
  setInterval(updateTime, 1000);
  initData();
});
