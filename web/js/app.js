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


    /* =========================
       LOGIN
    ========================= */

    function openLogin() {
        window.location.href = "login.html";
    }


    /* =========================
       FORMAT PROFILE NAME
    ========================= */

    function formatProfileName(key) {

        return String(key)
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

    }


    /* =========================
       FORMAT PROFILE VALUE
    ========================= */

    function formatProfileValue(value, key = "") {

        if (
            value === null ||
            value === undefined
        ) {
            return "-";
        }


        /* =========================
           CREATED AT
        ========================= */

        if (key === "created_at") {

            const createdDate =
                new Date(Number(value));

            if (
                Number.isNaN(
                    createdDate.getTime()
                )
            ) {
                return "-";
            }


            return createdDate.toLocaleString(
                "th-TH",
                {
                    dateStyle: "long",
                    timeStyle: "medium"
                }
            );

        }


        /* =========================
           UPDATED AT
        ========================= */

        if (key === "updated_at") {

            return null;

        }


        /* =========================
           BOOLEAN
        ========================= */

        if (
            typeof value === "boolean"
        ) {

            return value
                ? "ใช่"
                : "ไม่ใช่";

        }


        /* =========================
           OBJECT
        ========================= */

        if (
            typeof value === "object"
        ) {

            try {

                return JSON.stringify(value);

            } catch {

                return String(value);

            }

        }


        return String(value);

    }


    /* =========================
       CALCULATE ACCOUNT AGE
    ========================= */

    function getAccountAge(createdAt) {

        const createdTime =
            Number(createdAt);

        if (
            !Number.isFinite(createdTime)
        ) {
            return "-";
        }


        const now =
            Date.now();


        const difference =
            now - createdTime;


        if (difference < 0) {
            return "0 วัน";
        }


        const days =
            Math.floor(
                difference /
                (1000 * 60 * 60 * 24)
            );


        return `${days.toLocaleString("th-TH")} วัน`;

    }


    /* =========================
       GAME STATISTICS
    ========================= */

    async function getGameStats(username) {

        if (!username) {
            return null;
        }

        try {

            const response =
                await fetch(
                    `${API_URL}/users/${encodeURIComponent(username)}/stats`,
                    {
                        method: "GET",
                        credentials: "include"
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.ok
            ) {
                throw new Error(
                    data.error ||
                    "ไม่สามารถโหลดสถิติเกมได้"
                );
            }

            return data;

        } catch (error) {

            console.error(
                "GAME STATS ERROR:",
                error
            );

            return null;

        }

    }


    /* =========================
       RENDER GAME STATISTICS
    ========================= */

    function renderGameStats(stats) {

        if (!profileFields) {
            return;
        }

        if (!stats) {
            return;
        }


        const title =
            document.createElement("div");

        title.className =
            "profile-section-title";

        title.textContent =
            "GAME STATISTICS";


        profileFields.appendChild(
            title
        );


        const summary =
            stats.summary || {};


        const values = [
            [
                "เกมที่เล่น",
                summary.games_played ?? 0
            ],
            [
                "เล่นทั้งหมด",
                summary.total_plays ?? 0
            ],
            [
                "คะแนนรวม",
                summary.total_score ?? 0
            ],
            [
                "คะแนนสูงสุด",
                summary.highest_score ?? 0
            ]
        ];


        values.forEach(
            ([name, value]) => {

                const row =
                    document.createElement("div");

                row.className =
                    "profile-field";


                const nameElement =
                    document.createElement("div");

                nameElement.className =
                    "profile-field-name";

                nameElement.textContent =
                    name;


                const valueElement =
                    document.createElement("div");

                valueElement.className =
                    "profile-field-value";

                valueElement.textContent =
                    Number(value).toLocaleString(
                        "th-TH"
                    );


                row.append(
                    nameElement,
                    valueElement
                );


                profileFields.appendChild(
                    row
                );

            }
        );


        if (
            Array.isArray(stats.games) &&
            stats.games.length > 0
        ) {

            const gameTitle =
                document.createElement("div");

            gameTitle.className =
                "profile-section-title";

            gameTitle.textContent =
                "GAME DETAILS";


            profileFields.appendChild(
                gameTitle
            );


            stats.games.forEach(
                game => {

                    const row =
                        document.createElement("div");

                    row.className =
                        "profile-field";


                    const nameElement =
                        document.createElement("div");

                    nameElement.className =
                        "profile-field-name";

                    nameElement.textContent =
                        game.game || "-";


                    const valueElement =
                        document.createElement("div");

                    valueElement.className =
                        "profile-field-value";

                    valueElement.textContent =
                        `เล่น ${Number(game.plays || 0).toLocaleString("th-TH")} ครั้ง · คะแนน ${Number(game.score || 0).toLocaleString("th-TH")} · สูงสุด ${Number(game.best_score || 0).toLocaleString("th-TH")}`;


                    row.append(
                        nameElement,
                        valueElement
                    );


                    profileFields.appendChild(
                        row
                    );

                }
            );

        }

    }


    /* =========================
       RECORD GAME RESULT
    ========================= */

    async function recordGameResult(
        game,
        score = 0
    ) {

        if (!currentUser) {
            return {
                ok: false,
                error: "กรุณาเข้าสู่ระบบก่อน"
            };
        }


        if (!game) {
            return {
                ok: false,
                error: "ไม่พบชื่อเกม"
            };
        }


        const numericScore =
            Number(score);


        if (
            !Number.isFinite(
                numericScore
            )
        ) {
            return {
                ok: false,
                error: "คะแนนไม่ถูกต้อง"
            };
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/game-stats`,
                    {
                        method: "POST",

                        credentials: "include",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            game:
                                String(game),

                            score:
                                numericScore
                        })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.ok
            ) {

                throw new Error(
                    data.error ||
                    "ไม่สามารถบันทึกสถิติได้"
                );

            }


            return data;

        } catch (error) {

            console.error(
                "RECORD GAME ERROR:",
                error
            );

            return {
                ok: false,
                error: error.message
            };

        }

    }


    /* =========================
       PUBLIC GAME STATS FUNCTION
    ========================= */

    window.recordGameResult =
        recordGameResult;


    /* =========================
       RENDER USER PROFILE
    ========================= */

    async function renderUserProfile(user) {

        profileFields.innerHTML = "";


        Object.entries(user).forEach(
            ([key, value]) => {

                /*
                 * ไม่แสดง updated_at
                 */

                if (key === "updated_at") {
                    return;
                }


                /* =========================
                   CREATED AT
                ========================= */

                if (key === "created_at") {

                    const createdDate =
                        new Date(Number(value));


                    /*
                     * ผู้ใช้สร้างเมื่อ
                     */

                    const createdRow =
                        document.createElement("div");

                    createdRow.className =
                        "profile-field";


                    const createdName =
                        document.createElement("div");

                    createdName.className =
                        "profile-field-name";

                    createdName.textContent =
                        "ผู้ใช้สร้างเมื่อ";


                    const createdValue =
                        document.createElement("div");

                    createdValue.className =
                        "profile-field-value";


                    if (
                        Number.isNaN(
                            createdDate.getTime()
                        )
                    ) {

                        createdValue.textContent =
                            "-";

                    } else {

                        createdValue.textContent =
                            createdDate.toLocaleString(
                                "th-TH",
                                {
                                    dateStyle: "long",
                                    timeStyle: "medium"
                                }
                            );

                    }


                    createdRow.append(
                        createdName,
                        createdValue
                    );


                    profileFields.appendChild(
                        createdRow
                    );


                    /*
                     * สร้างมาแล้ว
                     */

                    const ageRow =
                        document.createElement("div");

                    ageRow.className =
                        "profile-field";


                    const ageName =
                        document.createElement("div");

                    ageName.className =
                        "profile-field-name";

                    ageName.textContent =
                        "สร้างมาแล้ว";


                    const ageValue =
                        document.createElement("div");

                    ageValue.className =
                        "profile-field-value";

                    ageValue.textContent =
                        getAccountAge(value);


                    ageRow.append(
                        ageName,
                        ageValue
                    );


                    profileFields.appendChild(
                        ageRow
                    );


                    return;

                }


                /* =========================
                   OTHER FIELDS
                ========================= */

                const formattedValue =
                    formatProfileValue(
                        value,
                        key
                    );


                if (
                    formattedValue === null
                ) {
                    return;
                }


                const row =
                    document.createElement("div");

                row.className =
                    "profile-field";


                const name =
                    document.createElement("div");

                name.className =
                    "profile-field-name";

                name.textContent =
                    formatProfileName(key);


                const val =
                    document.createElement("div");

                val.className =
                    "profile-field-value";

                val.textContent =
                    formattedValue;


                row.append(
                    name,
                    val
                );


                profileFields.appendChild(
                    row
                );

            }
        );


        /* =========================
           LOAD GAME STATISTICS
        ========================= */

        const username =
            user?.username;


        if (username) {

            const stats =
                await getGameStats(
                    username
                );


            if (stats) {

                renderGameStats(
                    stats
                );

            }

        }

    }


    /* =========================
       OPEN USER PROFILE
    ========================= */

    async function openUserProfile(username) {

        if (!username) {
            return;
        }


        username =
            String(username).trim();


        if (!username) {
            return;
        }


        profileModal?.classList.add("show");

        profileModal?.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.style.overflow =
            "hidden";


        modalProfileUsername.textContent =
            username;


        profileLoading.style.display =
            "block";


        profileError.style.display =
            "none";


        profileFields.innerHTML =
            "";


        try {

            const response =
                await fetch(
                    `${API_URL}/users/${encodeURIComponent(username)}`,
                    {
                        method: "GET",
                        credentials: "include"
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.ok ||
                !data.user
            ) {

                throw new Error(
                    data.error ||
                    "User not found"
                );

            }


            modalProfileUsername.textContent =
                data.user.username ||
                username;


            await renderUserProfile(
                data.user
            );


            profileLoading.style.display =
                "none";


        } catch (error) {

            console.error(
                "PROFILE ERROR:",
                error
            );


            profileLoading.style.display =
                "none";


            profileError.style.display =
                "block";

        }

    }


    /* =========================
       CLOSE PROFILE
    ========================= */

    function closeUserProfile() {

        profileModal?.classList.remove(
            "show"
        );


        profileModal?.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";

    }


    /* =========================
       LOGOUT
    ========================= */

    async function logout() {

        try {

            const response =
                await fetch(
                    `${API_URL}/auth/logout`,
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );


            const data =
                await response.json();


            if (
                response.ok &&
                data.ok
            ) {

                window.location.reload();

            }

        } catch (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

        }

    }


    /* =========================
       LOGIN / PROFILE BUTTONS
    ========================= */

    loginBtn?.addEventListener(
        "click",
        openLogin
    );


    profileLoginBtn?.addEventListener(
        "click",
        openLogin
    );


    /* =========================
       CHECK SESSION
    ========================= */

    try {

        const response =
            await fetch(
                `${API_URL}/auth/me`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (
            response.ok &&
            data.ok &&
            data.user
        ) {

            currentUser =
                data.user;


            const username =
                currentUser.username;


            /* =========================
               HEADER USERNAME
            ========================= */

            if (loginBtn) {

                loginBtn.textContent =
                    username;


                loginBtn.classList.add(
                    "user-profile-clickable"
                );


                loginBtn.removeEventListener(
                    "click",
                    openLogin
                );


                loginBtn.addEventListener(
                    "click",
                    () => {

                        openUserProfile(
                            username
                        );

                    }
                );

            }


            /* =========================
               AVATAR
            ========================= */

            if (profileAvatar) {

                profileAvatar.textContent =
                    username
                        .charAt(0)
                        .toUpperCase();

            }


            /* =========================
               PROFILE USERNAME
            ========================= */

            if (profileUsername) {

                profileUsername.textContent =
                    username;


                profileUsername.classList.add(
                    "user-profile-clickable"
                );


                profileUsername.title =
                    "เปิดโปรไฟล์";


                profileUsername.addEventListener(
                    "click",
                    () => {

                        openUserProfile(
                            username
                        );

                    }
                );

            }


            /* =========================
               PROFILE DESCRIPTION
            ========================= */

            if (profileDescription) {

                profileDescription.textContent =
                    "เข้าสู่ระบบแล้ว คลิกชื่อเพื่อดูข้อมูลโปรไฟล์";

            }


            /* =========================
               LOGOUT BUTTON
            ========================= */

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


    /* =========================
       NAV PROFILE
    ========================= */

    document
        .querySelectorAll(
            '.nav a[href="#profile"]'
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    if (!currentUser) {
                        return;
                    }


                    event.preventDefault();


                    openUserProfile(
                        currentUser.username
                    );

                }
            );

        });


    /* =========================
       HERO PROFILE
    ========================= */

    document
        .querySelectorAll(
            'a[href="#profile"].btn'
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    if (!currentUser) {
                        return;
                    }


                    event.preventDefault();


                    openUserProfile(
                        currentUser.username
                    );

                }
            );

        });


    /* =========================
       MODAL CLOSE
    ========================= */

    profileCloseBtn?.addEventListener(
        "click",
        closeUserProfile
    );


    profileBackdrop?.addEventListener(
        "click",
        closeUserProfile
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                profileModal?.classList.contains(
                    "show"
                )
            ) {

                closeUserProfile();

            }

        }
    );


    /* =========================
       GAMES
    ========================= */

    document
        .querySelectorAll(".play-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const game =
                        button.dataset.game;


                    if (game === "click") {
                        window.location.href = "../games/click-speed/";
                        return;
                    }

                    alert(
                        `เกม ${game} จะเปิดในขั้นตอนถัดไป`
                    );

                }
            );

        });

});