import { useContext, useEffect } from 'react'
import { PageTitleContext } from './PageTitleContext'

export function usePageTitle(title: string) {
  const ctx = useContext(PageTitleContext)
  useEffect(() => {
    ctx?.setTitle(title)
    return () => ctx?.setTitle('')
  }, [ctx, title])
}

export function useHeaderTitle() {
  const ctx = useContext(PageTitleContext)
  return ctx?.title ?? ''
}
