'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Swords, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BattleJoinModal } from '@/components/logs/battle-join-modal'

interface Props {
  params: Promise<{ code: string }>
}

export default function JoinBattlePage({ params }: Props) {
  const { code } = use(params)
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(true)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Swords className="size-8 text-primary" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-bold text-foreground">You've been challenged!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Battle code:{' '}
          <span className="font-mono font-bold tracking-widest text-foreground">{code}</span>
        </p>
      </div>
      <Button onClick={() => setModalOpen(true)}>
        <Swords className="mr-2 size-4" aria-hidden />
        Accept Battle
      </Button>
      <Button variant="ghost" onClick={() => router.push('/logs')}>
        <ArrowLeft className="mr-2 size-4" aria-hidden />
        Go to my logs
      </Button>

      <BattleJoinModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); router.push('/logs') }}
        prefillCode={code}
      />
    </div>
  )
}
