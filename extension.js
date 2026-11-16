const vscode = require('vscode');

function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function statsHtml(stats, openCount) {
  const days = [];
  let total = 0;
  let max = 1;
  for (const key in stats) total += stats[key];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    const count = stats[key] || 0;
    if (count > max) max = count;
    // 2026-11-03 -> 03.11
    days.push({ label: key.slice(8) + '.' + key.slice(5, 7), count: count });
  }

  let bars = '';
  for (let i = 0; i < days.length; i++) {
    const height = days[i].count / max * 150;
    const x = 20 + i * 60;
    const y = 180 - height;
    bars += '<rect x="' + x + '" y="' + y + '" width="40" height="' + height + '" fill="#4e9a06"></rect>';
    bars += '<text x="' + (x + 20) + '" y="' + (y - 5) + '" text-anchor="middle">' + days[i].count + '</text>';
    bars += '<text x="' + (x + 20) + '" y="200" text-anchor="middle">' + days[i].label + '</text>';
  }

  return '<!DOCTYPE html><html><body style="font-family: sans-serif; color: var(--vscode-foreground)">' +
    '<h2>Статистика задач</h2>' +
    '<p>Всего выполнено: ' + total + '</p>' +
    '<p>Осталось выполнить: ' + openCount + '</p>' +
    '<h3>Выполнено за последние 7 дней</h3>' +
    '<svg width="440" height="210" fill="currentColor">' + bars + '</svg>' +
    '</body></html>';
}

function activate(context) {
  const tasks = context.globalState.get('simpleTasks', []);
  const stats = context.globalState.get('taskStats', {});
  const changed = new vscode.EventEmitter();
  let panel = undefined;

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
    if (panel !== undefined) {
      panel.webview.html = statsHtml(stats, countOpen());
    }
    changed.fire();
  }

  async function save() {
    refresh();
    await context.globalState.update('simpleTasks', tasks);
    await context.globalState.update('taskStats', stats);
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
    const today = dayKey(new Date());
    for (const item of event.items) {
      const task = item[0];
      const done = item[1] === vscode.TreeItemCheckboxState.Checked;
      if (done && !task.done) {
        stats[today] = (stats[today] || 0) + 1;
        task.doneDay = today;
      }
      if (!done && task.done && stats[task.doneDay] > 0) {
        stats[task.doneDay]--;
      }
      task.done = done;
    }
    await save();
  }

  function showStats() {
    if (panel !== undefined) {
      panel.reveal();
      return;
    }
    panel = vscode.window.createWebviewPanel('my-tasks.stats', 'Статистика задач', vscode.ViewColumn.One, {});
    panel.webview.html = statsHtml(stats, countOpen());
    panel.onDidDispose(function () {
      panel = undefined;
    });
  }

  context.subscriptions.push(
    changed,
    view,
    view.onDidChangeCheckboxState(changeCheckboxes),
    vscode.commands.registerCommand('my-tasks.addTask', addTask),
    vscode.commands.registerCommand('my-tasks.deleteTask', deleteTask),
    vscode.commands.registerCommand('my-tasks.changePriority', changePriority),
    vscode.commands.registerCommand('my-tasks.showStats', showStats)
  );
  refresh();
}

module.exports = { activate: activate };
