import { useState } from 'react';
import { X, AlertCircle, Lightbulb, HelpCircle, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

type FeedbackType = 'bug_report' | 'feature_request' | 'other';

const TYPES: { id: FeedbackType; label: string; Icon: typeof AlertCircle; placeholder: string }[] = [
  {
    id: 'bug_report',
    label: 'Bug',
    Icon: AlertCircle,
    placeholder: "What went wrong? Steps to reproduce…",
  },
  {
    id: 'feature_request',
    label: 'Feature',
    Icon: Lightbulb,
    placeholder: "What would you like to see added?",
  },
  {
    id: 'other',
    label: 'Other',
    Icon: HelpCircle,
    placeholder: "Your message…",
  },
];

export function FeedbackDialog({
  userId,
  username,
  onClose,
}: {
  userId: string;
  username: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<FeedbackType>('bug_report');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const placeholder = TYPES.find(t => t.id === type)?.placeholder ?? '';
  const canSubmit = message.trim().length >= 5 && status !== 'loading';

  async function handleSubmit() {
    if (!canSubmit) {
      setErrorMsg('Please write at least a few words.');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase.from('feedback').insert({
      user_id: userId,
      username,
      type,
      message: message.trim(),
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    } else {
      setStatus('success');
      setTimeout(onClose, 2200);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="bg-[oklch(0.99_0.006_230)] border border-black/[0.08] rounded-2xl p-5 w-full max-w-[360px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {status === 'success' ? (
          /* ── Success state ── */
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 grid place-items-center">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <p className="font-display text-sm font-bold text-foreground tracking-wide">
              Thanks for reaching out!
            </p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[220px]">
              We read every message and will get back to you if needed.
            </p>
          </div>
        ) : (
          /* ── Form ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-xs tracking-widest uppercase blue-text">
                Contact Us
              </p>
              <button
                onClick={onClose}
                className="w-7 h-7 grid place-items-center rounded-full bg-black/[0.06] active:bg-black/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {TYPES.map(({ id, label, Icon }) => {
                const selected = type === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setType(id); setErrorMsg(''); }}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-display tracking-wide uppercase transition-colors ${
                      selected
                        ? 'bg-[color:var(--color-blue)] border-[color:var(--color-blue)] text-white'
                        : 'bg-white border-black/[0.08] text-gray-400 active:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Message textarea */}
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setErrorMsg(''); setStatus('idle'); }}
              placeholder={placeholder}
              maxLength={1000}
              rows={4}
              className="w-full rounded-xl border border-black/[0.10] bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-gray-400 resize-none outline-none focus:border-[color:var(--color-blue)]/50 transition-colors"
            />

            {/* Error + char count */}
            <div className="flex items-center justify-between mt-1 mb-4 min-h-[16px]">
              <p className="text-[11px] text-red-400">{errorMsg}</p>
              <p className="text-[10px] text-gray-400">{message.length}/1000</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl font-display tracking-wider uppercase text-[11px] font-bold bg-white text-gray-500 border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 h-11 rounded-xl font-display tracking-wider uppercase text-[11px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow active:scale-[0.97] transition-transform disabled:opacity-40 disabled:scale-100"
              >
                {status === 'loading' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
