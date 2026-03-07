function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-muted sm:text-base">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
