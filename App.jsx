import { useCallback, useEffect, useState } from 'react'
import Landing from './components/Landing.jsx'
import Select from './components/Select.jsx'
import OnlineLobby from './components/OnlineLobby.jsx'
import Battle from './components/Battle.jsx'

/**
 * Tiny screen router — no dependencies, just state.
 *
 *   home → select (local/cpu) → battle
 *   home → lobby  (online)     → battle
 */
export default function App() {
  const [screen, setScreen] = useState('home') // home | select | lobby | battle
  const [mode, setMode] = useState('local') // local | cpu | online
  const [config, setConfig] = useState(null)
  const [battleKey, setBattleKey] = useState(0)

  const startMode = useCallback((m) => {
    setMode(m)
    setScreen(m === 'online' ? 'lobby' : 'select')
    window.scrollTo({ top: 0 })
  }, [])

  const beginBattle = useCallback(
    (cfg) => {
      setConfig({ mode, ...cfg })
      setBattleKey((k) => k + 1)
      setScreen('battle')
    },
    [mode],
  )

  const rematch = useCallback(() => {
    if (!config) return
    setBattleKey((k) => k + 1)
    setScreen('battle')
  }, [config])

  const changeChars = useCallback(() => {
    if (mode === 'online') {
      setConfig(null)
      setScreen('lobby')
    } else {
      setScreen('select')
    }
  }, [mode])

  const toMenu = useCallback(() => {
    setConfig(null)
    setScreen('home')
  }, [])

  // a match key makes sure "rematch" fully remounts the battle
  useEffect(() => {
    document.title = screen === 'battle' ? 'FIGHT! — Anime Clash' : 'Anime Clash — Browser Anime Fighting Game'
  }, [screen])

  if (screen === 'battle' && config) {
    return (
      <Battle
        key={battleKey}
        config={config}
        onExit={toMenu}
        onRematch={rematch}
        onChangeChars={changeChars}
      />
    )
  }

  if (screen === 'select') {
    return <Select mode={mode} onStart={beginBattle} onCancel={toMenu} />
  }

  if (screen === 'lobby') {
    return <OnlineLobby key={`lobby-${battleKey}`} onStart={beginBattle} onExit={toMenu} />
  }

  return <Landing onPlay={startMode} />
}
