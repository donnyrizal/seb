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
        const originalLink = row.Link || "";
        const lowerLink = originalLink.toLowerCase();
        let finalMethod = "SEB";
        let finalLink = toSebLink(originalLink);

        if (lowerLink.includes("myujian")) {
          finalMethod = "MyUjian";
          finalLink = "https://myujian.ums.ac.id";
        } else if (lowerLink.includes("spada")) {
          finalMethod = "SPADA";
          finalLink = "https://spada12.ums.ac.id";
        }

        if (isNaN(startDate.getTime())) {
          console.error(
            `🚨 FATAL: Could not parse date for ${row.Course}. Raw: '${row.Date}' -> Parsed: '${startStr}'`
          );
        }

        let lecturersList = [];
        if (row.Lecturers) {
          const rawLec = row.Lecturers.trim();
          if (rawLec.match(/\r?\n/)) {
            lecturersList = rawLec.split(/\r?\n/);
          } else if (rawLec.includes('", "')) {
            lecturersList = rawLec.split('", "');
          } else {
            lecturersList = [rawLec];
          }
          lecturersList = lecturersList.map((name) => {
            return name.trim().replace(/^["']+|["']+$/g, "");
          });
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
              lecturers: lecturersList,
              time: `${cleanStart}-${cleanEnd} WIB (${duration})`,
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

    // 1. Update Clock
    els.clock.textContent = now.toLocaleTimeString("en-GB", {
      hour12: false,
      timeZone: "Asia/Jakarta",
    });

    // 2. Update Date
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
  }

  function setGreeting() {
    // Calculate the hour just for the greeting logic
    const now = getServerTime();
    const jakartaHour = parseInt(
      now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      })
    );

    // --- YOUR QUOTE ARRAYS (Moved here) ---
    const morningQuotes = [
      "Ngopi Ndisik Ngab ☕",
      "Awali hari dengan Bismillah ☀️",
      "Hey Kevin! 🥒",
      "Sarapan dulu, biar kuat menghadapi kenyataan 🍳",
      "Kerja mulu, kaya kagak",
      "Urip iku urup, jangan lupa sarapan sup 🍲",
    ];

    const noonQuotes = [
      "Selesai ga selesai kumpulkan",
      "Jare Pakdhe Jokowi, Kerja Kerja Kerja 🐂",
      "Hidup gua emang ga enak, tapi ada mie ayam",
      "Panas kenthang-kenthang, tetep semangat sayang 🥵",
      "Ojo lali madhang 🍛",
      "datang kerjakan lupakan",
      "Mata ngantuk, perut lapar, dompet aman? 💸",
      "Harta, Tahta, Tatjana",
    ];

    const eveningQuotes = [
      "Wes wektune leyeh-leyeh 💤",
      "Senja telah tiba, tugas belum reda 🌆",
      "Info angkringan bolo? 🍢",
      "Muliho, wes digoleki makmu",
      "Yeah you are, the brightest star in my sky 🌟",
      "Healing tipis-tipis sebelum besok nangis 🥲",
    ];

    const nightQuotes = [
      "🌠 Only in the darkness can you see the stars ✨",
      "Turu is the best therapy 😴",
      "ingat skripsi ingat mantan",
      "Overthinking Mode: ON 🧠",
      "Matikan HP, Nyalakan Mimpi 🌌",
      "Besok masih ada hari, istirahatlah 🛌",
    ];

    const psychQuotes = [
      '"The good life is a process, not a state of being." - Carl Rogers',
      '"He who has a why to live can bear almost any how." - Nietzsche',
      '"Your vision will become clear only when you can look into your own heart." - Carl Jung',
      "Without effort, your talent is nothing more than your unmet potential — Angela Duckworth, PhD",
      "Mental health matters, take a break if you need to 💚",
      "The worst temptation is instant gratification ― Jon Luvelli",
      "I'm selfish, impatient and a little insecure. I make mistakes, I am out of control and at times hard to handle. But if you can't handle me at my worst, then you sure as hell don't deserve me at my best.― Marilyn Monroe",
    ];

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function getMessage(timeSpecificArray) {
      // 20% chance to show a smart quote
      if (Math.random() < 0.2) {
        return pickRandom(psychQuotes);
      }
      return pickRandom(timeSpecificArray);
    }

    const greetings = [
      {
        max: 12,
        title: "Sugeng Enjang! ☀️",
        body: getMessage(morningQuotes),
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-200",
      },
      {
        max: 15,
        title: "Sugeng Siang! 🕶️",
        body: getMessage(noonQuotes),
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
      },
      {
        max: 18,
        title: "Sugeng Sonten! 🌆",
        body: getMessage(eveningQuotes),
        bg: "bg-indigo-100",
        text: "text-indigo-800",
        border: "border-indigo-200",
      },
      {
        max: 24,
        title: "Have a Nice Dream! 🌙",
        body: getMessage(nightQuotes),
        bg: "bg-gray-800",
        text: "text-gray-100",
        border: "border-gray-600",
      },
    ];

    // Find the correct greeting object
    const greet = greetings.find((g) => jakartaHour < g.max);

    if (greet) {
      els.msgTitle.textContent = greet.title;
      els.msgBody.textContent = greet.body;

      // Update Dashboard Colors
      const dashboard = document.getElementById("time-dashboard");
      // Safety check in case dashboard element isn't found
      if (dashboard) {
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
  }

  let lastRenderedHTML = "";
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
                    <tr>
                        <td>
                            <a class="seb" href="${toSebLink(course.link)}">${
              course.name
            }</a>
                            <a href="${
                              course.link
                            }" class="inline-flex items-center justify-center p-1 text-base font-medium text-gray-500 rounded-lg bg-gray-50 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m-6 3.75 3 3m0 0 3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5a2.25 2.25 0 0 1-2.25-2.25v-.75" />
</svg>


                            </a>
                        </td>
                        <td>
    <ol class="list-decimal pl-4 space-y-1">
        ${course.lecturers.map((l) => `<li>${l}</li>`).join("")}
    </ol>
</td>
                        <td>${course.time}</td>
                        <td>Online via <b>
                             <a href="${
                               course.link
                             }" target="_blank" class="hover:underline text-blue-600 dark:text-blue-400">
                               ${course.method} (Closedbook)
                             </a>
                           </b>
                           </td>
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
