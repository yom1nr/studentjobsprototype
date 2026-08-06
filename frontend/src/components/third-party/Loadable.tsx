import { Suspense, type ComponentType, type JSX, type LazyExoticComponent } from 'react'
import { Loader } from './Loader'

export function Loadable<TProps extends JSX.IntrinsicAttributes>(
  LazyComponent: LazyExoticComponent<ComponentType<TProps>>,
) {
  return function LoadableComponent(props: TProps) {
    return (
      <Suspense fallback={<Loader />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}
