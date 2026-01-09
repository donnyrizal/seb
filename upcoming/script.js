tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            fontFamily: {
              sans: ["Montserrat", "sans-serif"],
            },
            colors: {
              brand: {
                light: "#9d4dff",
                DEFAULT: "#7f00ff",
                dark: "#6002ee",
              },
            },
          },
        },
      };

document.addEventListener("DOMContentLoaded", () => {
        const els = {
          upcomingContainer: document.getElementById("upcoming-container"),
          upcomingWrapper: document.getElementById("upcoming-wrapper"),
          historyContainer: document.getElementById("history-container"),
          historyWrapper: document.getElementById("history-wrapper"),
          statsContainer: document.getElementById("stats-container"),
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

            processAndRender();
            els.loader.classList.add("hidden");
          } catch (error) {
            console.error(error);
            els.loader.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
          }
        }

        function processAndRender() {
          const now = new Date();
                 const sortedEvents = [...EXAM_DATA].sort((a, b) => a.start - b.start);
          const upcomingEvents = sortedEvents.filter(item => item.end >= now);
          const historyEvents = sortedEvents.filter(item => item.end < now);
          renderStats(upcomingEvents, historyEvents);
          if (upcomingEvents.length > 0) {
              renderGroupedEvents(upcomingEvents, els.upcomingContainer, false);
              els.upcomingWrapper.classList.remove("hidden");
              els.empty.classList.add("hidden");
          } else {
              els.upcomingWrapper.classList.add("hidden");
              els.empty.classList.remove("hidden");
          }
          if (historyEvents.length > 0) {
              const reversedHistory = [...historyEvents].sort((a, b) => b.end - a.end);
              renderGroupedEvents(reversedHistory, els.historyContainer, true);
              els.historyWrapper.classList.remove("hidden");
          }
        }

        function renderStats(upcoming, history) {
          const nextExam = upcoming.length > 0 ? upcoming[0] : null;
          const remainingCount = upcoming.length;
          const finishedCount = history.length;

          let nextExamHTML = `
              <div class="text-gray-500 dark:text-gray-400 text-sm">Tidak ada jadwal</div>
              <div class="text-xl font-bold text-gray-800 dark:text-gray-200">-</div>
          `;

          if (nextExam) {
              const diffTime = nextExam.start - new Date();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              let dayLabel = "";
              if (diffDays <= 0) {
                  dayLabel = "Hari Ini!";
              } else if (diffDays === 1) {
                  dayLabel = "Next";
              } else {
                  dayLabel = `${diffDays} Hari Lagi`;
              }
              
              nextExamHTML = `
                  <div class="flex justify-between items-start mb-2">
                      <div class="text-brand dark:text-brand-light text-xs font-bold uppercase tracking-wider">Ujian Berikutnya</div>
                      <span class="bg-brand/10 text-brand dark:text-brand-light text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${dayLabel}</span>
                  </div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white truncate leading-tight" title="${nextExam.course}">${nextExam.course}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      ${nextExam.dateTitle.split(',')[0]}, ${formatTime(nextExam.start)} - ${formatTime(nextExam.end)}
                  </div>
              `;
          }

          els.statsContainer.innerHTML = `
              <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                  <div class="absolute left-0 top-0 h-full w-1 bg-brand"></div>
                  ${nextExamHTML}
              </div>

              <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center hover:shadow-md transition-all">
                   <div class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Sisa Ujian</div>
                   <div class="text-3xl font-bold text-gray-800 dark:text-white">${remainingCount} <span class="text-sm font-normal text-gray-400">Matkul</span></div>
              </div>

              <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center hover:shadow-md transition-all">
                   <div class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Sudah Selesai</div>
                   <div class="text-3xl font-bold text-green-600 dark:text-green-400">${finishedCount} <span class="text-sm font-normal text-gray-400">Matkul</span></div>
              </div>
          `;
          els.statsContainer.classList.remove('hidden');
        }

        function renderGroupedEvents(events, container, isHistory) {
          const grouped = events.reduce((acc, item) => {
            (acc[item.dateTitle] = acc[item.dateTitle] || []).push(item);
            return acc;
          }, {});

          let htmlContent = "";

          Object.keys(grouped).forEach((dateKey) => {
            const items = grouped[dateKey];

            const cardsHtml = items
              .map((item) => {
                const containerClass = isHistory 
                  ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-800 grayscale-[0.8] opacity-75 hover:opacity-100" 
                  : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-brand/30 dark:hover:border-brand/30";
                
                const titleColor = isHistory ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white";
                
                const badge = isHistory 
                  ? `<div class="mb-2"><span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Selesai
                     </span></div>` 
                  : ``;

                const btnClass = isHistory ? "hidden" : `badge-link inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg transition-all hover:scale-105 hover:shadow-md ${getMethodColor(item.method.name)}`;

                return `
                  <div class="course-card relative flex flex-col md:flex-row rounded-xl border p-5 gap-4 md:gap-6 ${containerClass} transition-all duration-300 group">
                      
                      <!-- Time Column -->
                      <div class="md:w-28 md:flex-shrink-0 flex flex-row md:flex-col items-center md:items-start md:justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-3 md:pb-0 md:pr-4 gap-3 md:gap-0">
                          <div class="text-center md:text-left">
                              <span class="block text-xl font-bold ${isHistory ? 'text-gray-400' : 'text-gray-800 dark:text-white'}">
                                  ${formatTime(item.start)} -
                              </span>
                              <span class="block text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
                                 ${formatTime(item.end)} WIB
                              </span>
                          </div>
                          <div class="hidden md:block w-full h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
                          <span class="inline-block px-2 py-1 text-[10px] font-semibold rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              ${item.duration}
                          </span>
                      </div>

                      <!-- Content Column -->
                      <div class="flex-1 flex flex-col justify-center">
                          <div class="flex flex-col md:flex-row justify-between md:items-start gap-4">
                              <div>
                                  ${badge}
                                  <h3 class="text-lg md:text-xl font-bold leading-tight ${titleColor} mb-2">
                                      ${item.course}
                                  </h3>
                                  <!-- Lecturers -->
                                   <div class="flex flex-wrap gap-2">
                                      ${item.lecturers.map(l => 
                                          `<span class="inline-flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded">
                                              <svg class="w-3 h-3 mr-1 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                                              ${l}
                                          </span>`
                                      ).join('')}
                                   </div>
                              </div>
                              
                              <!-- Action Button -->
                              <div class="flex-shrink-0 mt-2 md:mt-0">
                                   <a href="${item.method.url}" 
                                      target="_blank"
                                      class="${btnClass}">
                                      <span>${item.method.name}</span>
                                      <svg class="w-3 h-3 ml-2 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                  </a>
                              </div>
                          </div>
                      </div>
                  </div>
                `;
              })
              .join("");

            htmlContent += `
              <div class="mb-8 last:mb-0">
                  <h4 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 ml-1 flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full ${isHistory ? 'bg-gray-300 dark:bg-gray-600' : 'bg-brand'}"></span>
                      ${dateKey}
                  </h4>
                  <div class="space-y-3">
                      ${cardsHtml}
                  </div>
              </div>
            `;
          });

          container.innerHTML = htmlContent;
        }

        function cleanDate(datePart) {
          if (datePart && datePart.includes("/")) {
            const parts = datePart.split("/");
            return parts.length === 3
              ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2,"0")}`
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
            return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800";
          if (methodName === "SPADA")
            return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border border-orange-200 dark:border-orange-800";
          return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border border-purple-200 dark:border-purple-800";
        }
        function parseCSV(text) {
          const arr = [];
          let quote = false;
          let row = 0, col = 0;
          arr[row] = [];
          arr[row][col] = "";
          for (let c = 0; c < text.length; c++) {
            let cc = text[c], nc = text[c + 1];
            if (cc === '"') {
              if (quote && nc === '"') { arr[row][col] += cc; c++; } 
              else { quote = !quote; }
            } else if (cc === "," && !quote) {
              col++; arr[row][col] = "";
            } else if (cc === "\n" && !quote) {
              row++; col = 0; arr[row] = []; arr[row][col] = "";
            } else if (cc !== "\r") {
              arr[row][col] += cc;
            }
          }
          const headers = arr[0].map((h) => h.trim());
          return arr.slice(1).filter((r) => r.length > 1).map((values) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = values[i] ? values[i].trim() : ""; });
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
