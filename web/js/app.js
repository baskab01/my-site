document.addEventListener("DOMContentLoaded", () => {
    console.log("BAS LAB started");

    const loginButtons = [
        document.getElementById("loginBtn"),
        document.getElementById("loginHeroBtn"),
        document.getElementById("profileLoginBtn")
    ];

    loginButtons.forEach((button) => {
        if (!button) return;

        button.addEventListener("click", () => {
            alert("ระบบเข้าสู่ระบบจะสร้างในขั้นตอนถัดไป");
        });
    });
});