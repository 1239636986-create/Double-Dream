import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  time?: string;
};

export function PhoneShell({ children, time = "1:35" }: Props) {
  return (
    <div className="phone-frame">
      <div className="phone-notch" aria-hidden />
      <div className="status-bar">
        <span>{time}</span>
        <div className="status-icons" aria-hidden>
          <span>●●●</span>
          <span>Wi‑Fi</span>
          <span>63%</span>
        </div>
      </div>
      {children}
    </div>
  );
}
