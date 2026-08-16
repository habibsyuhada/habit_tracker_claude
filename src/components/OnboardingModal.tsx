import { useState } from 'react';
import { useGame } from '../store/useGame';

const AVATARS = ['🧙', '⚔️', '🛡️', '🏹', '🐉', '🦊', '🐱', '🦉', '🌸', '🚀'];

const STEPS = [
  {
    icon: '🏰',
    title: 'Sebuah Kerajaan Menanti',
    text:
      'Di lembah yang jauh, sebuah dusun kecil kehilangan pemimpinnya. ' +
      'Tiga rakyat yang tersisa menatap jalan setapak setiap pagi, ' +
      'berharap seseorang datang membawa perubahan. Orang itu... adalah kamu.',
  },
  {
    icon: '📜',
    title: 'Kebiasaanmu adalah Titahmu',
    text:
      'Kerajaan ini tumbuh dari kebiasaanmu di dunia nyata: Habits, Dailies, dan ' +
      'To-Dos adalah titah kerajaan. Tunaikan, maka kas terisi dan rakyat berdatangan. ' +
      'Terbengkalai? Moral rakyat merosot — dan serigala di perbatasan mencium kelemahan.',
  },
  {
    icon: '👑',
    title: 'Perkenalkan Dirimu, Yang Mulia',
    text: 'Rakyat ingin tahu siapa yang akan memimpin mereka menuju kejayaan.',
  },
];

export function OnboardingModal() {
  const setProfile = useGame((s) => s.setProfile);
  const setOnboarded = useGame((s) => s.setOnboarded);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    setProfile(name.trim() || 'Petualang', avatar);
    setOnboarded();
  };

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <div className="modal onboarding" onClick={(e) => e.stopPropagation()}>
        <div className="onboard-icon">{current.icon}</div>
        <h2 className="onboard-title">{current.title}</h2>
        <p className="onboard-text">{current.text}</p>

        {isLast && (
          <>
            <label className="field">
              <span>Namamu</span>
              <input
                autoFocus
                value={name}
                maxLength={24}
                placeholder="Petualang"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="field">
              <span>Lambangmu</span>
              <div className="chip-row">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    className={`chip avatar-chip ${avatar === a ? 'active' : ''}`}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="onboard-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="modal-actions onboard-actions">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              Kembali
            </button>
          )}
          {isLast ? (
            <button className="btn primary" onClick={finish}>
              Mulai Memerintah 👑
            </button>
          ) : (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              Lanjut
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
