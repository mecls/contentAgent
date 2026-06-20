'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import {
  updatePost,
  updatePostMetrics,
  updatePostTags,
  markPosted,
  deletePost,
  type PostMetrics,
} from '@/lib/db/posts'

export async function updatePostAction(
  id: string,
  patch: {
    hook?: string | null
    body?: string
    archetype?: string | null
    status?: 'draft' | 'approved' | 'posted'
    linkedin_url?: string | null
    image_url?: string | null
  },
) {
  const { accountId } = await requireAccountId()
  await updatePost(accountId, id, patch)
  revalidatePath('/app/posts')
}

export async function updateMetricsAction(id: string, metrics: PostMetrics) {
  const { accountId } = await requireAccountId()
  await updatePostMetrics(accountId, id, metrics)
  revalidatePath('/app/posts')
}

export async function updateTagsAction(id: string, tags: string[]) {
  const { accountId } = await requireAccountId()
  const normalized = await updatePostTags(accountId, id, tags)
  revalidatePath('/app/posts')
  return normalized
}

export async function togglePostedAction(id: string, posted: boolean) {
  const { accountId } = await requireAccountId()
  await markPosted(accountId, id, posted)
  revalidatePath('/app/posts')
}

export async function deletePostAction(id: string) {
  const { accountId } = await requireAccountId()
  await deletePost(accountId, id)
  revalidatePath('/app/posts')
}
