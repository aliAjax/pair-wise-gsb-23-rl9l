import { CHANNELS, fmtNum, ISO_CLASSES } from "../domain";
import type { ParticleLimits } from "../types";

interface Props {
  limits: Record<string, ParticleLimits>;
  mode: "read" | "edit";
  /** 非法输入单元高亮，key = `${ISO等级}:${通道}` */
  invalidCells?: ReadonlySet<string>;
  onChange?: (isoClass: string, channel: keyof ParticleLimits, value: string) => void;
}

export default function LimitsMatrix({ limits, mode, invalidCells, onChange }: Props) {
  return (
    <div className="limits-matrix-wrap">
      <table className="limits-matrix">
        <thead>
          <tr>
            <th>ISO 等级</th>
            {CHANNELS.map((c) => (
              <th key={c.key}>{c.label} 上限（粒/m³）</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ISO_CLASSES.map((iso) => (
            <tr key={iso}>
              <th>{iso}</th>
              {CHANNELS.map((c) => {
                const cellKey = `${iso}:${c.key}`;
                const value = limits[iso]?.[c.key];
                const invalid = invalidCells?.has(cellKey);
                return (
                  <td key={c.key}>
                    {mode === "edit" ? (
                      <input
                        className={invalid ? "cell-invalid" : ""}
                        aria-label={`${iso} ${c.label} 上限`}
                        value={value === undefined ? "" : String(value)}
                        inputMode="numeric"
                        onChange={(e) => onChange?.(iso, c.key, e.target.value)}
                      />
                    ) : (
                      <span className={invalid ? "cell-over" : ""}>
                        {value === undefined ? "—" : fmtNum(value)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
