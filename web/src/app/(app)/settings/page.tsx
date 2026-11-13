import type { Metadata } from 'next'
import { ConnectionsPanel } from '../../../components/settings/ConnectionsPanel'

export const metadata: Metadata = { title: 'Settings · Atlas' }

export default function SettingsPage() {
  return <ConnectionsPanel />
}
