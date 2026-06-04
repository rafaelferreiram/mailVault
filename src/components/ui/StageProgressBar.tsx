interface Props {
  /** 1-based current stage index (0 = not started). */
  current: number;
  total: number;
  /** Progress within the current stage, 0..1. */
  stageProgress: number;
}

export function StageProgressBar({ current, total, stageProgress }: Props) {
  return (
    <div className="stage-bar">
      {Array.from({ length: total }).map((_, i) => {
        const stageNo = i + 1;
        const isDone = stageNo < current;
        const isActive = stageNo === current;
        const fill = isDone ? 1 : isActive ? Math.max(0.05, Math.min(1, stageProgress)) : 0;
        return (
          <div
            key={i}
            className={`stage-seg ${isDone ? 'done' : isActive ? 'active' : ''}`}
            style={{ ['--seg-fill' as string]: String(fill) }}
          />
        );
      })}
    </div>
  );
}
