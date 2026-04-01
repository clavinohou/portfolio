import { useState } from 'react'
import Oscilloscope from './components/Oscilloscope'
import './App.css'

const channelOrder = ['about', 'projects', 'resume', 'experience', 'contact']

export default function App() {
  /** null = home (oscilloscope only); otherwise which projector page is open */
  const [activeChannel, setActiveChannel] = useState(null)
  const [direction, setDirection] = useState(1)

  const handleChannelChange = (nextId) => {
    const currentIndex = activeChannel == null ? -1 : channelOrder.indexOf(activeChannel)
    const nextIndex = channelOrder.indexOf(nextId)
    setDirection(nextIndex > currentIndex ? 1 : -1)
    setActiveChannel(nextId)
  }

  const handleHome = () => {
    setActiveChannel(null)
  }

  return (
    <div className="app">
      <Oscilloscope
        activeChannel={activeChannel}
        onChannelChange={handleChannelChange}
        onHome={handleHome}
        direction={direction}
      />
    </div>
  )
}
