function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://my-site-4b0.pages.dev",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            ...extraHeaders
        }
    });
}


async function hashPassword(password) {
    const data = new TextEncoder().encode(password);

    const hash = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


function generateToken() {
    const bytes = new Uint8Array(32);

    crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


function getCookie(request, name) {

    const cookieHeader = request.headers.get("Cookie");

    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {

        const [key, ...value] = cookie.trim().split("=");

        if (key === name) {
            return value.join("=");
        }

    }

    return null;
}


export default {

    async fetch(request, env) {

        const url = new URL(request.url);


        /* =========================
           CORS
        ========================= */

        if (request.method === "OPTIONS") {

            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin":
                        "https://my-site-4b0.pages.dev",

                    "Access-Control-Allow-Credentials": "true",

                    "Access-Control-Allow-Headers":
                        "Content-Type",

                    "Access-Control-Allow-Methods":
                        "GET, POST, OPTIONS"
                }
            });

        }


        /* =========================
           API STATUS
        ========================= */

        if (
            url.pathname === "/" &&
            request.method === "GET"
        ) {

            return json({
                ok: true,
                service: "my-site-api"
            });

        }


        /* =========================
           REGISTER
        ========================= */

        if (
            url.pathname === "/auth/register" &&
            request.method === "POST"
        ) {

            try {

                const body = await request.json();

                const username =
                    String(body.username || "").trim();

                const password =
                    String(body.password || "");


                if (username.length < 3) {

                    return json({
                        ok: false,
                        error: "Username must be at least 3 characters"
                    }, 400);

                }


                if (password.length < 6) {

                    return json({
                        ok: false,
                        error: "Password must be at least 6 characters"
                    }, 400);

                }


                const existing =
                    await env.my_site_db
                        .prepare(
                            "SELECT id FROM users WHERE username = ?"
                        )
                        .bind(username)
                        .first();


                if (existing) {

                    return json({
                        ok: false,
                        error: "Username already exists"
                    }, 409);

                }


                const passwordHash =
                    await hashPassword(password);

                const now = Date.now();


                const result =
                    await env.my_site_db
                        .prepare(`
                            INSERT INTO users
                            (
                                username,
                                password_hash,
                                created_at,
                                updated_at
                            )
                            VALUES (?, ?, ?, ?)
                        `)
                        .bind(
                            username,
                            passwordHash,
                            now,
                            now
                        )
                        .run();


                return json({
                    ok: true,
                    user: {
                        id: result.meta.last_row_id,
                        username
                    }
                }, 201);


            } catch {

                return json({
                    ok: false,
                    error: "Invalid request"
                }, 400);

            }

        }


        /* =========================
           LOGIN
        ========================= */

        if (
            url.pathname === "/auth/login" &&
            request.method === "POST"
        ) {

            try {

                const body = await request.json();

                const username =
                    String(body.username || "").trim();

                const password =
                    String(body.password || "");


                if (!username || !password) {

                    return json({
                        ok: false,
                        error: "Username and password are required"
                    }, 400);

                }


                const user =
                    await env.my_site_db
                        .prepare(`
                            SELECT
                                id,
                                username,
                                password_hash
                            FROM users
                            WHERE username = ?
                        `)
                        .bind(username)
                        .first();


                if (!user) {

                    return json({
                        ok: false,
                        error: "Invalid username or password"
                    }, 401);

                }


                const passwordHash =
                    await hashPassword(password);


                if (passwordHash !== user.password_hash) {

                    return json({
                        ok: false,
                        error: "Invalid username or password"
                    }, 401);

                }


                const token = generateToken();

                const expiresAt =
                    Date.now() + (7 * 24 * 60 * 60 * 1000);


                await env.my_site_db
                    .prepare(`
                        CREATE TABLE IF NOT EXISTS sessions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            token_hash TEXT NOT NULL UNIQUE,
                            expires_at INTEGER NOT NULL,
                            created_at INTEGER NOT NULL
                        )
                    `)
                    .run();


                const tokenHash =
                    await hashPassword(token);


                await env.my_site_db
                    .prepare(`
                        INSERT INTO sessions
                        (
                            user_id,
                            token_hash,
                            expires_at,
                            created_at
                        )
                        VALUES (?, ?, ?, ?)
                    `)
                    .bind(
                        user.id,
                        tokenHash,
                        expiresAt,
                        Date.now()
                    )
                    .run();


                return json(
                    {
                        ok: true,
                        user: {
                            id: user.id,
                            username: user.username
                        }
                    },
                    200,
                    {
                        "Set-Cookie":
                            `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`
                    }
                );


            } catch {

                return json({
                    ok: false,
                    error: "Invalid request"
                }, 400);

            }

        }


        /* =========================
           CURRENT USER
        ========================= */

        if (
            url.pathname === "/auth/me" &&
            request.method === "GET"
        ) {

            const token =
                getCookie(request, "session");


            if (!token) {

                return json({
                    ok: false,
                    error: "Not authenticated"
                }, 401);

            }


            const tokenHash =
                await hashPassword(token);


            const session =
                await env.my_site_db
                    .prepare(`
                        SELECT
                            sessions.user_id,
                            sessions.expires_at,
                            users.username
                        FROM sessions
                        JOIN users
                            ON users.id = sessions.user_id
                        WHERE sessions.token_hash = ?
                    `)
                    .bind(tokenHash)
                    .first();


            if (
                !session ||
                session.expires_at < Date.now()
            ) {

                return json({
                    ok: false,
                    error: "Session expired"
                }, 401);

            }


            return json({
                ok: true,
                user: {
                    id: session.user_id,
                    username: session.username
                }
            });

        }


        /* =========================
           LOGOUT
        ========================= */

        if (
            url.pathname === "/auth/logout" &&
            request.method === "POST"
        ) {

            const token =
                getCookie(request, "session");


            if (token) {

                const tokenHash =
                    await hashPassword(token);


                await env.my_site_db
                    .prepare(`
                        DELETE FROM sessions
                        WHERE token_hash = ?
                    `)
                    .bind(tokenHash)
                    .run();

            }


            return json(
                {
                    ok: true
                },
                200,
                {
                    "Set-Cookie":
                        "session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"
                }
            );

        }


        /* =========================
           PUBLIC USER PROFILE
        ========================= */

        if (
            url.pathname.startsWith("/users/") &&
            request.method === "GET"
        ) {

            try {

                const username = decodeURIComponent(
                    url.pathname.substring("/users/".length)
                ).trim();

                if (!username) {
                    return json({
                        ok: false,
                        error: "Username is required"
                    }, 400);
                }

                const user = await env.my_site_db
                    .prepare(`
                        SELECT *
                        FROM users
                        WHERE username = ?
                        LIMIT 1
                    `)
                    .bind(username)
                    .first();

                if (!user) {
                    return json({
                        ok: false,
                        error: "User not found"
                    }, 404);
                }

                // ส่งเฉพาะข้อมูลที่ไม่ใช่ความลับ
                const publicUser = {};

                for (const [key, value] of Object.entries(user)) {
                    const lowerKey = key.toLowerCase();

                    if (
                        lowerKey.includes("password") ||
                        lowerKey.includes("token") ||
                        lowerKey.includes("secret") ||
                        lowerKey.includes("session")
                    ) {
                        continue;
                    }

                    publicUser[key] = value;
                }

                return json({
                    ok: true,
                    user: publicUser
                });

            } catch (error) {

                console.error("PUBLIC PROFILE ERROR:", error);

                return json({
                    ok: false,
                    error: "Failed to load user"
                }, 500);
            }
        }

        return json({
            ok: false,
            error: "Not found"
        }, 404);

    }
};