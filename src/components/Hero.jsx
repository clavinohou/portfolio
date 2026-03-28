import { motion } from 'framer-motion'
import './Hero.css'

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  const idInfo = {
    name: 'Calvin Hou',
    licNumber: 'WDLABCD456DG',
    dob: 'MM/DD/YYYY', // Update with your date of birth
    height: "5'9\"",
    address: '123 Street Address, Seattle WA 98101',
    issueDate: '01/15/2024',
    expirationDate: '08/12/2028',
    school: 'Georgia Institute of Technology',
    year: 'Sophomore',
    expected: 'May 2028',
  }

  const interests = [
    'Robotics',
    'PCB Design',
    'Hardware',
    'Electronics',
    'FIRST Robotics',
    'EV Systems',
  ]

  return (
    <section id="hero" className="hero section page-section">
      <div className="container">
        <motion.div
          className="hero-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ID Card on Left */}
          <motion.div
            className="id-card"
            variants={itemVariants}
          >
            <div className="id-card-background-seal">
              <svg className="evergreen-seal" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
                {/* Evergreen tree silhouette */}
                <path d="M100 20 L85 60 L60 55 L75 85 L50 90 L100 100 L150 90 L125 85 L140 55 L115 60 Z" fill="#2d5016" opacity="0.12"/>
                <rect x="95" y="90" width="10" height="50" fill="#2d5016" opacity="0.12"/>
                {/* Circular seal border */}
                <circle cx="100" cy="100" r="85" fill="none" stroke="#2d5016" strokeWidth="1" opacity="0.08"/>
              </svg>
            </div>
            
            <div className="id-card-header">
              <div className="id-header-left">
                <div className="id-state-name">WASHINGTON</div>
                <div className="id-state-usa">USA</div>
              </div>
              <div className="id-header-right">
                <div className="id-license-type">ENHANCED DRIVER LICENSE</div>
              </div>
            </div>
            
            <div className="id-card-main">
              <div className="id-card-photo-section">
                <div className="id-card-photo">
                  <img 
                    src="/images/profile.jpg" 
                    alt="Calvin Hou"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150x180/FFFFFF/2C3E50?text=Photo'
                    }}
                  />
                </div>
                <div className="id-signature">
                  <div className="id-signature-line"></div>
                </div>
              </div>
              
              <div className="id-card-info-section">
                <div className="id-name-row">
                  <div className="id-name-primary">{idInfo.name}</div>
                  <div className="id-lic-section">
                    <span className="id-label">LIC#</span>
                    <span className="id-value">{idInfo.licNumber}</span>
                  </div>
                </div>
                
                <div className="id-info-grid">
                  <div className="id-data-field">
                    <span className="id-label">DOB</span>
                    <span className="id-value">{idInfo.dob}</span>
                  </div>
                  
                  <div className="id-data-field">
                    <span className="id-label">HT</span>
                    <span className="id-value">{idInfo.height}</span>
                  </div>
                  
                  <div className="id-dates-section">
                    <div className="id-data-field">
                      <span className="id-label">ISS</span>
                      <span className="id-value">{idInfo.issueDate}</span>
                    </div>
                    <div className="id-data-field">
                      <span className="id-label">EXP</span>
                      <span className="id-value id-expiration">{idInfo.expirationDate}</span>
                    </div>
                  </div>
                  
                  <div className="id-data-field full-width">
                    <span className="id-label">School</span>
                    <span className="id-value">{idInfo.school}</span>
                  </div>
                  
                  <div className="id-data-field">
                    <span className="id-label">Year</span>
                    <span className="id-value">{idInfo.year}</span>
                  </div>
                  
                  <div className="id-data-field">
                    <span className="id-label">Expected</span>
                    <span className="id-value">{idInfo.expected}</span>
                  </div>
                  
                  <div className="id-data-field full-width">
                    <span className="id-label">Interests</span>
                    <div className="id-interests-list">
                      {interests.map((interest, index) => (
                        <span key={index} className="id-interest-item">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* About Section on Right */}
          <motion.div
            className="hero-about"
            variants={itemVariants}
          >
            <h2 className="about-section-title">About Me</h2>
            <p>
              I'm an Electrical Engineering student at Georgia Tech, passionate about robotics,
              hardware design, and creating innovative solutions. I've founded and led a FIRST Robotics
              team that ranked in the top 4% globally, and I'm currently working on electric vehicle
              systems with Hytech Racing.
            </p>
            <p>
              My experience spans from thermal cooling systems for AI hardware to custom controllers
              for robotic arms, always combining technical rigor with practical problem-solving.
              I believe in building things that work—reliably, efficiently, and elegantly.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero


