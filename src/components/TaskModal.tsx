import { useEffect, useState } from 'react';
import type { ChecklistItem, Difficulty, Task, TaskType } from '../types';
import { DIFFICULTY_LABEL } from '../game/formulas';
import { useGame } from '../store/useGame';
import { DAY_SHORT } from './TaskItem';

const TYPE_LABEL: Record<TaskType, string> = {
  habit: 'Habit',
  daily: 'Daily',
  todo: 'To-Do',
  reward: 'Reward',
};

interface Props {
  /** task yang diedit, atau null untuk buat baru */
  task: Task | null;
  /** tipe default saat membuat baru */
  defaultType: TaskType;
  onClose: () => void;
}

export function TaskModal({ task, defaultType, onClose }: Props) {
  const addTask = useGame((s) => s.addTask);
  const updateTask = useGame((s) => s.updateTask);
  const deleteTask = useGame((s) => s.deleteTask);

  const type: TaskType = task?.type ?? defaultType;
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(
    task && task.type !== 'reward' ? task.difficulty : 'easy'
  );
  const [up, setUp] = useState(task?.type === 'habit' ? task.up : true);
  const [down, setDown] = useState(task?.type === 'habit' ? task.down : false);
  const [repeat, setRepeat] = useState<boolean[]>(
    task?.type === 'daily' ? [...task.repeat] : [true, true, true, true, true, true, true]
  );
  const [dueDate, setDueDate] = useState(task?.type === 'todo' ? task.dueDate ?? '' : '');
  const [cost, setCost] = useState(task?.type === 'reward' ? String(task.cost) : '10');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    task?.type === 'daily' || task?.type === 'todo' ? [...task.checklist] : []
  );

  const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    if (!title.trim()) return;
    const cleanChecklist = checklist
      .map((it) => ({ ...it, text: it.text.trim() }))
      .filter((it) => it.text);
    if (task) {
      const patch: Record<string, unknown> = { title: title.trim(), notes: notes.trim() };
      if (type !== 'reward') patch.difficulty = difficulty;
      if (type === 'habit') Object.assign(patch, { up, down });
      if (type === 'daily') patch.repeat = repeat;
      if (type === 'todo') patch.dueDate = dueDate || undefined;
      if (type === 'daily' || type === 'todo') patch.checklist = cleanChecklist;
      if (type === 'reward') patch.cost = Math.max(1, Number(cost) || 10);
      updateTask(task.id, patch as Partial<Task>);
    } else {
      addTask({
        type,
        title,
        notes,
        difficulty,
        up,
        down,
        repeat,
        dueDate: dueDate || undefined,
        cost: Math.max(1, Number(cost) || 10),
        checklist: cleanChecklist,
      });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {task ? 'Edit' : 'Buat'} {TYPE_LABEL[type]}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Judul</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'reward' ? 'Contoh: Beli kopi enak' : 'Contoh: Baca buku 10 menit'
            }
          />
        </label>

        <label className="field">
          <span>Catatan</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opsional"
          />
        </label>

        {type !== 'reward' && (
          <div className="field">
            <span>Kesulitan</span>
            <div className="chip-row">
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`chip ${difficulty === d ? 'active' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'habit' && (
          <div className="field">
            <span>Arah skor</span>
            <div className="chip-row">
              <button className={`chip ${up ? 'active' : ''}`} onClick={() => setUp(!up)}>
                ＋ Positif
              </button>
              <button
                className={`chip ${down ? 'active' : ''}`}
                onClick={() => setDown(!down)}
              >
                － Negatif
              </button>
            </div>
          </div>
        )}

        {type === 'daily' && (
          <div className="field">
            <span>Ulangi tiap hari</span>
            <div className="chip-row">
              {DAY_SHORT.map((d, i) => (
                <button
                  key={i}
                  className={`chip day-chip ${repeat[i] ? 'active' : ''}`}
                  onClick={() =>
                    setRepeat(repeat.map((on, j) => (j === i ? !on : on)))
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'todo' && (
          <label className="field">
            <span>Tenggat</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        )}

        {(type === 'daily' || type === 'todo') && (
          <div className="field">
            <span>
              Checklist
              {type === 'daily' && (
                <em className="field-hint"> — item tercentang mengurangi damage bila terlewat</em>
              )}
            </span>
            {checklist.map((it, i) => (
              <div className="cl-edit-row" key={it.id}>
                <input
                  value={it.text}
                  placeholder={`Item ${i + 1}`}
                  onChange={(e) =>
                    setChecklist(
                      checklist.map((c) =>
                        c.id === it.id ? { ...c, text: e.target.value } : c
                      )
                    )
                  }
                />
                <button
                  className="icon-btn"
                  onClick={() => setChecklist(checklist.filter((c) => c.id !== it.id))}
                  aria-label="Hapus item"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn ghost add-cl"
              onClick={() =>
                setChecklist([...checklist, { id: uid(), text: '', done: false }])
              }
            >
              ＋ Tambah item
            </button>
          </div>
        )}

        {type === 'reward' && (
          <label className="field">
            <span>Harga (gold)</span>
            <input
              type="number"
              min={1}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
        )}

        <div className="modal-actions">
          {task && (
            <button
              className="btn danger"
              onClick={() => {
                deleteTask(task.id);
                onClose();
              }}
            >
              Hapus
            </button>
          )}
          <button className="btn primary" onClick={save} disabled={!title.trim()}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
