import { PageSkeleton } from '@/components/app/page-skeleton'

export default function Loading() {
  return <PageSkeleton title="Posts" width="5xl" cards={4} />
}
