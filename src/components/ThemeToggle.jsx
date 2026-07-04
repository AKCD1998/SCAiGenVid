export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle}>
      {theme === "dark" ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
    </button>
  );
}
