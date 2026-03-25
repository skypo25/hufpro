'use client'

import { useAppProfile } from '@/context/AppProfileContext'
import MobileRecordForm from '@/components/mobile/MobileRecordForm'
import MobileTherapyRecordForm from '@/components/mobile/MobileTherapyRecordForm'
import { professionToTherapyAiType } from '@/lib/professionToTherapyType'

type Props = {
  horseId: string
  recordId?: string
  mode?: 'create' | 'edit'
}

/**
 * Wählt Huf- vs. Therapie-Mobileformular nach docType — ohne Änderungen an MobileRecordForm.
 */
export default function MobileRecordEntry({ horseId, recordId, mode = 'create' }: Props) {
  const { profile } = useAppProfile()

  if (profile.docType === 'therapy') {
    return (
      <MobileTherapyRecordForm
        horseId={horseId}
        recordId={recordId}
        mode={mode}
        therapyAiType={professionToTherapyAiType(profile.profession)}
      />
    )
  }

  return <MobileRecordForm horseId={horseId} recordId={recordId} mode={mode} />
}
