const accountState = document.getElementById("accountState");
const accountNumber = document.getElementById("accountNumber");
const qrImage = document.getElementById("qrImage");
const scheduleForm = document.getElementById("scheduleForm");
const scheduleList = document.getElementById("scheduleList");
const formFeedback = document.getElementById("formFeedback");

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function renderAccountStatus(status) {
  accountState.textContent = `Status: ${status.state}`;
  accountNumber.textContent = status.phoneNumber ? `Connected number: +${status.phoneNumber}` : "";

  if (status.qrCodeDataUrl) {
    qrImage.src = status.qrCodeDataUrl;
    qrImage.classList.remove("hidden");
  } else {
    qrImage.classList.add("hidden");
  }
}

async function fetchSchedules() {
  const response = await fetch("/api/schedules");
  const schedules = await response.json();

  scheduleList.innerHTML = "";

  if (!schedules.length) {
    scheduleList.innerHTML = "<li>No schedules yet.</li>";
    return;
  }

  for (const item of schedules) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${item.to}</strong><br/>
        <span>${item.message}</span><br/>
        <span class="small">Send at: ${formatDate(item.sendAt)} | Status: ${item.status}</span>
      </div>
      ${item.status === "pending" ? `<button data-id="${item.id}">Delete</button>` : ""}
    `;
    scheduleList.appendChild(li);
  }
}

scheduleList.addEventListener("click", async (event) => {
  if (!(event.target instanceof HTMLButtonElement)) {
    return;
  }

  const { id } = event.target.dataset;
  if (!id) {
    return;
  }

  await fetch(`/api/schedules/${id}`, { method: "DELETE" });
  fetchSchedules();
});

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    to: document.getElementById("to").value,
    message: document.getElementById("message").value,
    sendAt: new Date(document.getElementById("sendAt").value).toISOString(),
  };

  const response = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    formFeedback.textContent = result.error;
    return;
  }

  formFeedback.textContent = "Schedule added.";
  scheduleForm.reset();
  fetchSchedules();
});

const socket = io();
socket.on("account:update", (status) => {
  renderAccountStatus(status);
});

fetch("/api/account-status")
  .then((r) => r.json())
  .then(renderAccountStatus);

fetchSchedules();
