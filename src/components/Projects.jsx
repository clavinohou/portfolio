import { motion } from 'framer-motion'
import './Projects.css'

const Projects = () => {
  const projects = [
    {
      id: 1,
      title: 'Pulse FRC Pit Display',
      description: 'Designed and optimized the UX/UI for a multi-functional pit display supporting FRC teams during competition. Attracted 4,000+ users worldwide within its first week of launch.',
      tags: ['UI/UX', 'Web Development', 'FRC'],
      color: '#FF6B35',
      link: 'https://pulsefrc.app',
    },
    {
      id: 2,
      title: 'Custom Media Controller & Keyboard',
      description: 'Designed and fabricated a custom PCB using KiCad and STM32 for media control. Built a full keyboard with diode matrix and Teensy microcontroller for reliable keyscanning and USB communication.',
      tags: ['PCB Design', 'Hardware', 'Embedded Systems'],
      color: '#000000',
    },
    {
      id: 3,
      title: '3DOF Robotic Arm Controller',
      description: 'Created and implemented a custom controller for a 3DOF arm, applying inverse kinematics to move an end effector to target coordinates in 3D space during research at NUS.',
      tags: ['Robotics', 'Control Systems', 'Inverse Kinematics'],
      color: '#FF6B35',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <section id="projects" className="projects section page-section">
      <div className="container">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Projects
        </motion.h2>
        <motion.div
          className="projects-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {projects.map((project) => (
            <motion.div
              key={project.id}
              className="project-card"
              variants={cardVariants}
              whileHover={{ y: -10 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="project-header">
                <h3>{project.title}</h3>
                <div
                  className="project-accent"
                  style={{ backgroundColor: project.color }}
                />
              </div>
              <p className="project-description">{project.description}</p>
              <div className="project-tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="project-tag">
                    {tag}
                  </span>
                ))}
              </div>
              {project.link ? (
                <motion.a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-link aluminum-texture"
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    border: '1px solid rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'inline-block',
                  }}
                  whileHover={{ x: 5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Project →
                </motion.a>
              ) : (
                <motion.button
                  className="project-link aluminum-texture"
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    border: '1px solid rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                  whileHover={{ x: 5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Details →
                </motion.button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Projects


