export type LineCustomTaskInput = { id?: unknown; title?: unknown; done?: unknown };
export function hasTaskTitle(task: { title: string }) { return Boolean(task.title); }
