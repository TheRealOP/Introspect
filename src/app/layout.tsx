import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Introspect",
  description: "Check in. Track what you do. Spot your habits.",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
  manifest: "/manifest.webmanifest",
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

// Applies the saved (or OS-preferred) theme before first paint to avoid a flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="bg-background text-text antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SessionProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
