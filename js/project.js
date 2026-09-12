// Get form elements from the page
const requestForm = document.getElementById("requestForm");
const userName = document.getElementById("name");
const userEmail = document.getElementById("email");
const projectType = document.getElementById("projectType");
const budget = document.getElementById("budget");
const message = document.getElementById("message");
const formResult = document.getElementById("formResult");

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
        formResult.textContent = "Please complete all fields.";
        formResult.style.color = "red";
        return;
    }

    // Check if the email address is valid
    if (!userEmail.value.includes("@")) {
        formResult.textContent = "Please enter a valid email address.";
        formResult.style.color = "red";
        return;
    }

    formResult.innerHTML =
        "<strong>Request Submitted Successfully!</strong><br>" +
        "Name: " + userName.value + "<br>" +
        "Email: " + userEmail.value + "<br>" +
        "Project: " + projectType.value + "<br>" +
        "Budget: " + budget.value + "<br>" +
        "Message: " + message.value;

    formResult.style.color = "green";

    requestForm.reset();
});
// Dark Mode Button
const darkModeBtn = document.getElementById("darkModeBtn");

darkModeBtn.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        darkModeBtn.textContent = "☀️ Light Mode";
    } else {
        darkModeBtn.textContent = "🌙 Dark Mode";
    }

});
