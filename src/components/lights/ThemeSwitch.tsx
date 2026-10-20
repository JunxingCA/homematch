export type ThemeChoice = "auto" | "light" | "dark";

const OPTIONS: {
  id: ThemeChoice;
  label: string;
  aria: string;
  icon: string;
}[] = [
  {
    id: "auto",
    label: "Auto",
    aria: "Follow the time of day",
    icon: "M12 3v2M12 19v2M5 12H3M21 12h-2M12 8a4 4 0 0 0 0 8z",
  },
  {
    id: "light",
    label: "",
    aria: "Switch to light mode",
    icon: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  },
  {
    id: "dark",
    label: "",
    aria: "Switch to dark mode",
    icon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  },
];

/** Auto (follows the clock), day and night. */
export function ThemeSwitch({
  choice,
  onChoose,
}: {
  choice: ThemeChoice;
  onChoose: (choice: ThemeChoice) => void;
}) {
  return (
    <span
      role="group"
      aria-label="Theme"
      className="seg-group"
      style={{ padding: 3, gap: 2, flex: "none", flexWrap: "nowrap" }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          className="seg"
          style={{
            flex: "none",
            minHeight: 38,
            minWidth: 40,
            padding: "8px 11px",
            fontSize: 13,
          }}
          aria-pressed={choice === o.id}
          aria-label={o.aria}
          title={o.aria}
          onClick={() => onChoose(o.id)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={o.icon} />
          </svg>
          {o.label && <span data-theme-label="">{o.label}</span>}
        </button>
      ))}
    </span>
  );
}
