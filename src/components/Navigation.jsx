import { motion } from 'framer-motion'
import './Navigation.css'

const Navigation = ({ activeSection, setActiveSection }) => {
  const navItems = [
    { id: 'hero', label: 'About' },
    { id: 'projects', label: 'Projects' },
    { id: 'experience', label: 'Experience' },
    { id: 'contact', label: 'Find Me' },
  ]

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId)
  }

  return (
    <nav className="navigation">
      <div className="nav-container">
        <motion.button
          className="nav-logo aluminum"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleNavClick('hero')}
        >
          CH
        </motion.button>
        <ul className="nav-keys">
          {navItems.map((item, index) => (
            <li key={item.id} className="piano-key-wrapper">
              <motion.button
                className={`piano-key ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                whileHover={{ y: -2 }}
                whileTap={{ y: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <span className="key-label">{item.label}</span>
                {activeSection === item.id && (
                  <motion.div
                    className="key-indicator"
                    layoutId="activeKey"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default Navigation


