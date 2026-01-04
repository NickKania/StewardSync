import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { MockConvexProvider, mockConvexClient } from "@/lib/mock-convex";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StewardSync",
  description: "Unified application for reviewing racing steward reports",
};

// Check if we're in mock mode
const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {isMockMode ? (
          <MockConvexProvider client={mockConvexClient}>
            {children}
          </MockConvexProvider>
        ) : (
          <ConvexProvider client={convex}>
            {children}
          </ConvexProvider>
        )}
      </body>
    </html>
  );
}
