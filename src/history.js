export class History {
  constructor(value, limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.saved = JSON.stringify(value);
  }
  get canUndo() {
    return !!this.undoStack.length;
  }
  get canRedo() {
    return !!this.redoStack.length;
  }
  isDirty(value) {
    return JSON.stringify(value) !== this.saved;
  }
  markSaved(value) {
    this.saved = JSON.stringify(value);
  }
  commit(before, after) {
    const a = JSON.stringify(before),
      b = JSON.stringify(after);
    if (a === b) return false;
    this.undoStack.push(a);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }
  undo(value) {
    if (!this.canUndo) return value;
    this.redoStack.push(JSON.stringify(value));
    return JSON.parse(this.undoStack.pop());
  }
  redo(value) {
    if (!this.canRedo) return value;
    this.undoStack.push(JSON.stringify(value));
    return JSON.parse(this.redoStack.pop());
  }
  reset(value) {
    this.undoStack = [];
    this.redoStack = [];
    this.markSaved(value);
  }
}
