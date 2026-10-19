export const metadata = {
  title: "Pact",
  description: "A little intention. A real next step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", background: "#121212", color: "#f5f5f5" }}>
        {children}
      </body>
    </html>
  );
}
