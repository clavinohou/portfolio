import { motion } from 'framer-motion'
import './Experience.css'

const Experience = () => {
  const experiences = [
    {
      id: 1,
      type: 'Internship',
      title: 'Research and Design Intern',
      company: 'Asia Vital Components',
      location: 'New Taipei City, Taiwan',
      date: 'August 2024',
      description: 'Assembled and validated next-generation liquid-to-air cooling solutions for high-performance AI hardware systems. Conducted thermal analysis using heat generation systems, optimizing performance parameters for production deployment.',
      tags: ['Thermal Analysis', 'Hardware Validation', 'AI Systems'],
    },
    {
      id: 2,
      type: 'Internship',
      title: 'Advanced Robotics Centre Research Intern',
      company: 'NUS College of Design & Engineering',
      location: 'Singapore',
      date: 'September 2024',
      description: 'Created and implemented a custom controller for a 3DOF arm, applying inverse kinematics to move an end effector to target coordinates in 3D space.',
      tags: ['Robotics', 'Control Systems', 'Inverse Kinematics'],
    },
    {
      id: 3,
      type: 'Activity',
      title: 'Electrical Systems Member',
      company: 'Hytech Racing (Electric Formula at Georgia Tech)',
      location: 'Atlanta, GA',
      date: 'August 2025 – Present',
      description: 'Designing and fabricating PCBs with Altium, adapting specifications from Formula SAE rules. Currently adapting the Accumulator (Battery) charging system to 240V with a standard EV charger J1772 connector.',
      tags: ['PCB Design', 'EV Systems', 'Altium'],
    },
    {
      id: 4,
      type: 'Leadership',
      title: 'Team Founder, President, Mechanical and Electrical Lead',
      company: 'FIRST Robotics Team 9442',
      location: 'Seattle, WA',
      date: 'June 2023 – April 2025',
      description: 'Founded, directed, and grew a community FIRST Robotics Competition (FRC) team in North Seattle, raising $45,000+ and ranking in the top 4% out of 3,500+ teams worldwide. Led integration of custom electrical systems, power distribution, and sensor networks.',
      tags: ['Leadership', 'Electrical Systems', 'FRC'],
    },
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
    <section id="experience" className="experience section page-section">
      <div className="container">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Experience
        </motion.h2>
        <motion.div
          className="experience-timeline"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {experiences.map((exp) => (
            <motion.div
              key={exp.id}
              className="experience-item"
              variants={itemVariants}
            >
              <div className="experience-header">
                <div className="experience-type">{exp.type}</div>
                <div className="experience-date">{exp.date}</div>
              </div>
              <h3 className="experience-title">{exp.title}</h3>
              <p className="experience-company">
                {exp.company} • {exp.location}
              </p>
              <p className="experience-description">{exp.description}</p>
              <div className="experience-tags">
                {exp.tags.map((tag) => (
                  <span key={tag} className="experience-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Experience

