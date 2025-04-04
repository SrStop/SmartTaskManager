document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const classSelect = document.getElementById("classSelect");
  const addClassBtn = document.getElementById("addClassBtn");
  const addAssignmentBtn = document.getElementById("addAssignmentBtn");
  const assignmentList = document.getElementById("assignmentList");
  const currentDateTimeEl = document.getElementById("currentDateTime"); // For real-time clock

  // OCR Elements
  const ocrTaskBtn = document.getElementById("ocrTaskBtn");
  const imageUpload = document.getElementById("imageUpload");
  const imagePreview = document.getElementById("imagePreview");
  const loadingIndicator = document.getElementById("loading");

  // Load classes and assignments from chrome.storage
  chrome.storage.sync.get(["classes", "assignments"], (data) => {
    const classes = data.classes || ["Default"];
    const assignments = data.assignments || [];

    classes.forEach((cls) => addClassToUI(cls));
    updateAssignmentList(assignments);
  });

  // Real-Time Clock Function: Display Texas (America/Chicago) time
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
    currentDateTimeEl.textContent = "Current Texas Time: " + nowTexas;
  }
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Add new class event
  addClassBtn.addEventListener("click", () => {
    const className = prompt("Enter Class Name:");
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

  // Add new assignment event
  addAssignmentBtn.addEventListener("click", () => {
    const assignmentName = prompt("Enter Assignment Name:");
    const dueDate = prompt("Enter Due Date (MM/DD/YYYY HH:MM AM/PM):");
    const color = prompt("Enter Color for the Assignment:");
    const currentClass = classSelect.value;
    if (assignmentName && dueDate && color) {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        alert("Invalid Date Format");
        return;
      }
      // Generate a unique ID
      const assignmentID =
        Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const assignment = {
        id: assignmentID,
        name: assignmentName,
        dueDate: parsedDate.toISOString(),
        color,
        class: currentClass,
        completed: false,
        recurring: false,
      };
      addAssignmentToUI(assignment);
      saveAssignment(assignment);
    }
  });

  // Update assignment list when selected class changes
  classSelect.addEventListener("change", () => {
    chrome.storage.sync.get(["assignments"], (data) => {
      updateAssignmentList(data.assignments || []);
    });
  });

  // Add a class option to the dropdown
  function addClassToUI(cls) {
    const option = document.createElement("option");
    option.value = cls;
    option.textContent = cls;
    classSelect.appendChild(option);
  }

  // Update the assignment list based on selected class
  function updateAssignmentList(assignments) {
    assignmentList.innerHTML = "";
    const currentClass = classSelect.value;
    assignments
      .filter((a) => a.class === currentClass)
      .forEach((a) => addAssignmentToUI(a));
  }

  // Add an assignment to the UI list
  function addAssignmentToUI(assignment) {
    const li = document.createElement("li");
    li.style.color = assignment.color;

    const title = document.createElement("strong");
    title.textContent = assignment.name;
    li.appendChild(title);
    li.appendChild(document.createElement("br"));

    const dueText = document.createElement("span");
    dueText.textContent =
      "Due: " + new Date(assignment.dueDate).toLocaleString();
    li.appendChild(dueText);

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
    li.appendChild(btnContainer);

    assignmentList.appendChild(li);
  }

  // Save a new assignment in chrome.storage
  function saveAssignment(assignment) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments.push(assignment);
      chrome.storage.sync.set({ assignments });
    });
  }

  // Edit an existing assignment
  function editAssignment(assignment, li) {
    const field = prompt("What do you want to edit? (name, due date, color)");
    if (!field) return;
    let newName = assignment.name;
    let newDueDate = assignment.dueDate;
    let newColor = assignment.color;

    if (field.includes("name")) {
      newName = prompt("Edit Assignment Name:", assignment.name) || assignment.name;
    }
    if (field.includes("due date")) {
      let newDateInput = prompt(
        "Edit Due Date (MM/DD/YYYY HH:MM AM/PM):",
        new Date(assignment.dueDate).toLocaleString()
      );
      const parsedDate = new Date(newDateInput);
      if (!isNaN(parsedDate.getTime())) {
        newDueDate = parsedDate.toISOString();
      } else {
        alert("Invalid Date Format");
        return;
      }
    }
    if (field.includes("color")) {
      newColor = prompt("Edit Color:", assignment.color) || assignment.color;
    }

    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      const index = assignments.findIndex((a) => a.id === assignment.id);
      if (index !== -1) {
        assignments[index].name = newName;
        assignments[index].dueDate = newDueDate;
        assignments[index].color = newColor;
        chrome.storage.sync.set({ assignments }, () => {
          updateAssignmentList(assignments);
        });
      }
    });
  }

  // Mark an assignment as complete and remove it from the UI
  function markComplete(assignment, li) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments = assignments.filter((a) => a.id !== assignment.id);
      chrome.storage.sync.set({ assignments }, () => {
        li.remove();
      });
    });
  }

  // OCR: Process an uploaded image to create an assignment
  ocrTaskBtn.addEventListener("click", () => {
    if (!imageUpload.files || imageUpload.files.length === 0) {
      alert("Please upload an image.");
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

          const assignmentID =
            Date.now().toString() + Math.floor(Math.random() * 1000).toString();
          const assignment = {
            id: assignmentID,
            name: text.trim().split("\n")[0] || "Untitled OCR Assignment",
            dueDate: new Date().toISOString(),
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
              alert("Assignment created from image!");
            });
          });
        } catch (error) {
          loadingIndicator.classList.add("hidden");
          alert("Error during OCR processing");
          console.error("OCR error:", error);
        }
      };
    };
    reader.readAsDataURL(file);
  }
});
