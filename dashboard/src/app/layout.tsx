import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeVariant",
  description: "AB testing that understands your product",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-zinc-900 text-zinc-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
