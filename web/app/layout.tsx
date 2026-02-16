import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Scene Graph Query | AI-Powered Visual Search',
  description: 'Natural language search over images and video using scene graphs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
