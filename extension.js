const vscode = require('vscode');

function activate(context) {
  const tasks = context.globalState.get('simpleTasks', []);
  const changed = new vscode.EventEmitter();

  for (const task of tasks) {
    if (task.priority === undefined) task.priority = 1;
  }

  const provider = {
    onDidChangeTreeData: changed.event,

    getChildren() {
      const open = [];
      const done = [];
      for (const task of tasks) {
        if (task.done) done.push(task);
        else open.push(task);
      }
      open.sort(function (a, b) {
        return b.priority - a.priority;
      });
      return open.concat(done);
    },

    getTreeItem(task) {
      const item = new vscode.TreeItem('!'.repeat(task.priority) + ' ' + task.title);
      item.command = {
        command: 'my-tasks.changePriority',
        title: 'Изменить приоритет',
        arguments: [task]
      };
      if (task.done) {
        item.checkboxState = vscode.TreeItemCheckboxState.Checked;
        item.description = 'Выполнено';
      } else {
        item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
      }
      return item;
    }
  };

  const view = vscode.window.createTreeView('my-tasks.taskList', {
    treeDataProvider: provider,
    manageCheckboxStateManually: true
  });

  function countOpen() {
    let count = 0;
    for (const task of tasks) {
      if (!task.done) count++;
    }
    return count;
  }

  function refresh() {
    if (tasks.length > 0) {
      view.description = countOpen() + ' осталось';
    } else {
      view.description = '';
    }
    changed.fire();
  }

  async function save() {
    refresh();
    await context.globalState.update('simpleTasks', tasks);
  }

  async function addTask() {
    const title = await vscode.window.showInputBox({
      prompt: 'Название новой задачи',
      validateInput(text) {
        if (text.trim() === '') return 'Введи название задачи.';
        return undefined;
      }
    });
    if (title === undefined) return;
    const text = title.trim();
    if (text === '') return;
    tasks.push({ title: text, done: false, priority: 1 });
    await save();
  }

  async function deleteTask(task) {
    const index = tasks.indexOf(task);
    if (index === -1) return;
    tasks.splice(index, 1);
    await save();
  }

  async function changePriority(task) {
    if (tasks.indexOf(task) === -1) return;
    // 1 -> 2 -> 3 -> 1
    task.priority = task.priority % 3 + 1;
    await save();
  }

  async function changeCheckboxes(event) {
    for (const item of event.items) {
      const task = item[0];
      const done = item[1] === vscode.TreeItemCheckboxState.Checked;
      task.done = done;
    }
    await save();
  }

  context.subscriptions.push(
    changed,
    view,
    view.onDidChangeCheckboxState(changeCheckboxes),
    vscode.commands.registerCommand('my-tasks.addTask', addTask),
    vscode.commands.registerCommand('my-tasks.deleteTask', deleteTask),
    vscode.commands.registerCommand('my-tasks.changePriority', changePriority)
  );
  refresh();
}

module.exports = { activate: activate };
