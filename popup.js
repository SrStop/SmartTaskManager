// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("classSelect");
  const addClassBtn = document.getElementById("addClassBtn");
  const addAssignmentBtn = document.getElementById("addAssignmentBtn");
  const assignmentList = document.getElementById("assignmentList");

  // Load classes and assignments from storage
  chrome.storage.sync.get(["classes", "assignments"], (data) => {
    const classes = data.classes || ["Default"];
    const assignments = data.assignments || [];

    // Populate the class dropdown
    classes.forEach((cls) => addClassToUI(cls));
    updateAssignmentList(assignments);
  });

  // Event listener to add a new class
  addClassBtn.addEventListener("click", () => {
    const className = prompt("Enter Class Name:");
    if (className) {
      chrome.storage.sync.get(["classes"], (data) => {
        let classes = data.classes || [];
        if (!classes.includes(className)) {
          classes.push(className);
          chrome.storage.sync.set({ classes: classes });
          addClassToUI(className);
        }
      });
    }
  });

  // Event listener to add a new assignment
  addAssignmentBtn.addEventListener("click", () => {
    const assignmentName = prompt("Enter Assignment Name:");
    const dueDate = prompt("Enter Due Date (YYYY-MM-DD HH:mm):");
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
        color: color,
        class: currentClass,
        completed: false,
        recurring: false,
      };
      addAssignmentToUI(assignment);
      saveAssignment(assignment);
      // Optionally, schedule a notification (using assignment.name or assignment.id)
      // scheduleNotification(assignment);
    }
  });

  // Update assignment list when a class is selected
  classSelect.addEventListener("change", () => {
    chrome.storage.sync.get(["assignments"], (data) => {
      updateAssignmentList(data.assignments || []);
    });
  });

  // Function to add a class to the UI dropdown
  function addClassToUI(cls) {
    const option = document.createElement("option");
    option.value = cls;
    option.textContent = cls;
    classSelect.appendChild(option);
  }

  // Function to add an assignment to the UI list
  function addAssignmentToUI(assignment) {
    const li = document.createElement("li");
    li.style.color = assignment.color;

    // Assignment title
    const title = document.createElement("strong");
    title.textContent = assignment.name;
    li.appendChild(title);
    li.appendChild(document.createElement("br"));

    // Assignment due date
    const dueText = document.createElement("span");
    dueText.textContent =
      "Due: " + new Date(assignment.dueDate).toLocaleString();
    li.appendChild(dueText);

    // Container for buttons
    const btnContainer = document.createElement("div");
    btnContainer.className = "assignment-buttons";

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editAssignment(assignment, li);

    // Mark complete button
    const completeBtn = document.createElement("button");
    completeBtn.textContent = "Complete";
    completeBtn.onclick = () => markComplete(assignment, li);

    btnContainer.appendChild(editBtn);
    btnContainer.appendChild(completeBtn);
    li.appendChild(btnContainer);

    assignmentList.appendChild(li);
  }

  // Function to update the assignment list based on the selected class
  function updateAssignmentList(assignments) {
    assignmentList.innerHTML = "";
    const currentClass = classSelect.value;
    assignments
      .filter((a) => a.class === currentClass)
      .forEach((a) => addAssignmentToUI(a));
  }

  // Function to save a new assignment into storage
  function saveAssignment(assignment) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments.push(assignment);
      chrome.storage.sync.set({ assignments: assignments });
    });
  }

  // Function to edit an existing assignment
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
        "Edit Due Date (YYYY-MM-DD HH:mm):",
        new Date(assignment.dueDate).toISOString().slice(0, 16)
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
        chrome.storage.sync.set({ assignments: assignments }, () => {
          updateAssignmentList(assignments);
        });
      }
    });
  }

  // Function to mark an assignment as complete and remove it from the UI
  function markComplete(assignment, li) {
    chrome.storage.sync.get(["assignments"], (data) => {
      let assignments = data.assignments || [];
      assignments = assignments.filter((a) => a.id !== assignment.id);
      chrome.storage.sync.set({ assignments: assignments }, () => {
        // Optionally, clear any scheduled alarms for the assignment
        li.remove();
      });
    });
  }

  // OCR functionality elements
  const ocrTaskBtn = document.getElementById("ocrTaskBtn");
  const imageUpload = document.getElementById("imageUpload");
  const imagePreview = document.getElementById("imagePreview");
  const loadingIndicator = document.getElementById("loading");

  // Event listener for OCR processing
  ocrTaskBtn.addEventListener("click", () => {
    if (!imageUpload.files || imageUpload.files.length === 0) {
      alert("Please upload an image.");
      return;
    }
    const currentClass = classSelect.value || "Default";
    performOCR(imageUpload.files[0], currentClass);
  });

  // Function to perform OCR using Tesseract and create an assignment from the extracted text
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
          // Scale the image if it's too wide
          const scale = Math.min(600 / img.width, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Initialize Tesseract worker
          const worker = Tesseract.createWorker();
          await worker.load();
          await worker.loadLanguage("eng");
          await worker.initialize("eng");
          const { data: { text } } = await worker.recognize(canvas);
          await worker.terminate();

          // Create an assignment from the OCR text
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
            chrome.storage.sync.set({ assignments: assignments }, () => {
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
