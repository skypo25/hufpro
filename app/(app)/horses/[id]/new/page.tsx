import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function HorseNewPage({ params }: Props) {
  const { id } = await params
  redirect(`/horses/${id}/records/new`)
}
