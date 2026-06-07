import { useEffect, useState } from 'react';
import { usePrefsStore } from '@/stores/prefsStore';
import type { LayoutTemplate } from '@shared/types';
import { LayoutCard } from './LayoutCard';
import { LAYOUT_OPTIONS } from './LayoutDiagrams';

export function LayoutSection() {
  const template = usePrefsStore((s) => s.prefs.layout.template);
  const setLayoutTemplate = usePrefsStore((s) => s.setLayoutTemplate);
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 1200 : true
  );

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div>
      <div className="layout-card-grid">
        {LAYOUT_OPTIONS.map((opt) => (
          <LayoutCard
            key={opt.id}
            id={opt.id}
            name={opt.name}
            description={opt.description}
            selected={template === opt.id}
            disabled={opt.id === 'three-column' && !wide}
            onSelect={(id) => setLayoutTemplate(id)}
          />
        ))}
      </div>
      <p className="text-[10px] text-fg-subtle mt-4 max-w-xl">
        Three Column requires a display wider than 1200px.
      </p>
    </div>
  );
}
