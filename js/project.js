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

// ---------- Validation: one rule per field, each with its own message ----------
// Every rule returns "" when the value is fine, or the message to show.
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 1000;

const rules = {
    name: function (value) {
        if (value === "") return "Please enter your name.";
        if (value.length < 2) return "Your name should be at least 2 letters.";
        // Letters from any language, plus spaces, hyphens, apostrophes and dots
        if (!/^[\p{L}\s'.-]+$/u.test(value)) return "Please use letters only in your name.";
        return "";
    },
    email: function (value) {
        if (value === "") return "Please enter your email address.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Please enter a valid email, like name@example.com.";
        return "";
    },
    projectType: function (value) {
        return value === "" ? "Please choose a project type." : "";
    },
    budget: function (value) {
        return value === "" ? "Please choose a budget." : "";
    },
    message: function (value) {
        if (value === "") return "Please tell me about your project.";
        if (value.length < MESSAGE_MIN) {
            return "Please add a little more detail (at least " + MESSAGE_MIN + " characters, " +
                (MESSAGE_MIN - value.length) + " to go).";
        }
        return "";
    }
};

const fields = [userName, userEmail, projectType, budget, message];
let triedToSend = false;   // after the first try, errors update while the visitor types

// Check one field, show (or clear) its message, and return true when it is valid
function validateField(field) {
    const error = rules[field.id](field.value.trim());
    const errorBox = document.getElementById(field.id + "Error");
    errorBox.textContent = error;                    // textContent: never treated as HTML
    field.classList.toggle("invalid", error !== "");
    field.setAttribute("aria-invalid", error !== "" ? "true" : "false");
    return error === "";
}

fields.forEach(function (field) {
    // Leaving a field that was filled in: check it straight away
    field.addEventListener("blur", function () {
        if (field.value.trim() !== "" || triedToSend) validateField(field);
    });
    // While typing: clear the message as soon as the problem is fixed
    field.addEventListener("input", function () {
        if (triedToSend || field.classList.contains("invalid")) validateField(field);
        // Everything fixed: remove the "please fix" note under the button
        if (formResult.classList.contains("form-error") &&
            fields.every(function (f) { return !f.classList.contains("invalid"); })) {
            showResult("", false);
        }
    });
    field.addEventListener("change", function () {
        if (triedToSend || field.classList.contains("invalid")) validateField(field);
    });
});

// Characters typed so far in the message box
const messageCount = document.getElementById("messageCount");
function updateCount() {
    const length = message.value.trim().length;
    messageCount.textContent = message.value.length + " / " + MESSAGE_MAX;
    messageCount.classList.toggle("short", length > 0 && length < MESSAGE_MIN);
}
message.addEventListener("input", updateCount);

// Run this code when the user submits the form
requestForm.addEventListener("submit", function (event) {
    event.preventDefault();
    triedToSend = true;

    // Check every field (not just the first wrong one), then go to the first problem
    const invalid = fields.filter(function (field) {
        return !validateField(field);
    });
    if (invalid.length > 0) {
        showResult(invalid.length === 1
            ? "Please fix the highlighted field."
            : "Please fix the " + invalid.length + " highlighted fields.", true);
        invalid[0].focus();
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
            triedToSend = false;
            updateCount();
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

// Builds the button content with DOM methods instead of innerHTML:
// an icon element plus a text node
function setDarkMode(isDark) {
    document.body.classList.toggle("dark-mode", isDark);

    const icon = document.createElement("i");
    icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    icon.setAttribute("aria-hidden", "true");
    darkModeBtn.replaceChildren(icon, document.createTextNode(isDark ? " Light" : " Dark"));

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
