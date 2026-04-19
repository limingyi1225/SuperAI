import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./liquid-glass.css";
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  metadataBase: new URL("https://isaabby.app"),
  title: {
    default: "isaabby — AI Homework Helper",
    template: "%s · isaabby",
  },
  description:
    "Upload questions, select AI models, and get detailed step-by-step solutions streamed from Claude, GPT, Gemini, and Grok in parallel.",
  keywords: ["homework", "AI", "tutor", "GPT", "Claude", "Gemini", "Grok", "study", "answers"],
  applicationName: "isaabby",
  authors: [{ name: "isaabby" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "isaabby — AI Homework Helper",
    description:
      "Multi-model AI tutor. Submit a question, watch Claude, GPT, Gemini, and Grok answer in parallel.",
    siteName: "isaabby",
  },
  twitter: {
    card: "summary_large_image",
    title: "isaabby — AI Homework Helper",
    description:
      "Multi-model AI tutor. Submit a question, watch Claude, GPT, Gemini, and Grok answer in parallel.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
