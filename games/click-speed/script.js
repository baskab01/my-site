/* =========================================================
   BAS LAB GAME
   click-speed/script.js
   ---------------------------------------------------------
   ตัวเกมทั้งหมดอยู่ในโฟลเดอร์ของเกมนี้
   ========================================================= */

(() => {
  "use strict";

  const API_URL = "https://my-site-api.basbas0513.workers.dev";
  const GAME_ID = "click-speed";
  const GAME_TIME_MS = 10000;

  const clickBtn = document.getElementById("clickBtn");
  const startBtn = document.getElementById("startBtn");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const resultEl = document.getElementById("result");

  let score = 0;
  let endTime = 0;
  let timer = null;
  let running = false;
  let sent = false;

  async function saveScore(finalScore) {
    if (sent) return;
    sent = true;

    try {
      const token = sessionStorage.getItem("basSessionToken");
      const headers = {
        "Content-Type": "application/json"
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/stats/game`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          game: GAME_ID,
          score: finalScore
        })
      });

      if (!response.ok) {
        console.warn("GAME STATS:", response.status);
      }
    } catch (error) {
      console.warn("GAME STATS:", error);
    }
  }

  function finishGame() {
    if (!running) return;

    running = false;
    clearInterval(timer);
    timer = null;

    clickBtn.disabled = true;
    clickBtn.textContent = "หมดเวลา!";
    startBtn.textContent = "เล่นอีกครั้ง";

    const clicksPerSecond = score / (GAME_TIME_MS / 1000);

    resultEl.innerHTML = `
      <strong>จบเกม!</strong><br>
      คุณกดได้ <b>${score}</b> ครั้ง<br>
      ความเร็วเฉลี่ย <b>${clicksPerSecond.toFixed(1)} คลิก/วินาที</b>
    `;

    resultEl.classList.remove("hidden");
    saveScore(score);
  }

  function updateTime() {
    const remaining = Math.max(0, endTime - performance.now());
    timeEl.textContent = (remaining / 1000).toFixed(1);

    if (remaining <= 0) {
      finishGame();
    }
  }

  function startGame() {
    clearInterval(timer);

    score = 0;
    sent = false;
    running = true;
    endTime = performance.now() + GAME_TIME_MS;

    scoreEl.textContent = "0";
    timeEl.textContent = "10.0";
    resultEl.classList.add("hidden");

    clickBtn.disabled = false;
    clickBtn.textContent = "คลิก!!!";
    startBtn.textContent = "กำลังเล่น...";

    timer = setInterval(updateTime, 50);
    clickBtn.focus();
  }

  clickBtn.addEventListener("click", () => {
    if (!running) return;
    score++;
    scoreEl.textContent = score;
  });

  startBtn.addEventListener("click", startGame);
})();
