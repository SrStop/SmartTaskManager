// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Schedule and Task Planner Installed");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  // Create a notification for the assignment reminder
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Assignment Reminder",
    message: `Reminder: ${alarm.name}`
  });

  // Reschedule the reminder for every 24 hours until the assignment is marked complete
  chrome.storage.sync.get(["assignments"], (data) => {
    let assignments = data.assignments || [];
    // Find the assignment by matching the alarm's name with the assignment's name
    const assignmentIndex = assignments.findIndex(a => a.name === alarm.name);
    if (assignmentIndex > -1 && !assignments[assignmentIndex].completed) {
      chrome.alarms.create(assignments[assignmentIndex].name, {
        when: Date.now() + 24 * 60 * 60 * 1000
      });
    }
  });
});
