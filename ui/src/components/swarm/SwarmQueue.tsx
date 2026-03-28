export function SwarmQueue() {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Approval Queue</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Capabilities requested by agents that need board approval.
          </p>
        </div>
      </div>
      <div className="text-center py-12">
        <div className="text-3xl opacity-30 mb-3">{"\u{1F514}"}</div>
        <div className="text-sm font-semibold mb-1">No pending requests</div>
        <div className="text-xs text-muted-foreground">
          When agents request capabilities that need approval, they'll appear here.
        </div>
      </div>
    </div>
  );
}
