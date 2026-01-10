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
  let serverTimeOffset = 0;
  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLFzIPXW64oTw6dcpH0g-Y4H_w2EFGx4tYTSvzlTM_G16bL68NnDeAUFQqDzTXvd9sSPlkw_0Iqm3X/pub?gid=1005242582&single=true&output=csv";

  async function initData() {
    try {
      console.log("1. Starting Fetch...");
      const response = await fetch(SHEET_URL);
      console.log("2. Response Status:", response.status);

      if (!response.ok)
        throw new Error("Gagal mengambil data dari Google Sheets");

      const serverDateHeader = response.headers.get("Date");
      if (serverDateHeader) {
        const serverTime = new Date(serverDateHeader).getTime();
        const clientTime = Date.now();
        serverTimeOffset = serverTime - clientTime;
        console.log("🕒 Time Synced. Offset:", serverTimeOffset, "ms");
      }

      const csvText = await response.text();
      if (csvText.includes("<!DOCTYPE html>")) {
        console.error("🚨 ERROR: Google returned a webpage, not CSV.");
        return;
      }

      const rawRows = parseCSV(csvText);
      EXAM_DATA = rawRows.map((row) => {
        let datePart = row.Date;
        let duration = row["Waktu Ujian"];
        if (datePart.includes("/")) {
          const parts = datePart.split("/");
          if (parts.length === 3)
            datePart = `${parts[2]}-${parts[1].padStart(
              2,
              "0"
            )}-${parts[0].padStart(2, "0")}`;
        } else if (datePart.includes(",")) {
          const parts = datePart.split(",");
          if (parts.length === 3)
            datePart = `${parts[2]}-${parts[1].padStart(
              2,
              "0"
            )}-${parts[0].padStart(2, "0")}`;
        }

        const cleanStart = row.Start.trim().padStart(5, "0");
        const cleanEnd = row.End.trim().padStart(5, "0");
        const startStr = `${datePart}T${cleanStart}:00+07:00`;
        const endStr = `${datePart}T${cleanEnd}:00+07:00`;
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);

        const originalLink = row.Link || "";
        const lowerLink = originalLink.toLowerCase();
        let finalMethod = "SEB";
        let finalLink = originalLink;

        if (lowerLink.includes("myujian")) {
          finalMethod = "MyUjian";
          finalLink = "https://myujian.ums.ac.id";
        } else if (lowerLink.includes("spada")) {
          finalMethod = "SPADA";
          finalLink = "https://spada12.ums.ac.id";
        } else if (lowerLink.includes("tugas")) {
          finalMethod = "Tugas";
          finalLink = "#";
        } else if (lowerLink.includes("paper")) {
          finalMethod = "Paper";
          finalLink = "#";
        }

        let lecturersList = [];
        if (row.Lecturers) {
          const rawLec = row.Lecturers.trim();
          if (rawLec.match(/\r?\n/)) lecturersList = rawLec.split(/\r?\n/);
          else if (rawLec.includes('", "'))
            lecturersList = rawLec.split('", "');
          else lecturersList = [rawLec];
          lecturersList = lecturersList.map((name) =>
            name.trim().replace(/^["']+|["']+$/g, "")
          );
        }

        return {
          dateTitle: isNaN(startDate.getTime())
            ? "⚠️ Invalid Date"
            : startDate.toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
          start: startDate,
          end: endDate,
          courses: [
            {
              name: row.Course,
              lecturers: lecturersList,
              duration: duration,
              time: `${cleanStart}-${cleanEnd} WIB`,
              link: finalLink,
              method: finalMethod,
            },
          ],
        };
      });

      renderActiveSchedules();
      updateTime();
      setGreeting();
      setInterval(updateTime, 1000);
      setInterval(renderActiveSchedules, 1000);
    } catch (error) {
      console.error(error);
      showErrorUI(error);
    }
  }

  function parseCSV(text) {
    const arr = [];
    let quote = false;
    let row = 0,
      col = 0;
    arr[row] = [];
    arr[row][col] = "";
    for (let c = 0; c < text.length; c++) {
      let cc = text[c],
        nc = text[c + 1];
      if (cc === '"') {
        if (quote && nc === '"') {
          arr[row][col] += cc;
          c++;
        } else {
          quote = !quote;
        }
      } else if (cc === "," && !quote) {
        col++;
        arr[row][col] = "";
      } else if (cc === "\n" && !quote) {
        row++;
        col = 0;
        arr[row] = [];
        arr[row][col] = "";
      } else {
        if (cc !== "\r") arr[row][col] += cc;
      }
    }
    const headers = arr[0].map((h) => h.trim());
    return arr
      .slice(1)
      .filter((r) => r.length > 1)
      .map((values) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] ? values[i].trim() : "";
        });
        return obj;
      });
  }

  function showErrorUI(error) {
    els.scheduleContainer.innerHTML = `
      <div class="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
        <h2 class="text-xl font-bold text-red-700 mb-2">⚠️ Gagal Memuat Jadwal</h2>
        <p class="text-red-600 mb-4">${error.message}</p>
        <p class="text-sm text-gray-500">Silakan refresh halaman atau hubungi admin.</p>
      </div>`;
    els.scheduleContainer.classList.remove("hidden");
    els.placeholder.classList.add("hidden");
  }

  function toSebLink(url) {
    if (!url) return "#";
    try {
      const absoluteUrl = new URL(url, window.location.href).href;
      return absoluteUrl.replace(/^https?:/, "sebs:");
    } catch (e) {
      return "#";
    }
  }

  function getServerTime() {
    return new Date(Date.now() + serverTimeOffset);
  }

  function updateTime() {
    const now = getServerTime();
    els.clock.textContent = now.toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    els.date.textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(now);
  }

  function setGreeting() {
    const now = getServerTime();
    const jakartaHour = parseInt(
      now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      })
    );

    const morningQuotes = [
      "Ngopi Ndisik Ngab ☕",
      "Awali hari dengan Bismillah ☀️",
      "Urip iku urup 🍲",
    ];
    const noonQuotes = [
      "Kerja Kerja Kerja 🐂",
      "Ojo lali madhang 🍛",
      "Mata ngantuk, perut lapar? 💸",
    ];
    const eveningQuotes = [
      "Wes wektune leyeh-leyeh 💤",
      "Info angkringan bolo? 🍢",
      "Healing tipis-tipis 🥲",
    ];
    const nightQuotes = [
      "Turu is the best therapy 😴",
      "Overthinking Mode: ON 🧠",
      "Besok masih ada hari 🛌",
    ];
    const psychQuotes = [
      '"The good life is a process." - Rogers',
      "Mental health matters 💚",
    ];

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    function getMessage(arr) {
      return Math.random() < 0.2 ? pickRandom(psychQuotes) : pickRandom(arr);
    }

    const greetings = [
      {
        max: 12,
        title: "Sugeng Enjang! ☀️",
        body: getMessage(morningQuotes),
        theme: "yellow",
      },
      {
        max: 15,
        title: "Sugeng Siang! 🕶️",
        body: getMessage(noonQuotes),
        theme: "blue",
      },
      {
        max: 18,
        title: "Sugeng Sonten! 🌆",
        body: getMessage(eveningQuotes),
        theme: "indigo",
      },
      {
        max: 24,
        title: "Have a Nice Dream! 🌙",
        body: getMessage(nightQuotes),
        theme: "gray",
      },
    ];

    const greet = greetings.find((g) => jakartaHour < g.max);
    if (greet) {
      els.msgTitle.textContent = greet.title;
      els.msgBody.textContent = greet.body;
      updateDashboardTheme(greet.theme);
    }
  }

  function updateDashboardTheme(theme) {
    const dashboard = document.getElementById("time-dashboard");
    if (!dashboard) return;

    dashboard.className =
      "w-full p-8 md:p-12 rounded-2xl shadow-xl border text-center mb-12 transition-all duration-500";

    const themes = {
      yellow:
        "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-700",
      blue: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-700",
      indigo:
        "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-100 dark:border-indigo-700",
      gray: "bg-gray-800 text-white border-gray-600 dark:bg-black dark:border-gray-800",
    };

    dashboard.classList.add(...themes[theme].split(" "));
  }

  let lastRenderedHTML = null;
  function renderActiveSchedules() {
    if (!EXAM_DATA.length) return;
    const now = getServerTime();
    let activeCount = 0;
    let htmlContent = "";

    EXAM_DATA.forEach((schedule) => {
      const fiveMinutesMillis = 5 * 60 * 1000;
      const earlyStart = new Date(schedule.start.getTime() - fiveMinutesMillis);
      const lateFinish = new Date(schedule.end.getTime() + fiveMinutesMillis);

      if (now >= earlyStart && now < lateFinish) {
        // if (true) {
        activeCount++;
        const rows = schedule.courses
          .map(
            (course) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td class="p-4 align-top">
                    <div class="flex items-center gap-3">
    <a href="${toSebLink(course.link)}" 
       class="text-lg font-bold text-seb hover:text-seb-dark dark:text-purple-400 dark:hover:text-purple-300 transition-colors">
        ${course.name}
    </a>

    <a href="${course.link}" 
       class="animate-pulse inline-flex items-center justify-center p-1.5 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
       title="unduh">
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m-6 3.75 3 3m0 0 3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5a2.25 2.25 0 0 1-2.25-2.25v-.75"></path>
       </svg>
    </a>
</div>
                </td>
                <td class="p-4 align-top">
                    <ol class="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        ${course.lecturers.map((l) => `<li>${l}</li>`).join("")}
                    </ol>
                </td>
                <td class="p-4 align-top whitespace-nowrap text-gray-700 dark:text-gray-300">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ${course.time}
                        <span class="inline-block px-2 py-1 text-[10px] font-semibold rounded bg-gray-100 text-blue-500 dark:bg-gray-700 dark:text-blue-400">
                        ${course.duration}
                        </span>
                    </div>
                </td>
                <td class="p-4 align-top text-gray-700 dark:text-gray-300">
                    <a href="${toSebLink(
                      course.link
                    )}"class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                        ${course.method}
                    </a>
                    <div class="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">Closedbook</div>
                </td>
            </tr>
        `
          )
          .join("");

        htmlContent += `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 animate-fade-in">
                <div class="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <svg class="w-5 h-5 text-seb" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path></svg>
                        ${schedule.dateTitle}
                    </h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50 dark:bg-gray-700 uppercase text-gray-500 dark:text-gray-400 font-medium text-xs">
                            <tr>
                                <th class="p-4 w-1/3">Mata Kuliah</th>
                                <th class="p-4">Pengampu</th>
                                <th class="p-4">Waktu</th>
                                <th class="p-4">Metode</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
      }
    });

    if (htmlContent !== lastRenderedHTML) {
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
      els.darkIcon.classList.add("hidden");
      els.lightIcon.classList.remove("hidden");
    } else {
      document.documentElement.classList.remove("dark");
      els.darkIcon.classList.remove("hidden");
      els.lightIcon.classList.add("hidden");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  const savedTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  toggleTheme(savedTheme ? savedTheme === "dark" : systemDark);

  els.themeBtn.addEventListener("click", () => {
    const isCurrentDark = document.documentElement.classList.contains("dark");
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

  initData();
});
