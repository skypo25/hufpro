import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={['huf-card', className].join(' ')}
    >
      {children}
    </div>
  )
}