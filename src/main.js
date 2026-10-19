// main.js – state, rendering and event handling for Study Planner.
import "./style.css";
import { loadTasks, saveTasks, loadFilter, saveFilter } from "./storage.js";

// ── Constants ───────────────────────────────────────────────────────
const MAX_LENGTH = 100;
const FILTER_ACTIVE_CLASSES = ["bg-gold", "text-navy", "font-semibold"];
const FILTER_IDLE_CLASSES = ["bg-mist/40", "text-navy", "hover:bg-mist"];
const EMPTY_MESSAGES = {
  all: "No study tasks yet. Add your first one above!",
  active: "Nothing left to study. Enjoy your break!",
  completed: "No completed tasks yet.",
};

// ── State (the single source of truth) ──────────────────────────────
let tasks = loadTasks();
let currentFilter = loadFilter();
let editingId = null; // id of the task being edited, or null
let searchQuery = ""; // text typed in the search box

// ── DOM references (looked up once) ─────────────────────────────────
const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const errorEl = document.querySelector("#task-error");
const listEl = document.querySelector("#task-list");
const emptyEl = document.querySelector("#empty-state");
const countEl = document.querySelector("#task-count");
const filtersEl = document.querySelector("#filters");
const template = document.querySelector("#task-template");
const clearBtn = document.querySelector("#clear-completed");
const searchInput = document.querySelector("#search-input");
const progressBar = document.querySelector("#progress-bar");
const progressFill = document.querySelector("#progress-fill");
const progressLabel = document.querySelector("#progress-label");

// ── Pure helpers ────────────────────────────────────────────────────

// Returns an error message for invalid text, or "" when valid.
function validateTaskText(text) {
  if (text === "") return "Please enter a task.";
  if (text.length > MAX_LENGTH) {
    return `Tasks must be ${MAX_LENGTH} characters or fewer (you typed ${text.length}).`;
  }
  return "";
}

// Returns the tasks visible under the given filter.
function getVisibleTasks(allTasks, filter) {
  const visible = [];
  for (const task of allTasks) {
    if (filter === "active" && task.done) continue;
    if (filter === "completed" && !task.done) continue;
    visible.push(task);
  }
  return visible;
}

// Keeps only the tasks whose text contains the search query (case-insensitive).
function searchTasks(list, query) {
  if (query === "") return list;
  const needle = query.toLowerCase();
  const matches = [];
  for (const task of list) {
    if (task.text.toLowerCase().includes(needle)) matches.push(task);
  }
  return matches;
}

// Counts tasks that are not done.
function countRemaining(allTasks) {
  let count = 0;
  for (const task of allTasks) {
    if (!task.done) count++;
  }
  return count;
}

// Returns the whole-number percentage of completed tasks (0 for an empty list).
function getProgress(allTasks) {
  if (allTasks.length === 0) return 0;
  const done = allTasks.length - countRemaining(allTasks);
  return Math.round((done / allTasks.length) * 100);
}

// ── State updates (each one saves and re-renders) ───────────────────

// Persists the current state and redraws the UI.
function commit() {
  saveTasks(tasks);
  render();
}

// Adds a new task to the top of the list.
function addTask(text) {
  const task = { id: Date.now(), text, done: false, createdAt: Date.now() };
  tasks = [task, ...tasks];
  commit();
}

// Flips the done state of one task.
function toggleTask(id) {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  );
  commit();
}

// Removes one task.
function deleteTask(id) {
  if (editingId === id) editingId = null;
  tasks = tasks.filter((task) => task.id !== id);
  commit();
}

// Changes the active filter.
function setFilter(filter) {
  currentFilter = filter;
  saveFilter(filter);
  render();
}

// Removes every completed task.
function clearCompleted() {
  tasks = tasks.filter((task) => !task.done);
  commit();
}

// Replaces the text of one task and leaves edit mode.
function editTask(id, text) {
  tasks = tasks.map((task) => (task.id === id ? { ...task, text } : task));
  editingId = null;
  commit();
}

// ── Rendering ───────────────────────────────────────────────────────

// Builds one <li> for a task from the <template> (no innerHTML with user data).
function createTaskElement(task) {
  const li = template.content.firstElementChild.cloneNode(true);
  li.dataset.id = String(task.id);

  const checkbox = li.querySelector(".task-toggle");
  checkbox.checked = task.done;
  const nextState = task.done ? "not done" : "done";
  checkbox.setAttribute("aria-label", `Mark "${task.text}" as ${nextState}`);

  const textEl = li.querySelector(".task-text");
  textEl.textContent = task.text;
  textEl.classList.toggle("line-through", task.done);
  textEl.classList.toggle("text-slate-400", task.done);

  const deleteButton = li.querySelector("[data-action='delete']");
  deleteButton.setAttribute("aria-label", `Delete "${task.text}"`);
  const editButton = li.querySelector("[data-action='edit']");
  editButton.setAttribute("aria-label", `Edit "${task.text}"`);
  if (task.id === editingId) textEl.replaceWith(createEditInput(task));
  return li;
}

// Builds the text box shown while a task is being edited.
function createEditInput(task) {
  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.value = task.text; // a property, so the text is never parsed as HTML
  editInput.maxLength = 120;
  editInput.className =
    "edit-input flex-1 rounded border border-navy px-2 py-1 focus:outline-none focus:ring-2 focus:ring-mist";
  editInput.setAttribute("aria-label", `Edit text of "${task.text}"`);
  editInput.setAttribute("aria-describedby", "task-error");
  return editInput;
}

// Puts the cursor at the end of the edit box after a re-render.
function focusEditInput() {
  const editInput = listEl.querySelector(".edit-input");
  if (!editInput) return;
  editInput.focus();
  const end = editInput.value.length;
  editInput.setSelectionRange(end, end);
}

