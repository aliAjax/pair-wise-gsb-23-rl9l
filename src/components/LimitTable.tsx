import { CHANNELS, CHANNEL_LABEL, ISO_CLASSES, type ClassLimits, type LimitsMatrix } from "../types";
import { formatCount } from "../domain";

export function LimitTable({
  matrix,
  highlightClassId,
  size = "normal",
}: {
  matrix: LimitsMatrix;
  highlightClassId?: string;
  size?: "normal" | "compact";
}) {
  return (
    <div className={`limit-table ${size === "compact" ? "compact" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>ISO 等级</th>
            {CHANNELS.map((ch) => (
              <th key={ch}>{CHANNEL_LABEL[ch]} 上限</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ISO_CLASSES.map((cls) => (
            <tr key={cls.id} className={cls.id === highlightClassId ? "row-hot" : ""}>
              <td className="cell-class">{cls.label}</td>
              {CHANNELS.map((ch) => (
                <td key={ch} className="cell-num">
                  {formatCount(matrix[cls.id][ch])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-unit">单位：粒/m³；「不设限」表示该通道本版本不设上限</p>
    </div>
  );
}

export function LimitChips({ limits }: { limits: ClassLimits }) {
  return (
    <div className="limit-chips">
      {CHANNELS.map((ch) => (
        <span key={ch}>
          {CHANNEL_LABEL[ch]} ≤ {formatCount(limits[ch])}
        </span>
      ))}
    </div>
  );
}
