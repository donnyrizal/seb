document.addEventListener("DOMContentLoaded", () => {
  const els = {
    container: document.getElementById("upcoming-container"),
    loader: document.getElementById("loading-spinner"),
    empty: document.getElementById("empty-state"),
    themeBtn: document.getElementById("theme-toggle"),
    darkIcon: document.getElementById("theme-toggle-dark-icon"),
    lightIcon: document.getElementById("theme-toggle-light-icon"),
    body: document.body,
  };

  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLFzIPXW64oTw6dcpH0g-Y4H_w2EFGx4tYTSvzlTM_G16bL68NnDeAUFQqDzTXvd9sSPlkw_0Iqm3X/pub?gid=1005242582&single=true&output=csv";
  let EXAM_DATA = [];
  async function initData() {
    try {
      const response = await fetch(SHEET_URL);
      if (!response.ok) throw new Error("Gagal mengambil data");

      const csvText = await response.text();
      const rawRows = parseCSV(csvText);
      EXAM_DATA = rawRows
        .map((row) => {
          let datePart = cleanDate(row.Date);
          const cleanStart = row.Start.trim().padStart(5, "0");
          const cleanEnd = row.End.trim().padStart(5, "0");
          const startStr = `${datePart}T${cleanStart}:00+07:00`;
          const endStr = `${datePart}T${cleanEnd}:00+07:00`;

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
            dateRaw: datePart,
            dateTitle: new Date(startStr).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            start: new Date(startStr),
            end: new Date(endStr),
            course: row.Course,
            lecturers: lecturersList,
            duration: row["Waktu Ujian"],
            method: determineMethod(row.Link),
          };
        })
        .filter((item) => !isNaN(item.start.getTime()));

      renderUpcoming();
      els.loader.classList.add("hidden");
    } catch (error) {
      console.error(error);
      els.loader.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
    }
  }

  function renderUpcoming() {
    const now = new Date();

    // MODIFIED: Do not filter out past events.
    // Instead, sort all events chronologically.
    const allEvents = [...EXAM_DATA];
    allEvents.sort((a, b) => a.start - b.start);

    if (allEvents.length === 0) {
      els.empty.classList.remove("hidden");
      return;
    }

    const grouped = allEvents.reduce((acc, item) => {
      (acc[item.dateTitle] = acc[item.dateTitle] || []).push(item);
      return acc;
    }, {});

    let htmlContent = "";

    Object.keys(grouped).forEach((dateKey) => {
      const items = grouped[dateKey];

      const cardsHtml = items
        .map((item) => {
          // MODIFIED: Check if event is finished
          const isFinished = item.end < now;

          // Styles for finished vs upcoming
          const cardClasses = isFinished
            ? "card-finished border-gray-100 dark:border-gray-800"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";

          const titleDecoration = isFinished
            ? "line-through text-gray-500 dark:text-gray-500"
            : "text-gray-900 dark:text-white";

          const timeColor = isFinished
            ? "text-gray-400"
            : "text-gray-800 dark:text-white";

          const badgeStatus = isFinished
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 ml-2">Sudah Selesai</span>`
            : ``;

          // Disable button visual if finished
          const btnOpacity = isFinished
            ? "opacity-50 grayscale cursor-not-allowed"
            : "hover:scale-105 hover:shadow-md";

          return `
                  <div class="course-card relative flex flex-col md:flex-row rounded-xl p-6 border mb-4 gap-6 shadow-sm ${cardClasses} transition-all">
                      
                      <div class="md:w-1/4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-4 md:pb-0 md:pr-4">
                          <span class="text-2xl font-bold ${timeColor}">
                              ${formatTime(item.start)}
                          </span>
                          <span class="text-sm text-gray-500 dark:text-gray-400">
                              s.d. ${formatTime(item.end)} WIB
                          </span>
                          <span class="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 w-fit ${
                            isFinished ? "opacity-50" : ""
                          }">
                              ${item.duration}
                          </span>
                      </div>

                      <div class="md:w-3/4 flex flex-col justify-center">
                          <div class="flex justify-between items-start mb-2">
                              <div class="flex-1">
                                <h3 class="text-xl font-bold leading-tight ${titleDecoration}">
                                    ${item.course}${badgeStatus}
                                </h3>
                                
                              </div>
                              
                              <a href="${item.method.url}" 
                                 target="_blank"
                                 class="badge-link shrink-0 inline-flex items-center px-3 py-1 text-xs font-bold rounded-full transition-transform shadow-sm ${btnOpacity} ${getMethodColor(
            item.method.name
          )}">
                                  ${item.method.name} 
                                  <svg class="w-3 h-3 ml-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                              </a>
                          </div>
                          
                          <div class="mt-2 ${isFinished ? "opacity-60" : ""}">
                              <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Pengampu</p>
                              <ul class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                  ${item.lecturers
                                    .map(
                                      (l) =>
                                        `<li class="flex items-center"><svg class="w-3 h-3 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>${l}</li>`
                                    )
                                    .join("")}
                              </ul>
                          </div>
                      </div>
                  </div>
                `;
        })
        .join("");

      htmlContent += `
                  <div class="date-group">
                      <div class="timeline-date-sticky flex items-center justify-between">
                          <h2 class="text-lg md:text-xl font-bold text-indigo-600 dark:text-indigo-400 bg-white/50 dark:bg-gray-900/50 px-2 rounded">
                              ${dateKey}
                          </h2>
                          <span class="text-xs font-medium text-gray-400 px-2 border border-gray-200 dark:border-gray-700 rounded-full">
                              ${items.length} Matkul
                          </span>
                      </div>
                      ${cardsHtml}
                  </div>
                `;
    });

    els.container.innerHTML = htmlContent;
    els.container.classList.remove("hidden");
  }

  function cleanDate(datePart) {
    if (datePart && datePart.includes("/")) {
      const parts = datePart.split("/");
      return parts.length === 3
        ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(
            2,
            "0"
          )}`
        : datePart;
    }
    return datePart;
  }
  function formatTime(dateObj) {
    return dateObj.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  function determineMethod(link) {
    if (!link) return { name: "Offline / TBC", url: "#" };
    const l = link.toLowerCase();
    if (l.includes("myujian"))
      return { name: "MyUjian", url: "https://myujian.ums.ac.id" };
    if (l.includes("spada"))
      return { name: "SPADA", url: "https://spada12.ums.ac.id" };
    return { name: "SEB", url: "https://donnyrizal.github.io/seb" };
  }
  function getMethodColor(methodName) {
    if (methodName === "MyUjian")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-800";
    if (methodName === "SPADA")
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-800";
    return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800";
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
      } else if (cc !== "\r") {
        arr[row][col] += cc;
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
  function toggleTheme(isDark) {
    if (isDark) {
      document.documentElement.classList.add("dark");
      els.body.classList.add("night-mode");
      els.darkIcon.classList.add("hidden");
      els.lightIcon.classList.remove("hidden");
    } else {
      document.documentElement.classList.remove("dark");
      els.body.classList.remove("night-mode");
      els.darkIcon.classList.remove("hidden");
      els.lightIcon.classList.add("hidden");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  els.themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark");
    toggleTheme(!isDark);
  });

  const savedTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  toggleTheme(savedTheme ? savedTheme === "dark" : systemDark);
  initData();
});
