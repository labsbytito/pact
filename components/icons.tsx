import {
  ArrowLeft,
  ChevronRight,
  Copy,
  List,
  Pencil,
  RefreshCw,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

type IconProps = { size?: number };

function glyph(Icon: LucideIcon, size = 16) {
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export function ArrowLeftIcon({ size = 16 }: IconProps) {
  return glyph(ArrowLeft, size);
}
export function SettingsIcon({ size = 16 }: IconProps) {
  return glyph(Settings, size);
}
export function ListIcon({ size = 16 }: IconProps) {
  return glyph(List, size);
}
export function CloseIcon({ size = 16 }: IconProps) {
  return glyph(X, size);
}
export function CopyIcon({ size = 14 }: IconProps) {
  return glyph(Copy, size);
}
export function RetryIcon({ size = 14 }: IconProps) {
  return glyph(RefreshCw, size);
}
export function PencilIcon({ size = 14 }: IconProps) {
  return glyph(Pencil, size);
}
export function ChevronIcon({ size = 12, open = false }: IconProps & { open?: boolean }) {
  return (
    <ChevronRight
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 180ms ease" }}
    />
  );
}
