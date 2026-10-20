const vscode = require('vscode');

function activate(context) {
  const tasks = context.globalState.get('simpleTasks', []);
  const changed = new vscode.EventEmitter();

  const provider = {
    onDidChangeTreeData: changed.event,

    getChildren() {
      const open = [];
      const done = [];
      for (const task of tasks) {
        if (task.done) done.push(task);
        else open.push(task);
      }
      return open.concat(done);
    },

    getTreeItem(task) {
      const item = new vscode.TreeItem(task.title);
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

  function refresh() {
    let count = 0;
    for (const task of tasks) {
      if (!task.done) count++;
    }
    if (tasks.length > 0) {
      view.description = count + ' осталось';
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
    tasks.push({ title: text, done: false });
    await save();
  }

  async function deleteTask(task) {
    const index = tasks.indexOf(task);
    if (index === -1) return;
    tasks.splice(index);
    await save();
  }

  async function changeCheckboxes(event) {
    for (const item of event.items) {
      const task = item[0];
      const state = item[1];
      task.done = state === vscode.TreeItemCheckboxState.Checked;
    }
    await save();
  }

  context.subscriptions.push(
    changed,
    view,
    view.onDidChangeCheckboxState(changeCheckboxes),
    vscode.commands.registerCommand('my-tasks.addTask', addTask),
    vscode.commands.registerCommand('my-tasks.deleteTask', deleteTask)
  );
  refresh();
}

module.exports = { activate: activate };
