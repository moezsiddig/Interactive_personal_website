// Get form elements from the page
const requestForm = document.getElementById("requestForm");
const userName = document.getElementById("name");
const userEmail = document.getElementById("email");
const projectType = document.getElementById("projectType");
const budget = document.getElementById("budget");
const message = document.getElementById("message");
const formResult = document.getElementById("formResult");

// Show a message under the form
function showResult(text, isError) {
    formResult.textContent = text;
    formResult.className = isError ? "form-error" : "form-success";
}

// Run this code when the user submits the form
requestForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (
        userName.value.trim() === "" ||
        userEmail.value.trim() === "" ||
        projectType.value === "" ||
        budget.value === "" ||
        message.value.trim() === ""
    ) {
        showResult("Please complete all fields.", true);
        return;
    }

    // Check if the email address is valid
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(userEmail.value.trim())) {
        showResult("Please enter a valid email address.", true);
        return;
    }

    // Build the summary with textContent (never innerHTML) so that
    // anything the user types is shown as plain text, not run as code.
    formResult.textContent = "";
    formResult.className = "form-success";

    const heading = document.createElement("strong");
    heading.textContent = "Request Submitted Successfully!";
    formResult.appendChild(heading);

    const lines = [
        "Name: " + userName.value.trim(),
        "Email: " + userEmail.value.trim(),
        "Project: " + projectType.value,
        "Budget: " + budget.value,
        "Message: " + message.value.trim()
    ];

    lines.forEach(function (line) {
        formResult.appendChild(document.createElement("br"));
        formResult.appendChild(document.createTextNode(line));
    });

    requestForm.reset();
});

// Dark Mode Button (the choice is remembered for the next visit)
const darkModeBtn = document.getElementById("darkModeBtn");

function setDarkMode(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    darkModeBtn.innerHTML = isDark
        ? '<i class="fas fa-sun"></i> Light'
        : '<i class="fas fa-moon"></i> Dark';
    darkModeBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
}

let savedTheme = null;
try {
    savedTheme = localStorage.getItem("theme");
} catch (e) {
    // Storage can be blocked (private mode); the page still works without it
}
setDarkMode(savedTheme === "dark");

darkModeBtn.addEventListener("click", function () {
    const isDark = !document.body.classList.contains("dark-mode");
    setDarkMode(isDark);
    try {
        localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch (e) {
        // Ignore storage errors
    }
});

// Mobile menu button
const menuToggle = document.getElementById("menuToggle");
const navigation = document.querySelector(".navigation");

menuToggle.addEventListener("click", function () {
    const isOpen = navigation.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

// Close the mobile menu after choosing a link
navigation.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
        navigation.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    });
});

// Add a shadow to the header once the page is scrolled
const header = document.querySelector("header");
window.addEventListener("scroll", function () {
    header.classList.toggle("scrolled", window.scrollY > 10);
});

// Current year in the footer
document.getElementById("year").textContent = new Date().getFullYear();
