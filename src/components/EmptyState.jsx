function EmptyState({ action, description, title }) {
  return (
    <div className="glass-panel border-dashed px-6 py-10 text-center">
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
