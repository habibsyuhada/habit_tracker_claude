import type { ChecklistItem, Daily, Habit, Reward, Task, Todo } from '../types';
import { useGame } from '../store/useGame';
import { valueColor } from '../game/formulas';

const DAY_SHORT = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
const DAY_FULL = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
}

export function TaskItem({ task, onEdit }: Props) {
  switch (task.type) {
    case 'habit':
      return <HabitItem habit={task} onEdit={onEdit} />;
    case 'daily':
      return <DailyItem daily={task} onEdit={onEdit} />;
    case 'todo':
      return <TodoItem todo={task} onEdit={onEdit} />;
    case 'reward':
      return <RewardItem reward={task} onEdit={onEdit} />;
  }
}

function HabitItem({ habit, onEdit }: { habit: Habit; onEdit: (t: Task) => void }) {
  const scoreHabit = useGame((s) => s.scoreHabit);
  const color = valueColor(habit.value);

  return (
    <div className="card habit-card" style={{ borderLeftColor: color }}>
      <button
        className="habit-btn plus"
        disabled={!habit.up}
        onClick={() => scoreHabit(habit.id, 'up')}
        aria-label="Skor positif"
      >
        +
      </button>
      <div className="card-body" onClick={() => onEdit(habit)}>
        <div className="card-title">{habit.title}</div>
        {habit.notes && <div className="card-notes">{habit.notes}</div>}
        {(habit.counterUp > 0 || habit.counterDown > 0) && (
          <div className="card-meta">
            {habit.up && <span>▲ {habit.counterUp}</span>}
            {habit.down && <span>▼ {habit.counterDown}</span>}
          </div>
        )}
      </div>
      <button
        className="habit-btn minus"
        disabled={!habit.down}
        onClick={() => scoreHabit(habit.id, 'down')}
        aria-label="Skor negatif"
      >
        −
      </button>
    </div>
  );
}

function Checklist({ taskId, items }: { taskId: string; items: ChecklistItem[] }) {
  const toggleChecklistItem = useGame((s) => s.toggleChecklistItem);
  if (items.length === 0) return null;
  return (
    <div className="checklist" onClick={(e) => e.stopPropagation()}>
      {items.map((it) => (
        <button
          key={it.id}
          className={`cl-item ${it.done ? 'done' : ''}`}
          onClick={() => toggleChecklistItem(taskId, it.id)}
        >
          <span className="cl-box">{it.done ? '✓' : ''}</span>
          <span className="cl-text">{it.text}</span>
        </button>
      ))}
    </div>
  );
}

function checklistBadge(items: ChecklistItem[]) {
  if (items.length === 0) return null;
  const done = items.filter((it) => it.done).length;
  return (
    <span className={done === items.length ? 'cl-badge full' : 'cl-badge'}>
      ☑ {done}/{items.length}
    </span>
  );
}

function DailyItem({ daily, onEdit }: { daily: Daily; onEdit: (t: Task) => void }) {
  const toggleDaily = useGame((s) => s.toggleDaily);
  const color = valueColor(daily.value);
  const todayIdx = new Date().getDay();
  const dueToday = daily.repeat[todayIdx];

  return (
    <div
      className={`card check-card ${daily.completed ? 'done' : ''} ${
        dueToday ? '' : 'not-due'
      }`}
      style={{ borderLeftColor: color }}
    >
      <button
        className="checkbox"
        style={daily.completed ? {} : { borderColor: color }}
        onClick={() => toggleDaily(daily.id)}
        aria-label={daily.completed ? 'Batal centang' : 'Selesaikan'}
      >
        {daily.completed ? '✓' : ''}
      </button>
      <div className="card-body" onClick={() => onEdit(daily)}>
        <div className="card-title">{daily.title}</div>
        {daily.notes && <div className="card-notes">{daily.notes}</div>}
        <Checklist taskId={daily.id} items={daily.checklist} />
        <div className="card-meta">
          {checklistBadge(daily.checklist)}
          {daily.streak > 0 && <span className="streak">🔥 {daily.streak}</span>}
          <span className="repeat-days">
            {daily.repeat.every(Boolean)
              ? 'Setiap hari'
              : daily.repeat
                  .map((on, i) => (on ? DAY_FULL[i] : null))
                  .filter(Boolean)
                  .join(' · ')}
          </span>
          {!dueToday && <span className="muted">tidak jatuh tempo hari ini</span>}
        </div>
      </div>
    </div>
  );
}

function TodoItem({ todo, onEdit }: { todo: Todo; onEdit: (t: Task) => void }) {
  const toggleTodo = useGame((s) => s.toggleTodo);
  const color = valueColor(todo.value);
  const overdue =
    !!todo.dueDate && !todo.completed && todo.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`card check-card ${todo.completed ? 'done' : ''}`}
      style={{ borderLeftColor: color }}
    >
      <button
        className="checkbox"
        style={todo.completed ? {} : { borderColor: color }}
        onClick={() => toggleTodo(todo.id)}
        aria-label={todo.completed ? 'Batal centang' : 'Selesaikan'}
      >
        {todo.completed ? '✓' : ''}
      </button>
      <div className="card-body" onClick={() => onEdit(todo)}>
        <div className="card-title">{todo.title}</div>
        {todo.notes && <div className="card-notes">{todo.notes}</div>}
        <Checklist taskId={todo.id} items={todo.checklist} />
        {(todo.dueDate || todo.checklist.length > 0) && (
          <div className="card-meta">
            {checklistBadge(todo.checklist)}
            {todo.dueDate && (
              <span className={overdue ? 'overdue' : ''}>
                📅 {todo.dueDate}
                {overdue ? ' — terlambat!' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RewardItem({ reward, onEdit }: { reward: Reward; onEdit: (t: Task) => void }) {
  const buyReward = useGame((s) => s.buyReward);
  const gold = useGame((s) => s.player.gold);
  const affordable = gold >= reward.cost;

  return (
    <div className="card reward-card">
      <div className="card-body" onClick={() => onEdit(reward)}>
        <div className="card-title">🎁 {reward.title}</div>
        {reward.notes && <div className="card-notes">{reward.notes}</div>}
      </div>
      <button
        className={`buy-btn ${affordable ? '' : 'poor'}`}
        onClick={() => buyReward(reward.id)}
      >
        🪙 {reward.cost}
      </button>
    </div>
  );
}

export { DAY_SHORT, DAY_FULL };
