const API_URL = "https://my-site-api.basbas0513.workers.dev";

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {

    const loginBtn = document.getElementById("loginBtn");
    const profileLoginBtn = document.getElementById("profileLoginBtn");
    const profileAvatar = document.getElementById("profileAvatar");
    const profileUsername = document.getElementById("profileUsername");
    const profileDescription = document.getElementById("profileDescription");
    const profileModal = document.getElementById("profileModal");
    const profileBackdrop = document.getElementById("profileBackdrop");
    const profileCloseBtn = document.getElementById("profileCloseBtn");
    const profileLoading = document.getElementById("profileLoading");
    const profileError = document.getElementById("profileError");
    const profileFields = document.getElementById("profileFields");
    const modalProfileUsername = document.getElementById("modalProfileUsername");

    function openLogin() {
        window.location.href = "login.html";
    }

    function formatProfileName(key) {
        return String(key)
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
    }

function formatProfileValue(value, key = "") {

    if (
        value === null ||
        value === undefined
    ) {
        return "-";
    }

    // Timestamp จาก database
    if (
        typeof value === "number" &&
        (
            key === "created_at" ||
            key === "updated_at"
        )
    ) {
        return new Date(value).toLocaleString(
            "th-TH",
            {
                dateStyle: "medium",
                timeStyle: "medium"
            }
        );
    }

    if (typeof value === "boolean") {
        return value ? "ใช่" : "ไม่ใช่";
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

    function renderUserProfile(user) {
        profileFields.innerHTML = "";

        Object.entries(user).forEach(([key, value]) => {
            const row = document.createElement("div");
            row.className = "profile-field";

            const name = document.createElement("div");
            name.className = "profile-field-name";
            name.textContent = formatProfileName(key);

            const val = document.createElement("div");
            val.className = "profile-field-value";
            val.textContent = formatProfileValue(value);

            row.append(name, val);
            profileFields.appendChild(row);
        });
    }

    async function openUserProfile(username) {
        if (!username) return;

        username = String(username).trim();
        if (!username) return;

        profileModal?.classList.add("show");
        profileModal?.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        modalProfileUsername.textContent = username;
        profileLoading.style.display = "block";
        profileError.style.display = "none";
        profileFields.innerHTML = "";

        try {
            const response = await fetch(
                `${API_URL}/users/${encodeURIComponent(username)}`,
                { method: "GET", credentials: "include" }
            );

            const data = await response.json();

            if (!response.ok || !data.ok || !data.user) {
                throw new Error(data.error || "User not found");
            }

            modalProfileUsername.textContent = data.user.username || username;
            renderUserProfile(data.user);
            profileLoading.style.display = "none";

        } catch (error) {
            console.error("PROFILE ERROR:", error);
            profileLoading.style.display = "none";
            profileError.style.display = "block";
        }
    }

    function closeUserProfile() {
        profileModal?.classList.remove("show");
        profileModal?.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    async function logout() {
        try {
            const response = await fetch(
                `${API_URL}/auth/logout`,
                { method: "POST", credentials: "include" }
            );

            const data = await response.json();
            if (response.ok && data.ok) window.location.reload();
        } catch (error) {
            console.error("LOGOUT ERROR:", error);
        }
    }

    // ปุ่ม Login / Profile เดิม
    loginBtn?.addEventListener("click", openLogin);
    profileLoginBtn?.addEventListener("click", openLogin);

    // ตรวจสอบ Session
    try {
        const response = await fetch(
            `${API_URL}/auth/me`,
            { method: "GET", credentials: "include" }
        );

        const data = await response.json();

        if (response.ok && data.ok && data.user) {
            currentUser = data.user;
            const username = currentUser.username;

            // ชื่อด้านขวาบน = ปุ่มเปิด Profile ของ user นั้น
            if (loginBtn) {
                loginBtn.textContent = username;
                loginBtn.classList.add("user-profile-clickable");
                loginBtn.removeEventListener("click", openLogin);
                loginBtn.addEventListener("click", () => openUserProfile(username));
            }

            if (profileAvatar) {
                profileAvatar.textContent = username.charAt(0).toUpperCase();
            }

            if (profileUsername) {
                profileUsername.textContent = username;
                profileUsername.classList.add("user-profile-clickable");
                profileUsername.title = "เปิดโปรไฟล์";
                profileUsername.addEventListener("click", () => openUserProfile(username));
            }

            if (profileDescription) {
                profileDescription.textContent =
                    "เข้าสู่ระบบแล้ว คลิกชื่อเพื่อดูข้อมูลโปรไฟล์";
            }

            if (profileLoginBtn) {
                profileLoginBtn.textContent = "ออกจากระบบ";
                profileLoginBtn.removeEventListener("click", openLogin);
                profileLoginBtn.addEventListener("click", logout);
            }
        }
    } catch (error) {
        console.error("AUTH CHECK ERROR:", error);
    }

    // คลิกคำว่า "โปรไฟล์" ในเมนู = เปิด Profile UI
    document.querySelectorAll('.nav a[href="#profile"]').forEach(link => {
        link.addEventListener("click", event => {
            if (!currentUser) return;
            event.preventDefault();
            openUserProfile(currentUser.username);
        });
    });

    // คลิกปุ่มโปรไฟล์ใน Hero = เปิด Profile UI
    document.querySelectorAll('a[href="#profile"].btn').forEach(link => {
        link.addEventListener("click", event => {
            if (!currentUser) return;
            event.preventDefault();
            openUserProfile(currentUser.username);
        });
    });

    profileCloseBtn?.addEventListener("click", closeUserProfile);
    profileBackdrop?.addEventListener("click", closeUserProfile);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && profileModal?.classList.contains("show")) {
            closeUserProfile();
        }
    });

    // ปุ่มเกม
    document.querySelectorAll(".play-btn").forEach(button => {
        button.addEventListener("click", () => {
            const game = button.dataset.game;
            alert(`เกม ${game} จะเปิดในขั้นตอนถัดไป`);
        });
    });
});
