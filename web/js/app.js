document.addEventListener("DOMContentLoaded", () => {

    const loginBtn = document.getElementById("loginBtn");
    const profileLoginBtn = document.getElementById("profileLoginBtn");

    function openLogin() {
        window.location.href = "login.html";
    }

    loginBtn?.addEventListener("click", openLogin);
    profileLoginBtn?.addEventListener("click", openLogin);


    document.querySelectorAll(".play-btn").forEach((button) => {

        button.addEventListener("click", () => {

            const game = button.dataset.game;

            alert(`เกม ${game} จะเปิดในขั้นตอนถัดไป`);

        });

    });

});