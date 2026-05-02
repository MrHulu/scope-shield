import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';

const SEQUENCE_TIMEOUT_MS = 1000;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Wave 3 W3.7 — Linear-style two-key navigation chords:
 *   g d  → demo project (or first active project, fallback)
 *   g s  → settings page
 *   g 1..9 → N-th active project
 *
 * Press `g` then within 1 second the second key. Modifier keys disable the
 * chord (so ⌘g, Ctrl+g etc. fall through to browser/native handlers).
 */
export function NavigationKeys() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const armed = useRef<{ at: number } | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'g' && !armed.current) {
        armed.current = { at: Date.now() };
        // Disarm after timeout
        setTimeout(() => {
          if (armed.current && Date.now() - armed.current.at >= SEQUENCE_TIMEOUT_MS) {
            armed.current = null;
          }
        }, SEQUENCE_TIMEOUT_MS + 50);
        return;
      }

      if (!armed.current) return;
      if (Date.now() - armed.current.at > SEQUENCE_TIMEOUT_MS) {
        armed.current = null;
        return;
      }

      const key = e.key.toLowerCase();
      const allActive = projectsRef.current.filter((p) => p.status === 'active');

      if (key === 'd') {
        e.preventDefault();
        const demo = allActive.find((p) => p.isDemo) ?? allActive[0];
        if (demo) navigate(`/project/${demo.id}`);
      } else if (key === 's') {
        e.preventDefault();
        navigate('/settings');
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (allActive[idx]) navigate(`/project/${allActive[idx].id}`);
      }
      armed.current = null;
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return null;
}
