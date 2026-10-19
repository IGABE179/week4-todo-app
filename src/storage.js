// storage.js – the only module that talks to localStorage.

const TASKS_KEY = "studyplanner.tasks";
const FILTER_KEY = "studyplanner.filter";
const VALID_FILTERS = ["all", "active", "completed"];

// Returns true if value looks like a task object we can safely use.
function isValidTask(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "number" &&
    typeof value.text === "string" &&
    typeof value.done === "boolean"
  );
}

// Loads tasks; returns [] if nothing is saved or the data is corrupted.
export function loadTasks() {
  const raw = localStorage.getItem(TASKS_KEY);
  if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidTask);
  } catch (error) {
    console.warn("Saved tasks were corrupted and have been reset.", error);
    return [];
  }
}

// Saves the full tasks array as JSON.
export function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

// Loads the last selected filter, defaulting to "all".
export function loadFilter() {
  const saved = localStorage.getItem(FILTER_KEY);
  return VALID_FILTERS.includes(saved) ? saved : "all";
}

// Saves the selected filter.
export function saveFilter(filter) {
  localStorage.setItem(FILTER_KEY, filter);
}
