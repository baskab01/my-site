document.addEventListener("DOMContentLoaded", () => {

    const loginBtn = document.getElementById("loginBtn");
    const profileLoginBtn = document.getElementById("profileLoginBtn");

    function openLogin() {
        alert("ระบบ Login จะเพิ่มในขั้นตอนถัดไป");
    }

    loginBtn?.addEventListener("click", openLogin);
    profileLoginBtn?.addEventListener("click", openLogin);


    document.querySelectorAll(".play-btn").forEach((button) => {

        button.addEventListener("click", () => {

            const game = button.dataset.game;

            console.log("Selected game:", game);

            alert(`เกม ${game} จะเปิดในขั้นตอนถัดไป`);
        });

    });

});