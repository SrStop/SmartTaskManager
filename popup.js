document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const classSelect = document.getElementById("classSelect");
  const addClassBtn = document.getElementById("addClassBtn");
  const addAssignmentBtn = document.getElementById("addAssignmentBtn");
  const assignmentList = document.getElementById("assignmentList");
  const currentDateTimeEl = document.getElementById("currentDateTime"); // Real-time Texas clock

  // OCR Elements
  const ocrTaskBtn = document.getElementById("ocrTaskBtn");
  const imageUpload = document.getElementById("imageUpload");
  const imagePreview = document.getElementById("imagePreview");
  const loadingIndicator = document.getElementById("loading");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Load classes and assignments from storage
  // ─────────────────────────────────────────────────────────────────────────────
  chrome.storage.sync.get(["classes", "assignments"], (data) => {
    const classes = data.classes || ["Default"];
    const assignments = data.assignments || [];

    classes.forEach((cls) => addClassToUI(cls));
    updateAssignmentList(assignments);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Real-Time Texas Clock (America/Chicago)
  // ─────────────────────────────────────────────────────────────────────────────
  function updateDateTime() {
    const options = {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };
    const nowTexas = new Date().toLocaleString("en-US", options);
    currentDateTimeEl.textContent = "Current Date: " + nowTexas;
  }
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Function to calculate "Tiempo restante"
  //    Returns a string like "2d 5h 30m 10s" or "¡La fecha ya pasó!"
  // ─────────────────────────────────────────────────────────────────────────────
  function getTimeLeft(dueDateStr) {
    const now = new Date();
    const due = new Date(dueDateStr);
    let diffMs = due - now;

    if (diffMs <= 0) {
      return "¡THE DUE DATE IS OVER!";
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    diffMs %= (1000 * 60 * 60 * 24);
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    diffMs %= (1000 * 60 * 60);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    diffMs %= (1000 * 60);
    const diffSeconds = Math.floor(diffMs / 1000);

    return `${diffDays}d ${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Event: Add a new Class
  // ─────────────────────────────────────────────────────────────────────────────
  addClassBtn.addEventListener("click", () => {
    const className = prompt("Type the class name: ");
    if (className) {
      chrome.storage.sync.get(["classes"], (data) => {
        let classes = data.classes || [];
        if (!classes.includes(className)) {
          classes.push(className);
          chrome.storage.sync.set({ classes });
          addClassToUI(className);
        }
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Event: Add a new Assignment
  // ─────────────────────────────────────────────────────────────────────────────
  addAssignmentBtn.addEventListener("click", () => {
    const assignmentName = prompt("Type the homework name: ");
    const dueDate = prompt("Type Due Date (MM/DD/YYYY HH:MM AM/PM): ");
    const requiredTime = prompt("How many hours to complete HW: ");
    const difficulty = prompt("Difficulty level, select color (Green, Yellow, Red): ");
    const currentClass = classSelect.value;

    if (assignmentName && dueDate && requiredTime && difficulty) {
      // Parse date
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        alert("Invalid date format.");
        return;
      }

      // Convert requiredTime to a number
      const requiredTimeNum = parseInt(requiredTime, 10);
      if (isNaN(requiredTimeNum)) {
        alert("Time requierd in (hours).");
        return;
      }

      // Generate a unique ID
      const assignmentID = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const assignment = {
        id: assignmentID,
        name: assignmentName,
        dueDate: parsedDate.toISOString(),
        requiredTime: requiredTimeNum,
        color: difficulty, // green, yellow, or red
        class: currentClass,
        completed: false,
        recurring: false,
      };

      addAssignmentToUI(assignment);
      saveAssignment(assignment);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Update assignment list on class change
  // ─────────────────────────────────────────────────────────────────────────────
  classSelect.addEventListener("change", () => {
    chrome.storage.sync.get(["assignments"], (data) => {
      updateAssignmentList(data.assignments || []);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Helper: Add class to dropdown
  // ─────────────────────────────────────────────────────────────────────────────
  function addClassToUI(cls) {
    const option = document.createElement("option");
    option.value = cls;
    option.textContent = cls;
    classSelect.appendChild(option);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Helper: Update the assignment list for the selected class
  // ─────────────────────────────────────────────────────────────────────────────
  function updateAssignmentList(assignments) {
    assignmentList.innerHTML = "";
    const currentClass = classSelect.value;
    assignments
      .filter((a) => a.class === currentClass)
      .forEach((a) => addAssignmentToUI(a));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Helper: Add an assignment to the UI
  // ─────────────────────────────────────────────────────────────────────────────
  function addAssignmentToUI(assignment) {
    const li = document.createElement("li");
    // Use assignment.color to set text color (green, yellow, red)
    li.style.color = assignment.color;

    // Title
    const title = document.createElement("strong");
    title.textContent = assignment.name;
    li.appendChild(title);
    li.appendChild(document.createElement("br"));

    // Due Date
    const dueText = document.createElement("span");
    dueText.textContent = "Due: " + new Date(assignment.dueDate).toLocaleString();
    li.appendChild(dueText);
    li.appendChild(document.createElement("br"));

    // Required Time
    const reqTimeText = document.createElement("span");
    reqTimeText.textContent = "Approximate Time Requierd In Homework: " + assignment.requiredTime + " horas";
    li.appendChild(reqTimeText);
    li.appendChild(document.createElement("br"));

    // Time Left
    const timeLeftText = document.createElement("span");
    timeLeftText.textContent = "Remaining Time To Complete: " + getTimeLeft(assignment.dueDate);
    li.appendChild(timeLeftText);

    // Buttons container
    const btnContainer = document.createElement("div");
    btnContainer.className = "assignment-buttons";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editAssignment(assignment, li);

    const completeBtn = document.createElement("button");
    completeBtn.textContent = "Complete";
    completeBtn.onclick = () => markComplete(assignment, li);

    btnContainer.appendChild(editBtn);
    btnContainer.appendChild(completeBtn);
    li.appendChild(document.createElement("br"));
    li.appendChild(btnContainer);

    assignmentList.appendChild(li);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Helper: Save an assignment in chrome.storage
  // ─────────────────────────────────────────────────────────────────────────────
  function saveAssignment(assignment) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments.push(assignment);
      chrome.storage.sync.set({ assignments });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Edit an existing assignment
  //     (Optional) You can add prompts for "time required" or "color" here, too.
  // ─────────────────────────────────────────────────────────────────────────────
  function editAssignment(assignment, li) {
    const field = prompt("¿What do you want to edit? (name, due date, required time, color)");
    if (!field) return;

    let newName = assignment.name;
    let newDueDate = assignment.dueDate;
    let newRequiredTime = assignment.requiredTime;
    let newColor = assignment.color;

    if (field.includes("name")) {
      newName = prompt("Edit Assignment Name:", assignment.name) || assignment.name;
    }
    if (field.includes("due date")) {
      let newDateInput = prompt("Edit Due Date (MM/DD/YYYY HH:MM AM/PM):", new Date(assignment.dueDate).toLocaleString());
      const parsedDate = new Date(newDateInput);
      if (!isNaN(parsedDate.getTime())) {
        newDueDate = parsedDate.toISOString();
      } else {
        alert("Invalid Date Format");
        return;
      }
    }
    if (field.includes("required time")) {
      let newReqTimeInput = prompt("Edit Required Time (hours):", assignment.requiredTime);
      const reqTimeNum = parseInt(newReqTimeInput, 10);
      if (!isNaN(reqTimeNum)) {
        newRequiredTime = reqTimeNum;
      } else {
        alert("Invalid Number for Required Time");
      }
    }
    if (field.includes("color")) {
      newColor = prompt("Select difficulty level (green = fácil, yellow = complicado, red = difícil):", assignment.color) || assignment.color;
    }

    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      const index = assignments.findIndex((a) => a.id === assignment.id);
      if (index !== -1) {
        assignments[index].name = newName;
        assignments[index].dueDate = newDueDate;
        assignments[index].requiredTime = newRequiredTime;
        assignments[index].color = newColor;
        chrome.storage.sync.set({ assignments }, () => {
          updateAssignmentList(assignments);
        });
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Mark an assignment as complete
  // ─────────────────────────────────────────────────────────────────────────────
  function markComplete(assignment, li) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments = assignments.filter((a) => a.id !== assignment.id);
      chrome.storage.sync.set({ assignments }, () => {
        li.remove();
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. OCR: Process an uploaded image to create an assignment
  // ─────────────────────────────────────────────────────────────────────────────
  ocrTaskBtn.addEventListener("click", () => {
    if (!imageUpload.files || imageUpload.files.length === 0) {
      alert("Por favor selecciona una imagen.");
      return;
    }
    const currentClass = classSelect.value || "Default";
    performOCR(imageUpload.files[0], currentClass);
  });

  async function performOCR(file, currentClass) {
    loadingIndicator.classList.remove("hidden");
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.src = reader.result;
      imagePreview.src = reader.result;
      imagePreview.classList.remove("hidden");

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(600 / img.width, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const worker = Tesseract.createWorker();
          await worker.load();
          await worker.loadLanguage("eng");
          await worker.initialize("eng");
          const { data: { text } } = await worker.recognize(canvas);
          await worker.terminate();

          // For OCR, we won't have a user-chosen due date, time required, or color
          // You can prompt the user if needed, or just store placeholders
          const assignmentID = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
          const assignment = {
            id: assignmentID,
            name: text.trim().split("\n")[0] || "Untitled OCR Assignment",
            dueDate: new Date().toISOString(),
            requiredTime: 0,
            color: "black",
            class: currentClass,
            completed: false,
            recurring: false,
          };

          chrome.storage.sync.get(["assignments"], (data) => {
            let assignments = data.assignments || [];
            assignments.push(assignment);
            chrome.storage.sync.set({ assignments }, () => {
              updateAssignmentList(assignments);
              loadingIndicator.classList.add("hidden");
              alert("Homework created by the photo");
            });
          });
        } catch (error) {
          loadingIndicator.classList.add("hidden");
          alert("Error in prosses OCR");
          console.error("OCR error:", error);
        }
      };
    };
    reader.readAsDataURL(file);
  }
});
