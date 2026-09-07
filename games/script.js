/* =========================================================
   BAS LAB
   script.js
   ========================================================= */


/* =========================================================
   CLOUDFLARE API
   ---------------------------------------------------------
   ถ้าเปลี่ยน Worker ให้แก้ URL ตรงนี้จุดเดียว
   ========================================================= */

const BAS_API = 'https://bas-lab-api.basbas0513.workers.dev';

async function basApi(path, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = sessionStorage.getItem('basSessionToken');
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(BAS_API + path, {
            ...options,
            headers
        });

        if (!response.ok) {
            if (response.status === 401) sessionStorage.removeItem('basSessionToken');
            throw new Error(`API ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.warn('[BAS LAB API]', error);
        return null;
    }
}

/* =========================================================
   CLOUDFLARE - LOGIN
   ========================================================= */

async function basLoginToCloudflare() {
    window.location.href = BAS_API + '/auth/discord/start';
}

/* =========================================================
   CLOUDFLARE - LOG EVENT
   ========================================================= */

async function basLogEvent(eventType, eventData = {}) {
    const token = sessionStorage.getItem('basSessionToken');
    if (!token) return;

    return basApi('/api/event', {
        method: 'POST',
        body: JSON.stringify({
            event_type: eventType,
            event_data: eventData
        })
    });
}

/* =========================================================
   LOGIN
   ========================================================= */

(() => {
    const overlay = document.getElementById('basLoginOverlay');
    const form = document.getElementById('basLoginForm');
    const error = document.getElementById('basLoginError');

    if (!overlay || !form) return;

    document.documentElement.style.overflow = 'hidden';

    async function finishLogin() {
        const me = await basApi('/api/auth/me');
        if (!me?.success || !me.username) {
            sessionStorage.removeItem('basSessionToken');
            return false;
        }

        localStorage.setItem('basUsername', me.username);
        overlay.remove();
        document.documentElement.style.overflow = '';
        window.basLoginCompleted = true;

        document.dispatchEvent(new CustomEvent('bas-login-success', {
            detail: { name: me.username }
        }));
        return true;
    }

    async function initAuth() {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const token = hash.get('auth');

        if (token) {
            sessionStorage.setItem('basSessionToken', token);
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        if (sessionStorage.getItem('basSessionToken')) {
            if (await finishLogin()) return;
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            error.textContent = '';
            basLoginToCloudflare();
        });
    }

    initAuth();
})();

/* =========================================================
   GAME STATE
   ========================================================= */

(() => {

    'use strict';

    let lieStep = 0;
    let reward = 0;

    let aiStep = 0;
    let aiScore = 0;

    let dontClicks = 0;

    let targetScore = 0;
    let targetTime = 15;

    let targetTimer = null;
    let hackTimer = null;
    let targetMoveTimer = null;

    let clickRounds = 0;

    let ghostKeyHandler = null;
    let ghostRAF = null;
    let ghostState = null;


    /* =====================================================
       HELPERS
       ===================================================== */

    const $ = (selector) => document.querySelector(selector);

    const gameContent = () => $('#gameContent');

    const box = (html) => {
        return `<div class="gamebox">${html}</div>`;
    };


    /* =====================================================
       NPC DATA
       ===================================================== */

    const npcBehaviors = [
        'เปิดเว็บแล้วลืมว่ามาทำอะไร',
        'กดปุ่มซ้ำเพราะคิดว่าเว็บค้าง',
        'เห็นคำว่า “ห้ามกด” แล้วอยากกด',
        'เลื่อนหน้าจอทั้งที่ไม่มีอะไรให้ดู',
        'เปิดตู้เย็นแล้วปิดโดยไม่ได้หยิบอะไร',
        'ตอบว่า “เดี๋ยวทำ” แล้วหายไป',
        'ค้นหาของที่ถืออยู่ในมือ',
        'ตั้งปลุกแล้วกดเลื่อน 7 รอบ',
        'เข้า YouTube เพื่อดูคลิปเดียว',
        'อ่านแชตแล้วตอบในใจแทนการพิมพ์',
        'กดรีเฟรชเพื่อหวังให้ชีวิตดีขึ้น',
        'เปิดหลายแท็บจนจำไม่ได้ว่าแท็บไหนสำคัญ',
        'พิมพ์รหัสผ่านผิดแล้วโทษคีย์บอร์ด',
        'เห็นโหลด 99% แล้วจ้องมัน',
        'กดปุ่มย้อนกลับทั้งที่ยังอยู่หน้าเดิม',
        'ชาร์จมือถือทั้งที่แบต 94%',
        'ตั้งใจนอนเร็วแต่เปิดมือถือก่อน',
        'พูดว่า “5 นาที” แล้วผ่านไปหนึ่งชั่วโมง',
        'กดข้ามโฆษณาเร็วเกินไปจนกดไม่ได้',
        'ค้นหาวิธีทำสิ่งที่กำลังทำอยู่',
        'เปิดเพลงแล้วลืมว่ากำลังหาเพลงอะไร',
        'อ่านแจ้งเตือนแล้วลืมเนื้อหา',
        'กดไลก์โพสต์เก่าโดยไม่ตั้งใจ',
        'ถ่ายรูปอาหารก่อนกิน',
        'ดูนาฬิกาซ้ำหลังจากดูไปเมื่อกี้',
        'เปิดแอปแล้วปิดทันที',
        'พิมพ์ “555” ทั้งที่ไม่ได้ขำ',
        'กดปุ่มเสียงเพื่อเช็กว่าเปิดเสียงอยู่ไหม',
        'เลื่อนฟีดจนเจอโพสต์เดิม',
        'เดินเข้าห้องแล้วลืมว่ามาทำอะไร',
        'เปิดแอร์แล้วห่มผ้า',
        'บอกว่าไม่หิวแล้วแอบหาของกิน',
        'เช็กมือถือทั้งที่ไม่มีแจ้งเตือน',
        'กด “ยอมรับ” โดยไม่อ่าน',
        'กดสุ่มเพราะไม่รู้จะเลือกอะไร',
        'เห็นคำว่า UPDATE แล้วกดทันที',
        'จำรหัสได้แต่จำไม่ได้ว่าบัญชีไหน',
        'เปิดกล้องหน้าเพื่อเช็กหน้าตัวเอง',
        'ส่งข้อความแล้วอ่านซ้ำ 3 รอบ',
        'พิมพ์ผิดแล้วส่งก่อนแก้',
        'กดปิดแจ้งเตือนแล้วเปิดใหม่',
        'บอกว่า “ครั้งสุดท้าย” หลายครั้ง',
        'ดูแบตทุก 2 นาที',
        'เข้าเกมเพื่อเล่น 10 นาทีแล้วหายไปทั้งคืน',
        'ค้นหาคำตอบทั้งที่รู้คำตอบอยู่แล้ว',
        'กดปุ่มสุ่มเพราะอยากรู้ผล',
        'อ่านหน้านี้มาถึงตรงนี้',
        'ใช้เมาส์ลากไปรอบ ๆ โดยไม่มีเหตุผล',
        'ทำทุกอย่างก่อนถึงจะยอมทำงานจริง',
        'คลิกปุ่มเพราะมันอยู่ตรงหน้า'
    ];


    /* =====================================================
       LIE GAME DATA
       ===================================================== */

    const lieConclusions = [
        'เครื่องสรุปว่า: คุณเคยโกหก แต่โกหกได้เนียนพอตัว',
        'เครื่องสรุปว่า: ความจริงอยู่ตรงหน้า แต่คุณกด “ไม่”',
        'เครื่องสรุปว่า: มีพิรุธระดับ “แป๊บเดียวจริง ๆ”',
        'เครื่องสรุปว่า: คุณน่าจะพูดความจริง...มั้ง',
        'เครื่องสรุปว่า: ระบบไม่เชื่อแม้แต่เครื่องเอง',
        'เครื่องสรุปว่า: คุณมีความลับเกี่ยวกับตู้เย็น',
        'เครื่องสรุปว่า: พบอาการ “เดี๋ยวค่อยทำ” รุนแรง',
        'เครื่องสรุปว่า: คำตอบฟังดูดี แต่เครื่องไม่ซื้อ',
        'เครื่องสรุปว่า: ความน่าเชื่อถือกำลังโหลด 99%',
        'เครื่องสรุปว่า: ตรวจพบการโกหกแบบสุภาพ',
        'เครื่องสรุปว่า: คุณตอบเร็วเกินไป น่าสงสัย',
        'เครื่องสรุปว่า: คุณรู้ว่าคำถามนี้หมายถึงอะไร',
        'เครื่องสรุปว่า: หลักฐานยังไม่พอ แต่ความรู้สึกบอกใช่',
        'เครื่องสรุปว่า: พิรุธระดับแมวเห็นปลาทู',
        'เครื่องสรุปว่า: ระบบขอเวลาตั้งสติก่อนเชื่อ',
        'เครื่องสรุปว่า: คำตอบนี้มีความเป็นมนุษย์สูง',
        'เครื่องสรุปว่า: มีแนวโน้มพูดว่า “ไม่ได้โกหก” บ่อย',
        'เครื่องสรุปว่า: คุณเกือบผ่าน แต่เครื่องจำได้',
        'เครื่องสรุปว่า: ตรวจพบรอยยิ้มที่มองไม่เห็น',
        'เครื่องสรุปว่า: มีพิรุธแบบไม่ตั้งใจ',
        'เครื่องสรุปว่า: ความจริงน่าจะอยู่ในแชตเก่า',
        'เครื่องสรุปว่า: เครื่องจับโกหกก็โดนปั่น',
        'เครื่องสรุปว่า: คุณตอบเหมือนคนมีประสบการณ์',
        'เครื่องสรุปว่า: คำตอบนี้ดูสะอาดเกินไป',
        'เครื่องสรุปว่า: มีความจริงปนอยู่ประมาณหนึ่ง',
        'เครื่องสรุปว่า: คุณควรตอบใหม่ แต่ก็สายไปแล้ว',
        'เครื่องสรุปว่า: พบความมั่นใจเกินเหตุ',
        'เครื่องสรุปว่า: ความน่าสงสัยพุ่งเพราะคำว่า “แป๊บ”',
        'เครื่องสรุปว่า: คุณไม่ได้โกหกทุกเรื่อง แค่บางเรื่อง',
        'เครื่องสรุปว่า: ระบบกำลังแกล้งคุณกลับ',
        'เครื่องสรุปว่า: มีพิรุธแบบมือสมัครเล่น',
        'เครื่องสรุปว่า: คำตอบผ่าน แต่สายตาในจินตนาการไม่ผ่าน',
        'เครื่องสรุปว่า: ความจริงซ่อนอยู่หลังปุ่มนี้',
        'เครื่องสรุปว่า: คุณตอบแบบคนที่รู้ว่ากำลังถูกตรวจ',
        'เครื่องสรุปว่า: พบความน่าสงสัยระดับขนมหมดถุง',
        'เครื่องสรุปว่า: คุณอาจพูดจริง แต่จังหวะไม่ดี',
        'เครื่องสรุปว่า: ระบบสุ่มแล้วก็เลยต้องเชื่อ',
        'เครื่องสรุปว่า: พบข้อมูลลับจากดาวอังคาร',
        'เครื่องสรุปว่า: คำตอบนี้มีความ “เออ ๆ” สูง',
        'เครื่องสรุปว่า: คุณผ่านการตรวจแบบเฉียดฉิว',
        'เครื่องสรุปว่า: มีพิรุธแต่ไม่รู้พิรุธอะไร',
        'เครื่องสรุปว่า: คุณน่าจะเคยโกหกเรื่องเวลา',
        'เครื่องสรุปว่า: เครื่องต้องการพักร้อน',
        'เครื่องสรุปว่า: ความจริงถูกซ่อนไว้ใต้เตียง',
        'เครื่องสรุปว่า: ตรวจพบความน่าสงสัยแบบขำ ๆ',
        'เครื่องสรุปว่า: คุณยังมีโอกาสแก้ตัวในเกมหน้า',
        'เครื่องสรุปว่า: หลักฐานชี้ไปที่คำว่า “ไม่เป็นไร”',
        'เครื่องสรุปว่า: คุณดูน่าสงสัยเพราะเว็บนี้เอง',
        'เครื่องสรุปว่า: ระบบตัดสินใจแล้ว และไม่รับอุทธรณ์',
        'เครื่องสรุปว่า: คุณคือผู้ต้องสงสัยหมายเลข 1 ในคดีขนมหมด'
    ];


    /* =====================================================
       PRANK DATA
       ===================================================== */

    const prankConclusions = [
        'คนนี้เชื่อเว็บง่ายกว่าที่คิด',
        'ระดับความปั่นเกินกว่าที่ระบบรับไหว',
        'มีแววโดนเพื่อนหลอกซ้ำได้สูง',
        'ดูจริงจังมาก แต่จริง ๆ ไม่มีอะไรเลย',
        'ถ้าเห็นคำว่า “ระบบตรวจพบ” มีโอกาสตกใจ',
        'ควรเก็บสติเมื่อเจอเว็บหน้าตาจริงจัง',
        'ความปั่นระดับพร้อมแชร์ให้เพื่อน',
        'ระบบขอประกาศว่าคนนี้น่ารักเกินไปที่จะโดนหลอก',
        'มีความเสี่ยงต่อการกดปุ่มโดยไม่อ่าน',
        'มีพฤติกรรมสายลุย ไม่อ่านรายละเอียด',
        'โอกาสโดนปั่นในกลุ่มแชตสูง',
        'ดูเหมือนจะรู้ทัน แต่ระบบยังไม่ยืนยัน',
        'เป็นเป้าหมายชั้นดีของมุก “ห้ามกด”',
        'ความปั่นกำลังไต่ระดับภูเขา',
        'ถ้าเพื่อนบอกว่าเป็น AI มีโอกาสเชื่อ',
        'มีพลังงาน NPC แทรกเล็กน้อย',
        'เป็นมนุษย์ แต่ปั่นเก่ง',
        'อ่านผลแล้วอาจเถียงกับเว็บ',
        'มีความสามารถในการหลงกลแบบมีสไตล์',
        'ระบบให้ผ่าน แต่เพื่อนอาจไม่ให้ผ่าน',
        'ความน่าเชื่อถือของเว็บสูงเกินเหตุ',
        'มีโอกาสส่งผลตรวจนี้กลับมาปั่นเจ้าของเว็บ',
        'ดูแล้วน่าจะกด “ลองอีกครั้ง”',
        'ความปั่นอยู่ในระดับต้องจับตา',
        'ระบบแนะนำให้พักจากปุ่มนี้ 5 นาที',
        'พบความกวนที่ยังไม่ได้ปลดล็อกเต็มที่',
        'เป็นผู้ทดลองที่กล้าหาญมาก',
        'ความปั่น 100% แต่หลักฐาน 0%',
        'เหมาะกับการเป็นตัวละครลับในเกม',
        'มีแนวโน้มถามว่า “เว็บนี้จริงไหม”',
        'ระบบพบความจริงหนึ่งอย่าง: เว็บนี้ปั่น',
        'มีแววเป็นหัวหน้าทีมปั่น',
        'ระดับความเชื่อเว็บ: สูงอย่างน่ากลัว',
        'ระบบตรวจไม่เจอความปกติ',
        'ควรได้รับเหรียญผู้เสียสละให้เว็บ',
        'เป็นคนที่เห็นปุ่มแล้วต้องลอง',
        'การวิเคราะห์นี้ไม่มีหลักวิทยาศาสตร์เลย',
        'มีความเสี่ยงเปิดเว็บนี้ซ้ำ',
        'ผลตรวจเหมาะสำหรับส่งในกลุ่มเพื่อน',
        'ระดับความปั่นกำลังขึ้น',
        'มีพลัง “เอาอีกดิ” สูง',
        'อาจรู้ว่าโดนปั่น แต่ยังเล่นต่อ',
        'ระบบแนะนำให้ลองเครื่องมืออื่น',
        'ความจริงไม่สำคัญ ความปั่นสำคัญกว่า',
        'คะแนนนี้สุ่ม แต่ความกวนจริง',
        'มีแนวโน้มตกเป็นเหยื่อของปุ่มปลอม',
        'ผลตรวจนี้ไม่สามารถใช้ในศาลได้',
        'เพื่อนเห็นแล้วมีโอกาสขำ',
        'ผ่านการตรวจโดยทีมงานในจินตนาการ',
        'ระบบสรุปว่า: ปั่นได้อีก'
    ];


    /* =====================================================
       AI QUESTIONS
       ===================================================== */

    const aiQs = [
        [
            'ถ้ามีงานส่งพรุ่งนี้ คุณจะ...',
            'ทำทันที',
            'ไว้ก่อน เดี๋ยวค่อยทำ',
            'ลืมไปเลย'
        ],
        [
            'เจอปุ่มเขียนว่า “ห้ามกด” คุณจะ...',
            'ไม่กด',
            'กดนิดเดียว',
            'กดรัว ๆ'
        ],
        [
            'เพื่อนส่งมีมมา คุณจะ...',
            'กดดู',
            'ส่งต่อ',
            'ทำมีมใหม่แข่ง'
        ]
    ];


    /* =====================================================
       PAGE / GAME NAVIGATION
       ===================================================== */

    function showHome() {

        stopGhostGame();

        clearInterval(targetTimer);
        clearInterval(hackTimer);
        clearInterval(targetMoveTimer);

        $('#home').classList.add('active');
        $('#game').classList.remove('active');
    }


    function openGame(id) {

        if (!games[id]) return;

        stopGhostGame();

        clearInterval(targetTimer);
        clearInterval(hackTimer);
        clearInterval(targetMoveTimer);

        $('#home').classList.remove('active');
        $('#game').classList.add('active');

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        // Cloudflare: บันทึกว่าเปิดเกมอะไร
        basLogEvent('open_game', {
            game: id
        });

        games[id]();
    }


    window.showHome = showHome;
    window.openGame = openGame;


    /* =====================================================
       GAMES
       ===================================================== */

    const games = {

        /* -------------------------------------------------
           อย่ากด
           ------------------------------------------------- */

        dont() {

            dontClicks = 0;

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>🚫 ปุ่มที่ไม่ควรกด</h2>

                    <p class="sub">
                        คุณถูกเตือนแล้วนะ...
                    </p>

                    <div
                        style="height:230px;position:relative"
                        id="dontArea"
                    >

                        <button
                            id="dontBtn"
                            class="primary"
                            style="position:absolute;left:45%;top:45%"
                        >
                            อย่ากด
                        </button>

                    </div>

                    <div id="dontOut" class="result"></div>

                </div>
            `);

            $('#dontBtn').addEventListener('click', () => {

                dontClicks++;

                const button = $('#dontBtn');

                if (dontClicks < 6) {

                    button.style.left = Math.random() * 80 + '%';
                    button.style.top = Math.random() * 80 + '%';

                    button.textContent = [
                        'บอกว่าอย่ากดไง',
                        'หยุดก่อน',
                        'ยังจะกดอีก?',
                        'เอาจริงดิ',
                        'ครั้งสุดท้ายแล้วนะ'
                    ][dontClicks - 1];

                } else {

                    $('#dontArea').innerHTML =
                        '<div class="big">🗿</div>';

                    $('#dontOut').innerHTML =
                        '<span class="danger">ยินดีด้วย คุณชนะปุ่ม</span>' +
                        '<br><small>แต่เสียเวลาไปกับมันแล้วเรียบร้อย</small>';
                }

            });
        },


        /* -------------------------------------------------
           NPC
           ------------------------------------------------- */

        npc() {

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>🧠 NPC Scanner</h2>

                    <p class="sub">
                        วางมือบนเมาส์ แล้วเตรียมรับผลการวิเคราะห์
                    </p>

                    <div class="big">🧑‍💻</div>

                    <div class="progress">
                        <div id="npcBar" class="bar"></div>
                    </div>

                    <div id="npcOut" class="result">
                        พร้อมสแกน
                    </div>

                    <button id="npcStart" class="primary">
                        เริ่มสแกน
                    </button>

                </div>
            `);

            $('#npcStart').addEventListener('click', () => {

                let progress = 0;

                $('#npcStart').disabled = true;

                const timer = setInterval(() => {

                    progress += Math.random() * 17;

                    $('#npcBar').style.width =
                        Math.min(progress, 100) + '%';

                    $('#npcOut').textContent =
                        progress < 100
                            ? 'กำลังวิเคราะห์...'
                            : 'กำลังสรุปผล...';

                    if (progress >= 100) {

                        clearInterval(timer);

                        setTimeout(() => {

                            const number =
                                Math.floor(Math.random() * 100) + 1;

                            const human = number <= 10;

                            const behavior =
                                npcBehaviors[
                                    Math.floor(
                                        Math.random() *
                                        npcBehaviors.length
                                    )
                                ];

                            $('#npcOut').innerHTML =
                                human
                                    ? `
                                        ผลลัพธ์:
                                        <span class="success">
                                            ${number}% มนุษย์
                                        </span>
                                        <br>
                                        <small>
                                            ระบบตรวจพบพฤติกรรม
                                            “${behavior}”
                                        </small>
                                    `
                                    : `
                                        ผลลัพธ์:
                                        <span class="danger">
                                            ${number}% หุ่นยนต์
                                        </span>
                                        <br>
                                        <small>
                                            ระบบตรวจพบพฤติกรรม
                                            “${behavior}”
                                        </small>
                                    `;

                            $('#npcStart').disabled = false;

                        }, 300);
                    }

                }, 180);

            });
        },


        /* -------------------------------------------------
           เครื่องจับโกหก
           ------------------------------------------------- */

        lie() {

            lieStep = 0;

            gameContent().innerHTML = box(`
                <h2>🕵️ เครื่องจับโกหก</h2>

                <p class="sub">
                    เลือกคำตอบที่คิดว่าเครื่องจะเชื่อ
                </p>

                <div id="lieQ"></div>
            `);

            showLie();
        },


        /* -------------------------------------------------
           รับเงินฟรี
           ------------------------------------------------- */

        money() {

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>💰 รับเงินฟรี</h2>

                    <p class="sub">
                        ยินดีด้วย ระบบพบว่าคุณมีสิทธิ์รับเงิน
                    </p>

                    <div class="money">
                        ฿999,999
                    </div>

                    <p class="warn">
                        *ขั้นตอนนี้เป็นเกมจำลอง ไม่มีการโอนเงินจริง
                    </p>

                    <button id="moneyStart" class="primary">
                        ยืนยันรับเงิน
                    </button>

                </div>
            `);

            $('#moneyStart').addEventListener(
                'click',
                () => moneyStep(1)
            );
        },


        /* -------------------------------------------------
           เครื่องผลิตเงิน
           ------------------------------------------------- */

        reward() {

            reward = 0;

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>🎁 เครื่องผลิตเงิน</h2>

                    <p class="sub">
                        กดปุ่มเพื่อเพิ่มยอดเงิน
                    </p>

                    <div id="cash" class="money">
                        ฿0
                    </div>

                    <button id="earnBtn" class="primary">
                        + รับเงิน
                    </button>

                    <button id="withdrawBtn" class="secondary">
                        ถอนเงิน
                    </button>

                    <div id="rewardMsg" class="result"></div>

                </div>
            `);

            $('#earnBtn').addEventListener('click', () => {

                reward +=
                    Math.floor(Math.random() * 900) + 100;

                $('#cash').textContent =
                    '฿' + reward.toLocaleString('th-TH');

            });

            $('#withdrawBtn').addEventListener('click', () => {

                $('#rewardMsg').innerHTML =
                    reward < 10000
                        ? `
                            <span class="danger">
                                ถอนเงินไม่ได้
                            </span>
                            <br>
                            <small>
                                ยอดขั้นต่ำ 10,000 บาท
                                และคุณกำลังโดนปั่นอยู่
                            </small>
                        `
                        : `
                            <span class="success">
                                กำลังโอน...
                            </span>
                            <br>
                            <small>
                                โอนไปยังธนาคารแห่งความฝันเรียบร้อย
                            </small>
                        `;

            });
        },


        /* -------------------------------------------------
           Fake Hacker
           ------------------------------------------------- */

        hack() {

            gameContent().innerHTML = box(`
                <h2>💻 Fake Hacker</h2>

                <p class="sub">
                    Terminal จำลองแฮ็กแบบหนังฮอลลีวูด
                </p>

                <div id="terminal" class="terminal"></div>

                <div
                    class="center"
                    style="margin-top:18px"
                >

                    <button
                        id="hackStart"
                        class="primary"
                    >
                        เริ่มกระบวนการ
                    </button>

                </div>
            `);

            $('#hackStart').addEventListener(
                'click',
                runHack
            );
        },


        /* -------------------------------------------------
           Love Scanner
           ------------------------------------------------- */

        love() {

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>❤️ Love Scanner</h2>

                    <p class="sub">
                        ค้นหาเนื้อคู่จากชื่อของคุณ
                    </p>

                    <input
                        id="name"
                        required
                        placeholder="ใส่ชื่อของคุณ"
                    >

                    <br><br>

                    <button
                        id="loveStart"
                        class="primary"
                    >
                        เริ่มค้นหา
                    </button>

                    <div id="loveOut"></div>

                </div>
            `);

            $('#loveStart').addEventListener(
                'click',
                findLove
            );
        },


        /* -------------------------------------------------
           เครื่องมือปั่นเพื่อน
           ------------------------------------------------- */

        friend() {

            gameContent().innerHTML = box(`
                <div class="center">

                    <h2>🔨 เครื่องมือปั่นเพื่อน</h2>

                    <p class="sub">
                        สร้างผลตรวจขำ ๆ แล้วให้เพื่อนดู
                    </p>

                    <input
                        id="friendName"
                        required
                        placeholder="ชื่อเพื่อน"
                    >

                    <br><br>

                    <button
                        id="friendStart"
                        class="primary"
                    >
                        วิเคราะห์
                    </button>

                    <div id="friendOut"></div>

                </div>
            `);

            $('#friendStart').addEventListener(
                'click',
                prankFriend
            );
        },


        /* -------------------------------------------------
           AI
           ------------------------------------------------- */

        ai() {

            aiStep = 0;
            aiScore = 0;

            gameContent().innerHTML = box(`
                <h2>🤖 AI วิเคราะห์บุคลิก</h2>

                <p class="sub">
                    ตอบ 3 ข้อ แล้วรับผลวิเคราะห์
                </p>

                <div id="aiQ"></div>
            `);

            showAI();
        },


        /* -------------------------------------------------
           Click Game
           ------------------------------------------------- */

        click() {

            window.location.href = 'games/click-speed/';
        },


        /* -------------------------------------------------
           Ghost Game
           ------------------------------------------------- */

        ghost() {

            startGhostGame();
        }

    };


    /* =====================================================
       LIE GAME
       ===================================================== */

    function showLie() {

        const questionBox = $('#lieQ');

        if (lieStep >= 3) {

            const number =
                Math.floor(Math.random() * 100) + 1;

            const text =
                lieConclusions[
                    Math.floor(
                        Math.random() *
                        lieConclusions.length
                    )
                ];

            questionBox.innerHTML = `
                <div class="center">

                    <div class="big">🔍</div>

                    <div class="result">
                        ตรวจพบความน่าสงสัย ${number}%
                    </div>

                    <p class="sub">
                        ${
                            number <= 10
                                ? 'ไม่มีอะไรให้สงสัย'
                                : 'คุณเคยโกหก'
                        }
                    </p>

                    <p class="sub">
                        ${text}
                    </p>

                    <button
                        id="lieAgain"
                        class="primary"
                    >
                        เล่นอีกครั้ง
                    </button>

                </div>
            `;

            $('#lieAgain').addEventListener(
                'click',
                () => openGame('lie')
            );

            return;
        }

        const questions = [
            'คุณเคยบอกว่า “กำลังจะนอน” แล้วเล่นมือถืออีก 2 ชั่วโมงไหม?',
            'คุณเคยเปิดตู้เย็นทั้งที่รู้ว่าไม่มีอะไรไหม?',
            'คุณเคยพูดว่า “แป๊บเดียว” แล้วหายไปเป็นชั่วโมงไหม?'
        ];

        questionBox.innerHTML = `
            <h3>
                ${questions[lieStep]}
            </h3>

            <div class="answers">

                <button
                    class="secondary lieAns"
                >
                    ใช่
                </button>

                <button
                    class="secondary lieAns"
                >
                    ไม่
                </button>

            </div>
        `;

        questionBox
            .querySelectorAll('.lieAns')
            .forEach(button => {

                button.addEventListener('click', () => {

                    lieStep++;

                    showLie();
                });

            });
    }


    /* =====================================================
       MONEY GAME
       ===================================================== */

    function moneyStep(step) {

        const game = gameContent();

        if (step === 1) {

            game.innerHTML = box(`
                <div class="center">

                    <h2>🔐 ยืนยันตัวตน</h2>

                    <p class="sub">
                        ระบบต้องการยืนยันว่าคุณเป็นมนุษย์
                    </p>

                    <div class="big">
                        🤖
                    </div>

                    <button
                        id="moneyHuman"
                        class="primary"
                    >
                        ฉันไม่ใช่บอท
                    </button>

                </div>
            `);

            $('#moneyHuman').addEventListener(
                'click',
                () => moneyStep(2)
            );

        } else if (step === 2) {

            game.innerHTML = box(`
                <div class="center">

                    <h2>⏳ กำลังโอนเงิน</h2>

                    <div class="progress">
                        <div
                            id="moneyBar"
                            class="bar"
                        ></div>
                    </div>

                    <p id="moneyPct">
                        0%
                    </p>

                </div>
            `);

            let progress = 0;

            const timer = setInterval(() => {

                progress += 10;

                if ($('#moneyBar')) {
                    $('#moneyBar').style.width =
                        progress + '%';
                }

                if ($('#moneyPct')) {
                    $('#moneyPct').textContent =
                        progress + '%';
                }

                if (progress >= 100) {

                    clearInterval(timer);

                    setTimeout(
                        () => moneyStep(3),
                        300
                    );
                }

            }, 150);

        } else {

            game.innerHTML = box(`
                <div class="center">

                    <h2>💸 เสร็จสิ้น!</h2>

                    <div class="big">
                        🗿
                    </div>

                    <div class="result">
                        เงินถูกส่งไปยังดาวอังคารแล้ว
                    </div>

                    <button
                        id="moneyAgain"
                        class="primary"
                    >
                        ลองใหม่
                    </button>

                </div>
            `);

            $('#moneyAgain').addEventListener(
                'click',
                () => openGame('money')
            );
        }
    }


    /* =====================================================
       FAKE HACKER
       ===================================================== */

    function runHack() {

        clearInterval(hackTimer);

        const terminal = $('#terminal');

        terminal.textContent = '';

        const lines = [
            'Initializing BAS secure shell...',
            'Connecting to target...',
            'Scanning firewall...',
            'Bypassing firewall [OK]',
            'Decrypting password...',
            'ACCESS GRANTED',
            'Downloading secrets...',
            '████████████████████ 100%',
            'Searching sensitive files...',
            'Found: cat.jpg',
            'Found: homework.txt',
            'Found: snacks.txt',
            '',
            'MISSION COMPLETE.',
            'สิ่งที่ได้มา: รูปแมว 1 รูป'
        ];

        let index = 0;

        hackTimer = setInterval(() => {

            terminal.textContent +=
                lines[index] + '\n';

            terminal.scrollTop =
                terminal.scrollHeight;

            index++;

            if (index >= lines.length) {

                clearInterval(hackTimer);

                setTimeout(
                    showCatModal,
                    250
                );
            }

        }, 260);
    }


    function showCatModal() {

        if ($('#catModal')) {
            $('#catModal').remove();
        }

        document.body.insertAdjacentHTML(
            'beforeend',
            `
            <div id="catModal" class="cat-modal">

                <div class="cat-card">

                    <button
                        id="catClose"
                        class="cat-close"
                        aria-label="ปิด"
                    >
                        ×
                    </button>

                    <h2>
                        🐱 MISSION COMPLETE
                    </h2>

                    <p>
                        สิ่งที่ได้มา: รูปแมว 1 รูป
                    </p>

                    <img
                        src="./png/cat.jpg"
                        alt="รูปแมว"
                    >

                    <button
                        id="catDone"
                        class="primary"
                    >
                        ปิด
                    </button>

                </div>

            </div>
            `
        );

        $('#catClose').addEventListener(
            'click',
            closeCat
        );

        $('#catDone').addEventListener(
            'click',
            closeCat
        );
    }


    function closeCat() {

        const modal = $('#catModal');

        if (modal) {
            modal.remove();
        }
    }


    /* =====================================================
       LOVE SCANNER
       ===================================================== */

    function findLove() {

        const input = $('#name');

        const name =
            (input.value || '').trim();

        if (!name) {

            input.focus();

            toast('กรุณาใส่ชื่อก่อน');

            return;
        }

        const results = [
            'แมวข้างบ้าน',
            'คนที่อ่านข้อความแล้วไม่ตอบ',
            'คนที่อยู่ใกล้กว่าที่คิด',
            'ตัวคุณเอง',
            'คนที่กำลังหาเนื้อคู่เหมือนกัน'
        ];

        const result =
            results[
                Math.floor(
                    Math.random() *
                    results.length
                )
            ];

        const compatibility =
            60 +
            Math.floor(
                Math.random() * 41
            );

        $('#loveOut').innerHTML = `
            <div class="fakecard">

                <b>
                    ผลการค้นหา:
                    ${escapeHtml(name)}
                </b>

                <p>
                    คู่ที่เข้ากันได้มากที่สุดคือ...
                </p>

                <div class="result">
                    ${result}
                </div>

                <p class="sub">
                    ความเข้ากันได้:
                    ${compatibility}%
                </p>

            </div>
        `;
    }


    /* =====================================================
       PRANK FRIEND
       ===================================================== */

    function prankFriend() {

        const input = $('#friendName');

        const name =
            (input.value || '').trim();

        if (!name) {

            input.focus();

            toast('กรุณาใส่ชื่อเพื่อนก่อน');

            return;
        }

        const score =
            Math.floor(
                Math.random() * 101
            );

        const text =
            prankConclusions[
                Math.floor(
                    Math.random() *
                    prankConclusions.length
                )
            ];

        $('#friendOut').innerHTML = `
            <div class="fakecard">

                <h3>
                    รายงานการวิเคราะห์
                </h3>

                <p>
                    ผู้ถูกวิเคราะห์:
                    <b>${escapeHtml(name)}</b>
                </p>

                <p>
                    ระดับความปั่น:
                    ${score}%
                </p>

                <div class="meter">
                    <div
                        style="width:${score}%"
                    ></div>
                </div>

                <p class="warn">
                    ข้อสรุป:
                    ${text}
                </p>

            </div>
        `;
    }


    /* =====================================================
       AI GAME
       ===================================================== */

    function showAI() {

        const questionBox = $('#aiQ');

        if (aiStep >= 3) {

            const labels = [
                'สายวางแผน',
                'สายชิล',
                'สายปั่นระดับตำนาน'
            ];

            questionBox.innerHTML = `
                <div class="center">

                    <div class="big">
                        🤖
                    </div>

                    <div class="result">
                        ${labels[Math.min(aiScore, 2)]}
                    </div>

                    <p class="sub">
                        ความสามารถในการปั่น:
                        ${65 + aiScore * 15}%
                    </p>

                    <button
                        id="aiAgain"
                        class="primary"
                    >
                        วิเคราะห์ใหม่
                    </button>

                </div>
            `;

            $('#aiAgain').addEventListener(
                'click',
                () => openGame('ai')
            );

            return;
        }

        const question =
            aiQs[aiStep];

        questionBox.innerHTML = `
            <h3>
                ${question[0]}
            </h3>

            <div class="answers">

                ${question
                    .slice(1)
                    .map(
                        (text, index) => `
                            <button
                                class="secondary aiAns"
                                data-score="${index}"
                            >
                                ${text}
                            </button>
                        `
                    )
                    .join('')
                }

            </div>
        `;

        questionBox
            .querySelectorAll('.aiAns')
            .forEach(button => {

                button.addEventListener(
                    'click',
                    () => {

                        aiScore += Number(
                            button.dataset.score
                        );

                        aiStep++;

                        showAI();
                    }
                );

            });
    }


    /* =====================================================
       CLICK GAME
       ===================================================== */

    function startClickGame() {

        clearInterval(targetTimer);
        clearInterval(targetMoveTimer);

        targetScore = 0;
        targetTime = 15;

        clickRounds++;

        gameContent().innerHTML = box(`
            <h2>🖱️ จับวงกลมให้ได้</h2>

            <div class="score">

                <span>
                    คะแนน:
                    <b id="sc">0</b>
                </span>

                <span>
                    เวลา:
                    <b id="tm">15</b>s
                </span>

            </div>

            <div
                id="arena"
                class="target-area"
            ></div>

            <div
                class="center"
                style="margin-top:18px"
            >

                <button
                    id="clickRestart"
                    class="secondary"
                >
                    เริ่มใหม่
                </button>

            </div>
        `);

        $('#clickRestart').addEventListener(
            'click',
            startClickGame
        );

        moveTarget();

        targetTimer = setInterval(() => {

            targetTime--;

            if ($('#tm')) {
                $('#tm').textContent =
                    targetTime;
            }

            if (targetTime <= 0) {

                clearInterval(targetTimer);
                clearInterval(targetMoveTimer);

                const arena = $('#arena');

                if (arena) {

                    arena.innerHTML = `
                        <div
                            class="center"
                            style="padding-top:110px"
                        >

                            <div class="result">
                                หมดเวลา!
                                ${targetScore} คะแนน
                            </div>

                        </div>
                    `;
                }
            }

        }, 1000);

        const arena = $('#arena');

        arena.addEventListener(
            'mousemove',
            (event) => {

                const target = $('#target');

                if (
                    !target ||
                    target.dataset.flying === '1'
                ) {
                    return;
                }

                const rect =
                    target.getBoundingClientRect();

                const dx =
                    event.clientX -
                    (
                        rect.left +
                        rect.width / 2
                    );

                const dy =
                    event.clientY -
                    (
                        rect.top +
                        rect.height / 2
                    );

                const distance =
                    Math.hypot(dx, dy);

                if (distance < 115) {
                    moveAway(dx, dy);
                }
            }
        );

        arena.addEventListener(
            'touchstart',
            (event) => {

                const target = $('#target');

                if (!target) return;

                const point =
                    event.touches[0];

                const rect =
                    target.getBoundingClientRect();

                const distance =
                    Math.hypot(
                        point.clientX -
                            (
                                rect.left +
                                rect.width / 2
                            ),

                        point.clientY -
                            (
                                rect.top +
                                rect.height / 2
                            )
                    );

                if (distance < 140) {
                    moveTarget();
                }

            },
            {
                passive: true
            }
        );
    }


    function safePosition(arena) {

        const padding = 4;

        const width = 55;
        const height = 55;

        return {
            x: Math.max(
                padding,
                Math.random() *
                    (
                        arena.clientWidth -
                        width -
                        padding
                    )
            ),

            y: Math.max(
                padding,
                Math.random() *
                    (
                        arena.clientHeight -
                        height -
                        padding
                    )
            )
        };
    }


    function moveTarget() {

        if (targetTime <= 0) return;

        const arena = $('#arena');

        if (!arena) return;

        const position =
            safePosition(arena);

        arena.innerHTML = `
            <button
                id="target"
                class="target"
                aria-label="เป้าหมาย"
            ></button>
        `;

        const target = $('#target');

        target.style.left =
            position.x + 'px';

        target.style.top =
            position.y + 'px';

        target.addEventListener(
            'click',
            targetHit
        );

        if (Math.random() < 0.22) {
            startDrift();
        }
    }


    function moveAway(dx, dy) {

        const arena = $('#arena');
        const target = $('#target');

        if (!arena || !target) return;

        const targetRect =
            target.getBoundingClientRect();

        const arenaRect =
            arena.getBoundingClientRect();

        const centerX =
            targetRect.left +
            targetRect.width / 2;

        const centerY =
            targetRect.top +
            targetRect.height / 2;

        let vx = -dx;
        let vy = -dy;

        const length =
            Math.hypot(vx, vy) || 1;

        vx /= length;
        vy /= length;

        let x =
            (centerX - arenaRect.left) +
            vx * (
                90 +
                Math.random() * 70
            ) -
            27.5;

        let y =
            (centerY - arenaRect.top) +
            vy * (
                90 +
                Math.random() * 70
            ) -
            27.5;

        x = Math.max(
            4,
            Math.min(
                arena.clientWidth - 59,
                x
            )
        );

        y = Math.max(
            4,
            Math.min(
                arena.clientHeight - 59,
                y
            )
        );

        target.style.transition =
            'left .18s ease, top .18s ease';

        target.style.left =
            x + 'px';

        target.style.top =
            y + 'px';

        setTimeout(() => {

            if (target) {
                target.style.transition = '';
            }

        }, 190);
    }


    function startDrift() {

        clearInterval(targetMoveTimer);

        targetMoveTimer = setInterval(() => {

            const target = $('#target');

            if (
                !target ||
                target.dataset.flying === '1' ||
                targetTime <= 0
            ) {

                clearInterval(targetMoveTimer);

                return;
            }

            moveAway(
                Math.random() - 0.5,
                Math.random() - 0.5
            );

        }, 700 + Math.random() * 700);
    }


    function targetHit(event) {

        event.stopPropagation();

        const target =
            event.currentTarget;

        if (target.dataset.flying === '1') {
            return;
        }

        targetScore++;

        if ($('#sc')) {
            $('#sc').textContent =
                targetScore;
        }

        if (targetScore % 3 === 2) {
            flyOut();
        } else {
            moveTarget();
        }
    }


    function flyOut() {

        const target = $('#target');

        if (!target) return;

        target.dataset.flying = '1';

        clearInterval(targetMoveTimer);

        const rect =
            target.getBoundingClientRect();

        target.style.position = 'fixed';
        target.style.left = rect.left + 'px';
        target.style.top = rect.top + 'px';
        target.style.zIndex = '99999';

        target.style.transition =
            'left .7s ease-out, top .7s ease-out, opacity .7s';

        requestAnimationFrame(() => {

            target.style.left = '120vw';
            target.style.top = '-30vh';
            target.style.opacity = '0';

        });

        setTimeout(() => {

            if (targetTime <= 0) return;

            const arena = $('#arena');

            if (!arena) return;

            const position =
                safePosition(arena);

            target.style.transition = 'none';
            target.style.opacity = '0';
            target.style.position = 'absolute';

            target.style.left =
                position.x + 'px';

            target.style.top =
                position.y + 'px';

            target.style.zIndex = '';

            arena.appendChild(target);

            requestAnimationFrame(() => {

                target.style.transition =
                    'opacity .35s';

                target.style.opacity = '1';

                target.dataset.flying = '0';

                startDrift();

            });

        }, 3000);
    }


    /* =====================================================
       GHOST GAME
       -----------------------------------------------------
       ส่วนนี้คง logic เดิมไว้
       ===================================================== */

    function stopGhostGame() {

        if (ghostRAF) {

            cancelAnimationFrame(ghostRAF);

            ghostRAF = null;
        }

        if (ghostKeyHandler) {

            document.removeEventListener(
                'keydown',
                ghostKeyHandler
            );

            ghostKeyHandler = null;
        }

        ghostState = null;
    }


    function startGhostGame() {

        stopGhostGame();

        const mobile =
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia(
                '(pointer:coarse)'
            ).matches;

        gameContent().innerHTML = box(`
            <div class="ghost-game">

                <h2>
                    👻 ผีกระโดดตกแมพ
                </h2>

                <p class="sub">
                    กระโดดจากพื้นหนึ่งไปอีกพื้นหนึ่ง
                    อย่าตกลงไปข้างล่าง...
                </p>

                <div class="ghost-hud">

                    <span>
                        กระโดด:
                        <b id="ghostJumps">0</b>
                    </span>

                    <span>
                        ระยะทาง:
                        <b id="ghostDistance">0</b> m
                    </span>

                </div>

                <div
                    id="ghostArena"
                    class="ghost-arena"
                >

                    <div
                        id="ghostWorld"
                        class="ghost-world"
                    >

                        <div
                            id="ghostPlayer"
                            class="ghost-player"
                        ></div>

                    </div>

                    <div
                        id="ghostStartOverlay"
                        style="
                            position:absolute;
                            inset:0;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            background:rgba(0,0,0,.72);
                            z-index:999;
                            pointer-events:auto
                        "
                    >

                        <div class="center">

                            <div style="font-size:42px">
                                👻
                            </div>

                            <h3 style="margin:8px 0">
                                กดเพื่อเริ่มเกม
                            </h3>

                            <p
                                class="sub"
                                style="font-size:18px"
                            >
                                ${
                                    mobile
                                        ? 'กดปุ่ม JUMP'
                                        : 'กด SPACEBAR'
                                }
                            </p>

                        </div>

                    </div>

                </div>

                <button
                    id="ghostJump"
                    class="primary ghost-jump"
                    type="button"
                >
                    JUMP
                </button>

                <div class="ghost-hint">
                    ${
                        mobile
                            ? 'กดปุ่ม JUMP เพื่อเริ่มและกระโดด'
                            : 'กด Spacebar เพื่อเริ่มและกระโดด'
                    }
                </div>

                <div
                    id="ghostStatus"
                    class="center result"
                    style="font-size:18px"
                >
                    รอเริ่มเกม...
                </div>

            </div>
        `);

        const arena = $('#ghostArena');
        const world = $('#ghostWorld');
        const player = $('#ghostPlayer');
        const jumpBtn = $('#ghostJump');

        ghostState = {

            arena,
            world,
            player,

            x: 65,
            y: 238,

            vy: 0,
            vx: 2.7,

            grounded: true,

            jumps: 0,
            distance: 0,

            platforms: [],

            active: false,
            started: false,

            lastY: 238,

            audio: new Audio(
                './scream/scream.mp3'
            )
        };

        ghostState.audio.preload = 'auto';
        ghostState.audio.load();


        /* -------------------------------------------------
           สร้างพื้น
           ------------------------------------------------- */

        let x = 15;

        ghostState.platforms.push({
            x,
            y: 280,
            w: 180,
            missing: false
        });

        for (let i = 1; i < 30; i++) {

            x +=
                125 +
                Math.random() * 75;

            const previous =
                ghostState.platforms[i - 1].y;

            let y =
                previous +
                (
                    Math.random() * 100 -
                    50
                );

            y = Math.max(
                165,
                Math.min(285, y)
            );

            ghostState.platforms.push({

                x,
                y,

                w:
                    105 +
                    Math.random() * 65,

                missing: false

            });
        }


        /* -------------------------------------------------
           แสดงพื้น
           ------------------------------------------------- */

        ghostState.platforms.forEach(
            (platform, index) => {

                const element =
                    document.createElement('div');

                element.className =
                    'ghost-platform';

                element.style.left =
                    platform.x + 'px';

                element.style.top =
                    platform.y + 'px';

                element.style.width =
                    platform.w + 'px';

                element.dataset.index =
                    index;

                world.insertBefore(
                    element,
                    player
                );

                platform.el = element;
            }
        );


        /* -------------------------------------------------
           กระโดด
           ------------------------------------------------- */

        const jump = () => {

            const game = ghostState;

            if (
                !game ||
                !game.active ||
                !game.grounded
            ) {
                return;
            }

            game.vy = -11;

            game.grounded = false;

            game.jumps++;

            $('#ghostJumps').textContent =
                game.jumps;


            /* ---------------------------------------------
               สุ่มทำพื้นหาย
               --------------------------------------------- */

            if (
                game.jumps >= 5 &&
                Math.random() < 0.30
            ) {

                const next =
                    game.platforms.find(
                        platform =>
                            !platform.missing &&
                            platform.x > game.x + 35
                    );

                if (next) {

                    next.missing = true;

                    next.el.style.opacity = '0';

                    next.el.style.pointerEvents =
                        'none';
                }
            }
        };


        /* -------------------------------------------------
           เริ่มเกม
           ------------------------------------------------- */

        const start = () => {

            const game = ghostState;

            if (!game || game.started) {
                return;
            }

            game.started = true;
            game.active = true;

            game.audio.volume = 1;
            game.audio.currentTime = 0;

            game.audio
                .play()
                .then(() => {

                    game.audio.pause();
                    game.audio.currentTime = 0;

                })
                .catch(() => {});


            const overlay =
                $('#ghostStartOverlay');

            if (overlay) {
                overlay.remove();
            }

            if ($('#ghostStatus')) {

                $('#ghostStatus').textContent =
                    'เริ่มแล้ว!';
            }

            // การกดครั้งแรกใช้เริ่มเกมอย่างเดียว
            ghostRAF =
                requestAnimationFrame(loop);
        };


        /* -------------------------------------------------
           Keyboard
           ------------------------------------------------- */

        ghostKeyHandler = (event) => {

            if (event.code !== 'Space' || event.repeat) {
                return;
            }

            event.preventDefault();

            if (!ghostState?.started) {

                start();

            } else {

                jump();
            }
        };

        document.addEventListener(
            'keydown',
            ghostKeyHandler
        );


        /* -------------------------------------------------
           ปุ่ม JUMP
           ------------------------------------------------- */

        jumpBtn.addEventListener(
            'click',
            () => {

                if (!ghostState?.started) {

                    start();

                } else {

                    jump();
                }
            }
        );


        /* -------------------------------------------------
           Touch
           ------------------------------------------------- */

        let touchStart = 0;

        arena.addEventListener(
            'touchstart',
            () => {

                touchStart = Date.now();

            },
            {
                passive: true
            }
        );

        arena.addEventListener(
            'touchend',
            () => {

                if (
                    Date.now() -
                    touchStart <
                    500
                ) {

                    if (!ghostState?.started) {

                        start();

                    } else {

                        jump();
                    }
                }

            },
            {
                passive: true
            }
        );


        /* -------------------------------------------------
           Game Loop
           ------------------------------------------------- */

        function loop() {

            const game = ghostState;

            if (!game || !game.active) {
                return;
            }

            game.lastY = game.y;

            game.x += game.vx;

            game.vy += 0.52;

            game.y += game.vy;


            /* ---------------------------------------------
               ตรวจชนพื้น
               --------------------------------------------- */

            if (game.vy >= 0) {

                for (const platform of game.platforms) {

                    if (platform.missing) {
                        continue;
                    }

                    const wasAbove =
                        game.lastY + 42 <=
                        platform.y;

                    const nowCross =
                        game.y + 42 >=
                        platform.y;

                    const overlap =
                        game.x + 30 >
                            platform.x &&
                        game.x <
                            platform.x +
                            platform.w;

                    if (
                        wasAbove &&
                        nowCross &&
                        overlap
                    ) {

                        game.y =
                            platform.y - 42;

                        game.vy = 0;

                        game.grounded = true;

                        break;
                    }
                }
            }


            /* ---------------------------------------------
               อัปเดตตัวละคร
               --------------------------------------------- */

            player.style.left =
                game.x + 'px';

            player.style.top =
                game.y + 'px';


            /* ---------------------------------------------
               Camera
               --------------------------------------------- */

            const camera =
                Math.max(
                    0,
                    game.x - 170
                );

            world.style.transform =
                `translateX(${-camera}px)`;


            /* ---------------------------------------------
               Distance
               --------------------------------------------- */

            game.distance =
                Math.floor(game.x / 10);

            $('#ghostDistance').textContent =
                game.distance;


            /* ---------------------------------------------
               ตกแมพ
               --------------------------------------------- */

            if (game.y > 390) {

                game.active = false;

                if ($('#ghostStatus')) {

                    $('#ghostStatus').textContent =
                        'ตกแมพ...';
                }

                setTimeout(
                    showGhostJumpscare,
                    180
                );

                return;
            }

            ghostRAF =
                requestAnimationFrame(loop);
        }
    }


    /* =====================================================
       GHOST JUMPSCARE
       ===================================================== */

    function showGhostJumpscare() {

        const old = ghostState;

        const audio = old?.audio;

        stopGhostGame();

        if ($('#ghostScare')) {
            $('#ghostScare').remove();
        }

        document.body.insertAdjacentHTML(
            'beforeend',
            `
            <div id="ghostScare" class="jumpscare">

                <video
                    id="ghostVideo"
                    src="./video/ghost_jumpscare.mp4"
                    autoplay
                    muted
                    playsinline
                ></video>

                <button
                    id="ghostRetry"
                    class="primary ghost-retry"
                >
                    เล่นอีกครั้ง
                </button>

            </div>
            `
        );

        const video =
            $('#ghostVideo');


        const playScare = () => {

            video.currentTime = 0;

            video.play().catch(() => {});

            if (audio) {

                audio.currentTime = 0;

                audio.volume = 1;

                audio.play().catch(() => {});
            }
        };


        if (video.readyState >= 2) {

            playScare();

        } else {

            video.addEventListener(
                'loadeddata',
                playScare,
                {
                    once: true
                }
            );
        }


        $('#ghostRetry').addEventListener(
            'click',
            () => {

                $('#ghostScare')?.remove();

                openGame('ghost');
            }
        );
    }


    /* =====================================================
       COMMON HELPERS
       ===================================================== */

    function toast(text) {

        const element = $('#toast');

        element.textContent = text;

        element.classList.add('show');

        setTimeout(
            () => element.classList.remove('show'),
            1800
        );
    }


    function escapeHtml(text) {

        return text.replace(
            /[&<>"']/g,
            char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char])
        );
    }


    /* =====================================================
       MUSIC
       ===================================================== */

    async function initMusicSettings() {

        const button =
            document.getElementById(
                'basMusicSettingsBtn'
            );

        const panel =
            document.getElementById(
                'basMusicSettings'
            );

        const select =
            document.getElementById(
                'basMusicTrack'
            );

        const volume =
            document.getElementById(
                'basMusicVolume'
            );

        const volumeText =
            document.getElementById(
                'basMusicVolText'
            );

        const toggle =
            document.getElementById(
                'basMusicToggle'
            );


        if (
            !button ||
            !panel ||
            !select ||
            !volume ||
            !volumeText ||
            !toggle
        ) {
            return;
        }


        /* -------------------------------------------------
           Audio
           ------------------------------------------------- */

        const audio =
            document.createElement('audio');

        audio.id =
            'basBackgroundMusic';

        audio.preload = 'auto';

        audio.loop = false;

        document.body.appendChild(audio);


        /* -------------------------------------------------
           เพลง: Cloudflare R2 ก่อน / Local เป็น fallback
           ------------------------------------------------- */
        const localTracks = Array.from(
            { length: 10 },
            (_, index) => ({
                name: `เพลง ${index + 1}`,
                url: `./sound/song${index + 1}.mp3`
            })
        );

        let tracks = localTracks.slice();

        try {
            const remote = await basApi('/api/music');
            if (remote?.success && Array.isArray(remote.music) && remote.music.length) {
                tracks = remote.music.map(item => ({
                    id: item.id,
                    name: item.name || item.filename || `เพลง ${item.id}`,
                    url: `${BAS_API}/music/${item.id}`
                }));
            }
        } catch (error) {
            console.warn('[BAS LAB MUSIC] ใช้เพลง Local แทน', error);
        }

        /* -------------------------------------------------
           Settings
           ------------------------------------------------- */

        let index =
            Math.max(
                0,
                Math.min(
                    Math.max(0, tracks.length - 1),
                    Number(
                        localStorage.getItem(
                            'basMusicTrack'
                        ) || 0
                    )
                )
            );

        let userPaused =
            localStorage.getItem(
                'basMusicPaused'
            ) === '1';


        audio.volume =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(
                        localStorage.getItem(
                            'basMusicVolume'
                        ) || 35
                    ) / 100
                )
            );


        /* -------------------------------------------------
           สร้างรายการเพลง
           ------------------------------------------------- */

        select.innerHTML = tracks.length
            ? tracks.map((track, i) =>
                `<option value="${i}">${escapeHtml(track.name)}</option>`
            ).join('')
            : '<option value="0">ไม่มีเพลง</option>';


        select.value =
            String(index);

        volume.value =
            Math.round(
                audio.volume * 100
            );

        volumeText.textContent =
            volume.value + '%';


        /* -------------------------------------------------
           Update UI
           ------------------------------------------------- */

        const update = () => {

            volumeText.textContent =
                Math.round(
                    audio.volume * 100
                ) + '%';

            toggle.textContent =
                audio.paused
                    ? '▶️ เล่นเพลง'
                    : '⏸️ หยุดเพลง';
        };


        /* -------------------------------------------------
           Play
           ------------------------------------------------- */

        const play = () => {

            if (userPaused) return;

            audio
                .play()
                .catch(() => {});

            update();
        };


        /* -------------------------------------------------
           Load เพลง
           ------------------------------------------------- */

        const load = (newIndex, autoPlay) => {

            index = tracks.length ? ((newIndex % tracks.length) + tracks.length) % tracks.length : 0;

            localStorage.setItem(
                'basMusicTrack',
                index
            );

            select.value =
                String(index);

            audio.src =
                tracks[index]?.url || '';
            audio.setAttribute('data-track-name', tracks[index]?.name || '');

            audio.load();

            if (
                autoPlay &&
                !userPaused
            ) {
                play();
            }
        };


        /* -------------------------------------------------
           เพลงจบ → เพลงถัดไป
           ------------------------------------------------- */

        audio.addEventListener(
            'ended',
            () => {
                load(index + 1, true);
            }
        );


        /* -------------------------------------------------
           เพลง Error → เพลงถัดไป
           ------------------------------------------------- */

        audio.addEventListener(
            'error',
            () => {

                if (!userPaused) {

                    setTimeout(
                        () => load(index + 1, true),
                        50
                    );
                }
            }
        );


        /* -------------------------------------------------
           เปิด / ปิด Panel
           ------------------------------------------------- */

        button.addEventListener(
            'click',
            (event) => {

                event.stopPropagation();

                panel.classList.toggle('show');
            }
        );


        panel.addEventListener(
            'click',
            event => {
                event.stopPropagation();
            }
        );


        /* -------------------------------------------------
           เปลี่ยนเพลง
           ------------------------------------------------- */

        select.addEventListener(
            'change',
            () => {

                userPaused = false;

                localStorage.setItem(
                    'basMusicPaused',
                    '0'
                );

                load(
                    Number(select.value),
                    true
                );
            }
        );


        /* -------------------------------------------------
           Volume
           ------------------------------------------------- */

        volume.addEventListener(
            'input',
            () => {

                audio.volume =
                    Number(volume.value) / 100;

                localStorage.setItem(
                    'basMusicVolume',
                    volume.value
                );

                update();
            }
        );


        /* -------------------------------------------------
           Play / Pause
           ------------------------------------------------- */

        toggle.addEventListener(
            'click',
            () => {

                if (audio.paused) {

                    userPaused = false;

                    localStorage.setItem(
                        'basMusicPaused',
                        '0'
                    );

                    play();

                } else {

                    userPaused = true;

                    localStorage.setItem(
                        'basMusicPaused',
                        '1'
                    );

                    audio.pause();

                    update();
                }
            }
        );


        /* -------------------------------------------------
           Unlock Audio
           ------------------------------------------------- */

        const unlock = () => {

            if (
                !userPaused &&
                audio.paused
            ) {
                play();
            }
        };


        [
            'pointerdown',
            'keydown',
            'touchstart'
        ].forEach(eventName => {

            document.addEventListener(
                eventName,
                unlock,
                {
                    passive: true
                }
            );
        });


        /* -------------------------------------------------
           เริ่มเพลง
           ------------------------------------------------- */

        load(index, false);

        update();
    }


    /* =====================================================
       LEADERBOARD UI
       ===================================================== */

    async function loadLeaderboard() {
        const list = $('#basLeaderboardList');
        if (!list) return;

        list.innerHTML = 'กำลังโหลด...';
        const data = await basApi('/api/leaderboard');

        if (!data?.success || !Array.isArray(data.leaderboard) || !data.leaderboard.length) {
            list.innerHTML = '<div class="result center">ยังไม่มีคะแนนในระบบ</div>';
            return;
        }

        list.innerHTML = data.leaderboard.map((row, i) => `
            <div class="lb-row">
                <div class="lb-rank">#${i + 1}</div>
                <div class="lb-name">${escapeHtml(String(row.username || '-'))}</div>
                <div class="lb-score">${Number(row.score || 0).toLocaleString()}</div>
            </div>
        `).join('');
    }

    function initLeaderboard() {
        const modal = $('#basLeaderboardModal');
        const open = $('#basLeaderboardBtn');
        const close = $('#basLeaderboardClose');
        if (!modal || !open || !close) return;

        const hide = () => {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
        };

        open.addEventListener('click', async () => {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            await loadLeaderboard();
        });

        close.addEventListener('click', hide);
        modal.addEventListener('click', event => {
            if (event.target === modal) hide();
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') hide();
        });
    }


    /* =====================================================
       PAGE READY
       ===================================================== */

    document.addEventListener(
        'DOMContentLoaded',
        () => {

            document.body.dataset.prankLabReady =
                'true';

            initMusicSettings();
            initLeaderboard();
        }
    );

})();