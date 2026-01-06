import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const users = await prisma.user.count()
  const accounts = await prisma.account.count()
  const trades = await prisma.trade.count()
  const screenshots = await prisma.screenshot.count()
  const dayJournals = await prisma.dayJournal.count()
  const playbooks = await prisma.playbook.count()
  const playbookGroups = await prisma.playbookGroup.count()
  const playbookPrerequisites = await prisma.playbookPrerequisite.count()
  
  console.log('')
  console.log('📊 État de la base Supabase PostgreSQL:')
  console.log('=' .repeat(40))
  console.log(`  ✓ Users:                ${users}`)
  console.log(`  ✓ Accounts:             ${accounts}`)
  console.log(`  ✓ Trades:               ${trades}`)
  console.log(`  ✓ Screenshots:          ${screenshots}`)
  console.log(`  ✓ Day Journals:         ${dayJournals}`)
  console.log(`  ✓ Playbooks:            ${playbooks}`)
  console.log(`  ✓ Playbook Groups:      ${playbookGroups}`)
  console.log(`  ✓ Playbook Prerequisites: ${playbookPrerequisites}`)
  console.log('=' .repeat(40))
  
  await prisma.$disconnect()
}

check().catch(console.error)

