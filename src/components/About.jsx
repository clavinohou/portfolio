import { motion } from 'framer-motion'
import './About.css'

const About = () => {
  const skills = [
    'PCB Design',
    'Robotics',
    'C++',
    'Circuit Analysis',
    'CAD',
    'Electrical Wiring',
    'Manufacturing',
    'Circuit Debugging',
  ]

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

  return (
    <section id="about" className="about section">
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.h2 variants={itemVariants} className="section-title">
            About
          </motion.h2>
          <motion.div variants={itemVariants} className="about-content">
            <div className="about-text">
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
              <div className="education-info">
                <h4>Education</h4>
                <p><strong>Georgia Institute of Technology</strong> — B.S. Electrical Engineering (Expected May 2028)</p>
                <p>Atlanta, GA</p>
              </div>
            </div>
            <div className="about-skills">
              <h3>Skills & Interests</h3>
              <div className="skills-grid">
                {skills.map((skill, index) => (
                  <motion.div
                    key={skill}
                    className="skill-item"
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, color: 'var(--color-accent)' }}
                  >
                    {skill}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default About


