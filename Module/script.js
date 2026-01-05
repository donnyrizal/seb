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
      // JSON Lama
      // const response = await fetch("./Module/data.json?t=" + Date.now());
      // if (!response.ok) throw new Error("Failed to load schedule data");
      // const rawData = await response.json();
      // EXAM_DATA = rawData.map((item) => ({
      //   ...item,
      //   start: new Date(item.start),
      //   end: new Date(item.end),
      // }));

      // GSheet
      console.log("1. Starting Fetch...");
      const response = await fetch(SHEET_URL);
      console.log("2. Response Status:", response.status); // Debug
      if (!response.ok)
        throw new Error("Gagal mengambil data dari Google Sheets");

      const serverDateHeader = response.headers.get("Date");
      if (serverDateHeader) {
        const serverTime = new Date(serverDateHeader).getTime();
        const clientTime = Date.now();
        serverTimeOffset = serverTime - clientTime;

        console.log(
          "🕒 Time Synced with Server.",
          "Offset:",
          serverTimeOffset,
          "ms",
          "Server Time:",
          new Date(serverTime).toLocaleTimeString()
        );
      } else {
        console.warn(
          "⚠️ Could not fetch Server Date header. Falling back to local time."
        );
      }

      // GSheet
      const csvText = await response.text();
      console.log("3. RAW CSV Data:\n", csvText);
      if (csvText.includes("<!DOCTYPE html>")) {
        console.error(
          "🚨 ERROR: Google returned a webpage, not CSV. Check Publish settings."
        );
        return;
      }

      const rawRows = parseCSV(csvText);
      console.log("4. Parsed Rows:", rawRows);
      EXAM_DATA = rawRows.map((row) => {
        let datePart = row.Date;
        let duration = row["Waktu Ujian"];
        console.log(`Checking Row: ${row.Course} | Raw Date: '${datePart}'`);

        if (datePart.includes("/")) {
          const parts = datePart.split("/");
          if (parts.length === 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];
            datePart = `${year}-${month}-${day}`;
          }
        } else if (datePart.includes(",")) {
          const parts = datePart.split(",");
          if (parts.length === 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];
            datePart = `${year}-${month}-${day}`;
          }
        }

        const cleanStart = row.Start.trim().padStart(5, "0");
        const cleanEnd = row.End.trim().padStart(5, "0");

        const startStr = `${datePart}T${cleanStart}:00+07:00`;
        const endStr = `${datePart}T${cleanEnd}:00+07:00`;

        const startDate = new Date(startStr);
        const endDate = new Date(endStr);

        if (isNaN(startDate.getTime())) {
          console.error(
            `🚨 FATAL: Could not parse date for ${row.Course}. Raw: '${row.Date}' -> Parsed: '${startStr}'`
          );
        }

        return {
          dateTitle: isNaN(startDate.getTime())
            ? "⚠️ Invalid Date Detected"
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
              lecturers: row.Lecturers
                ? row.Lecturers.split("\n").map((l) => l.trim())
                : [],
              time: `${row.Start}-${row.End} WIB (${duration})`,
              link: row.Link,
              method: row.Method,
            },
          ],
        };
      });

      renderActiveSchedules();
      updateTime();
      setInterval(updateTime, 1000);
      setInterval(renderActiveSchedules, 1000);
    } catch (error) {
      console.error(error);
      showErrorUI(error);
    }
  }

  // function parseCSV(text) {
  //   const lines = text.split("\n").filter((line) => line.trim() !== "");
  //   const headers = lines[0].split(",").map((h) => h.trim()); // Get headers (Date, Start, etc)

  //   return lines.slice(1).map((line) => {
  //     const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma but ignore commas inside quotes
  //     const entry = {};
  //     headers.forEach((h, i) => {
  //       // Clean quotes if Excel added them
  //       let val = values[i] ? values[i].trim() : "";
  //       val = val.replace(/^"|"$/g, "");
  //       entry[h] = val;
  //     });
  //     return entry;
  //   });
  // }

  function parseCSV(text) {
    const arr = [];
    let quote = false;
    let row = 0,
      col = 0;
    arr[row] = [];
    arr[row][col] = "";
    for (let c = 0; c < text.length; c++) {
      let cc = text[c];
      let nc = text[c + 1];
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

  function toSebLink(url) {
    if (!url) return "#";
    const absoluteUrl = new URL(url, window.location.href).href;
    return absoluteUrl.replace(/^https?:/, "sebs:");
  }

  function getServerTime() {
    return new Date(Date.now() + serverTimeOffset);
    // return new Date("2026-01-05T08:31:00+07:00");
  }

  function updateTime() {
    const now = getServerTime();
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
    const jakartaHour = parseInt(
      now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      })
    );
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

    const greet = greetings.find((g) => jakartaHour < g.max);

    if (greet) {
      els.msgTitle.textContent = greet.title;
      els.msgBody.textContent = greet.body;
      const dashboard = document.getElementById("time-dashboard");
      const allClasses = [
        "bg-white",
        "dark:bg-gray-800",
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
    const now = getServerTime();
    let activeCount = 0;
    let htmlContent = "";

    EXAM_DATA.forEach((schedule) => {
      if (now >= schedule.start && now < schedule.end) {
        // if (true) {
        activeCount++;
        const rows = schedule.courses
          .map(
            (course) => `
                    <tr>
                        <td>
                            <a class="seb" href="${toSebLink(course.link)}">${
              course.name
            }</a>
                            <a href="${
                              course.link
                            }" class="inline-flex items-center justify-center p-1 text-base font-medium text-gray-500 rounded-lg bg-gray-50 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
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
                        <td>Online via <b>${course.method} (Closedbook)</b></td>
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
  initData();
});
