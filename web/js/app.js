const API_URL = "https://my-site-api.basbas0513.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {

    const loginBtn = document.getElementById("loginBtn");
    const profileLoginBtn = document.getElementById("profileLoginBtn");

    function openLogin() {
        window.location.href = "login.html";
    }

    loginBtn?.addEventListener("click", openLogin);
    profileLoginBtn?.addEventListener("click", openLogin);


    // ตรวจสอบว่าผู้ใช้ Login อยู่หรือไม่
    try {

        const response = await fetch(
            `${API_URL}/auth/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (response.ok && data.ok) {

            // เปลี่ยนปุ่ม Login เป็นชื่อผู้ใช้
            if (loginBtn) {
                loginBtn.textContent = data.user.username;
                loginBtn.removeEventListener("click", openLogin);
            }

            // เปลี่ยนส่วน Profile
            if (profileLoginBtn) {
                profileLoginBtn.textContent = data.user.username;
                profileLoginBtn.removeEventListener("click", openLogin);
            }

        }

    } catch (error) {

        console.error("AUTH CHECK ERROR:", error);

    }


    // ปุ่มเกม
    document.querySelectorAll(".play-btn").forEach((button) => {

        button.addEventListener("click", () => {

            const game = button.dataset.game;

            alert(`เกม ${game} จะเปิดในขั้นตอนถัดไป`);

        });

    });

});