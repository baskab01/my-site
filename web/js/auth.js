const API_URL = "https://my-site-api.basbas0513.workers.dev";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const message = document.getElementById("loginMessage");

    form?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const username =
            document.getElementById("username").value.trim();

        const password =
            document.getElementById("password").value;

        message.textContent = "กำลังเข้าสู่ระบบ...";

        try {

            const response = await fetch(
                `${API_URL}/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.ok) {
                message.textContent =
                    data.error || "เข้าสู่ระบบไม่สำเร็จ";
                return;
            }

            message.textContent =
                "เข้าสู่ระบบสำเร็จ";

            setTimeout(() => {
                window.location.href = "index.html";
            }, 500);

        } catch (error) {

            console.error(error);

            message.textContent =
                "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        }

    });

});