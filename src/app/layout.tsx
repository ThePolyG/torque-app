import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TORQUE OS',
  description: 'The Polymath Guild — Operations Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
