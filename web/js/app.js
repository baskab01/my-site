const API_URL = "https://my-site-api.basbas0513.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {

    const loginBtn = document.getElementById("loginBtn");
    const profileLoginBtn = document.getElementById("profileLoginBtn");

    const profileAvatar = document.getElementById("profileAvatar");
    const profileUsername = document.getElementById("profileUsername");
    const profileDescription = document.getElementById("profileDescription");


    function openLogin() {
        window.location.href = "login.html";
    }


    loginBtn?.addEventListener("click", openLogin);
    profileLoginBtn?.addEventListener("click", openLogin);


    // ตรวจสอบ Session
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

            const username = data.user.username;


            // Header
            if (loginBtn) {

                loginBtn.textContent = username;

                loginBtn.removeEventListener(
                    "click",
                    openLogin
                );

            }


            // Profile
            if (profileAvatar) {
                profileAvatar.textContent =
                    username.charAt(0).toUpperCase();
            }


            if (profileUsername) {
                profileUsername.textContent =
                    username;
            }


            if (profileDescription) {
                profileDescription.textContent =
                    "เข้าสู่ระบบแล้ว สามารถใช้งานระบบต่าง ๆ ของ BAS LAB ได้";
            }


            if (profileLoginBtn) {

                profileLoginBtn.textContent =
                    "ออกจากระบบ";

                profileLoginBtn.removeEventListener(
                    "click",
                    openLogin
                );

                profileLoginBtn.addEventListener(
                    "click",
                    logout
                );

            }

        }

    } catch (error) {

        console.error(
            "AUTH CHECK ERROR:",
            error
        );

    }


    // Logout
    async function logout() {

        try {

            const response = await fetch(
                `${API_URL}/auth/logout`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const data = await response.json();

            if (response.ok && data.ok) {
                window.location.reload();
            }

        } catch (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

        }

    }


    // ปุ่มเกม
    document.querySelectorAll(".play-btn").forEach((button) => {

        button.addEventListener("click", () => {

            const game = button.dataset.game;

            alert(
                `เกม ${game} จะเปิดในขั้นตอนถัดไป`
            );

        });

    });

});