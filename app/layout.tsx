import type { Metadata } from "next";
import "./globals.css";
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: "isaabby",
  description: "Upload questions, select AI models, get detailed step-by-step solutions",
  keywords: ["homework", "AI", "tutor", "GPT", "Gemini", "study", "answers"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
