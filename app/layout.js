import "./globals.css";

export const metadata = {
  title: "LinguaFlow",
  description: "AI-powered language learning platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
