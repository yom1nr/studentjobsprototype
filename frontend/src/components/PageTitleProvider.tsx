import { useState, type ReactNode } from 'react'
import { PageTitleContext } from './PageTitleContext'

export function PageTitleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [title, setTitle] = useState('')
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>
}
