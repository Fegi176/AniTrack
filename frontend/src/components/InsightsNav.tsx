import { NavLink } from "react-router-dom";
import { BarChart3, History, Trophy } from "lucide-react";

export function InsightsNav() {
  return (
    <nav className="insights-nav" aria-label="Insights sections">
      <NavLink to="/insights" end>
        <BarChart3 size={16} /> Statistics
      </NavLink>
      <NavLink to="/insights/history">
        <History size={16} /> History
      </NavLink>
      <NavLink to="/insights/achievements">
        <Trophy size={16} /> Achievements
      </NavLink>
    </nav>
  );
}