// Updates the filter buttons' appearance and aria-pressed state.
function renderFilters() {
  for (const button of filtersEl.querySelectorAll("[data-filter]")) {
    const isActive = button.dataset.filter === currentFilter;
    button.setAttribute("aria-pressed", String(isActive));
    for (const cls of FILTER_ACTIVE_CLASSES) button.classList.toggle(cls, isActive);
    for (const cls of FILTER_IDLE_CLASSES) button.classList.toggle(cls, !isActive);
  }
}

// Shows "Clear completed (n)" only when at least one task is done.
function renderClearButton() {
  const doneCount = tasks.length - countRemaining(tasks);
  clearBtn.hidden = doneCount === 0;
  clearBtn.textContent = `Clear completed (${doneCount})`;
}

// Updates the progress bar with the percentage of tasks completed.
function renderProgress() {
  const percent = getProgress(tasks);
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", String(percent));
  progressLabel.textContent = `${percent}% complete`;
}

// Redraws everything from state. The ONLY function that writes the task list.
function render() {
  const visible = searchTasks(getVisibleTasks(tasks, currentFilter), searchQuery);

  const fragment = document.createDocumentFragment();
  for (const task of visible) fragment.append(createTaskElement(task));
  listEl.replaceChildren(fragment);

  emptyEl.hidden = visible.length > 0;
  emptyEl.textContent = searchQuery
    ? `No tasks match "${searchQuery}".`
    : EMPTY_MESSAGES[currentFilter];

  const remaining = countRemaining(tasks);
  countEl.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;

  renderFilters();
  renderClearButton();
  renderProgress();
  focusEditInput();
}

// ── Event handlers ──────────────────────────────────────────────────

// Handles the add-task form (button click AND Enter key).
function handleSubmit(event) {
  event.preventDefault();
  const text = input.value.trim();
  const error = validateTaskText(text);
  errorEl.textContent = error;
  input.setAttribute("aria-invalid", String(Boolean(error)));
  if (error) {
    input.focus();
    return;
  }
  addTask(text);
  form.reset();
  input.focus();
}

// Clears the error as soon as the user starts fixing it.
function handleInput() {
  if (errorEl.textContent && input.value.trim() !== "") {
    errorEl.textContent = "";
    input.setAttribute("aria-invalid", "false");
  }
}

// Moves keyboard focus to a button inside one task, or to the input if it is gone.
function focusTaskButton(id, action) {
  const target = listEl.querySelector(`[data-id="${id}"] [data-action="${action}"]`);
  (target ?? input).focus();
}

// Asks for confirmation, deletes the task, and keeps focus nearby.
function confirmAndDelete(li) {
  const id = Number(li.dataset.id);
  const task = tasks.find((item) => item.id === id);
  if (!task || !window.confirm(`Delete "${task.text}"?`)) return;
  const neighbour = li.nextElementSibling ?? li.previousElementSibling;
  const neighbourId = neighbour?.dataset.id;
  deleteTask(id);
  focusTaskButton(neighbourId, "delete");
}

// Delegated handler for the buttons inside each task.
function handleListClick(event) {
  const editButton = event.target.closest("[data-action='edit']");
  if (editButton) {
    editingId = Number(editButton.closest("li").dataset.id);
    render();
    return;
  }
  const deleteButton = event.target.closest("[data-action='delete']");
  if (deleteButton) confirmAndDelete(deleteButton.closest("li"));
}

// Delegated handler for checkboxes.
function handleListChange(event) {
  if (!event.target.matches(".task-toggle")) return;
  const id = Number(event.target.closest("li").dataset.id);
  toggleTask(id);
  listEl.querySelector(`[data-id="${id}"] .task-toggle`)?.focus();
}

// Handles clicks on the filter buttons.
function handleFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  setFilter(button.dataset.filter);
}

// Removes every completed task after the user confirms.
function handleClearCompleted() {
  const doneCount = tasks.length - countRemaining(tasks);
  const label = doneCount === 1 ? "task" : "tasks";
  if (!window.confirm(`Remove ${doneCount} completed ${label}?`)) return;
  clearCompleted();
  input.focus();
}

// Double-clicking a task's text starts editing it.
function handleListDblClick(event) {
  const textEl = event.target.closest(".task-text");
  if (!textEl) return;
  editingId = Number(textEl.closest("li").dataset.id);
  render();
}

// While editing: Enter saves (if the text is valid) and Escape cancels.
function handleListKeydown(event) {
  if (!event.target.matches(".edit-input")) return;
  const id = editingId;
  if (event.key === "Escape") {
    editingId = null;
    errorEl.textContent = "";
    render();
    focusTaskButton(id, "edit");
  } else if (event.key === "Enter") {
    event.preventDefault();
    const text = event.target.value.trim();
    const error = validateTaskText(text);
    errorEl.textContent = error;
    event.target.setAttribute("aria-invalid", String(Boolean(error)));
    if (error) return;
    editTask(id, text);
    focusTaskButton(id, "edit");
  }
}

// Filters the list as the user types in the search box.
function handleSearch() {
  searchQuery = searchInput.value.trim();
  render();
}

// ── Wiring (listeners are attached ONCE, never inside render) ──────
form.addEventListener("submit", handleSubmit);
input.addEventListener("input", handleInput);
listEl.addEventListener("click", handleListClick);
listEl.addEventListener("change", handleListChange);
filtersEl.addEventListener("click", handleFilterClick);
clearBtn.addEventListener("click", handleClearCompleted);
listEl.addEventListener("dblclick", handleListDblClick);
listEl.addEventListener("keydown", handleListKeydown);
searchInput.addEventListener("input", handleSearch);

render();
