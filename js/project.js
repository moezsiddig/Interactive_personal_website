// Get form elements from the page
const requestForm = document.getElementById("requestForm");
const userName = document.getElementById("name");
const userEmail = document.getElementById("email");
const projectType = document.getElementById("projectType");
const budget = document.getElementById("budget");
const message = document.getElementById("message");
const formResult = document.getElementById("formResult");

const honeypot = document.getElementById("website");    // hidden trap field for spam bots
const sendButton = requestForm.querySelector("button[type='submit']");

// Where project requests are sent.
// FormSubmit (free, no account) forwards the form to this inbox.
const CONTACT_EMAIL = "moezsiddig@gmail.com";
const FORM_ENDPOINT = "https://formsubmit.co/ajax/" + CONTACT_EMAIL;

function requestSubject() {
    return "Project request: " + projectType.value + " (" + userName.value.trim() + ")";
}

// Send the request straight to Moez's inbox. Resolves true when it arrived.
function sendRequest() {
    return fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
            name: userName.value.trim(),
            email: userEmail.value.trim(),
            project_type: projectType.value,
            budget: budget.value,
            message: message.value.trim(),
            _subject: requestSubject(),
            _replyto: userEmail.value.trim(),   // pressing Reply answers the visitor
            _template: "table",
            _honey: honeypot ? honeypot.value : ""
        })
    })
        .then(function (response) { return response.json(); })
        .then(function (data) { return data.success === true || data.success === "true"; })
        .catch(function () { return false; });
}

// Backup plan: a "mailto:" link that opens the visitor's own email app
// with the request ready to send. encodeURIComponent makes the text safe in a link.
function buildRequestEmail() {
    const subject = requestSubject();
    const body = [
        "Hello Moez,",
        "",
        message.value.trim(),
        "",
        "Name: " + userName.value.trim(),
        "Email: " + userEmail.value.trim(),
        "Project type: " + projectType.value,
        "Budget: " + budget.value
    ].join("\n");

    return "mailto:" + CONTACT_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
}

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

    // Send it, and stop double clicks while it is on its way
    sendButton.disabled = true;
    showResult("Sending your request...", false);

    sendRequest().then(function (sent) {
        sendButton.disabled = false;
        if (sent) {
            showResult("Thank you! Your request was sent. I will reply to you by email soon.", false);
            requestForm.reset();
        } else {
            // The service did not answer: open the visitor's email app instead
            window.location.href = buildRequestEmail();
            showResult("Your email app is opening with your request. Just press Send! " +
                "If nothing opens, email me at " + CONTACT_EMAIL + ".", false);
        }
    });
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
